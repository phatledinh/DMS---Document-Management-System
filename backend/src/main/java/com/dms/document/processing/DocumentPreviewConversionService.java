package com.dms.document.processing;

import com.dms.document.entity.Document;
import com.dms.document.entity.DocumentStatus;
import com.dms.document.entity.DocumentVersion;
import com.dms.document.repository.DocumentRepository;
import com.dms.document.repository.DocumentVersionRepository;
import com.dms.document.service.DocumentVersionService;
import com.dms.identity.entity.Role;
import com.dms.identity.repository.UserRepository;
import com.dms.storage.ObjectStorageService;
import org.jodconverter.core.DocumentConverter;
import org.jodconverter.core.office.OfficeException;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;
import java.util.Set;

@Service
@Profile("worker")
@ConditionalOnProperty(prefix = "app.preview", name = "enabled", havingValue = "true", matchIfMissing = true)
public class DocumentPreviewConversionService {
    private static final String PDF_CONTENT_TYPE = "application/pdf";
    private static final Set<String> OFFICE_FILE_TYPES = Set.of("doc", "docx", "xls", "xlsx");

    private final ObjectStorageService objectStorageService;
    private final DocumentRepository documentRepository;
    private final DocumentVersionRepository versionRepository;
    private final DocumentVersionService versionService;
    private final DocumentConverter documentConverter;
    private final UserRepository userRepository;

    public DocumentPreviewConversionService(
            ObjectStorageService objectStorageService,
            DocumentRepository documentRepository,
            DocumentVersionRepository versionRepository,
            DocumentVersionService versionService,
            DocumentConverter documentConverter,
            UserRepository userRepository
    ) {
        this.objectStorageService = objectStorageService;
        this.documentRepository = documentRepository;
        this.versionRepository = versionRepository;
        this.versionService = versionService;
        this.documentConverter = documentConverter;
        this.userRepository = userRepository;
    }

    public boolean requiresConversion(Document document) {
        return document != null && requiresConversion(document.getFileType());
    }

    public boolean requiresConversion(String fileType) {
        return fileType != null && OFFICE_FILE_TYPES.contains(fileType.toLowerCase(Locale.ROOT));
    }

    public void convert(Document document, DocumentProcessingMessage message) {
        if (shouldSkip(document, message)) {
            return;
        }
        DocumentVersion version = message.versionId() == null ? null : versionRepository.findByIdAndDocumentId(message.versionId(), document.getId()).orElse(null);
        String previewObjectKey = objectStorageService.generatePreviewObjectKey(message.objectKey());
        String existingPreviewObjectKey = version == null ? document.getPreviewObjectKey() : version.getPreviewObjectKey();
        if (existingPreviewObjectKey != null && !existingPreviewObjectKey.isBlank() && objectStorageService.objectExists(existingPreviewObjectKey)) {
            if (version == null) {
                boolean isAdmin = userRepository.findById(document.getUploadedBy())
                        .map(u -> u.getRole() == Role.ADMIN)
                        .orElse(false);
                document.setStatus(isAdmin ? DocumentStatus.INDEXED : DocumentStatus.PENDING_APPROVAL);
                documentRepository.save(document);
            } else {
                boolean isAdmin = userRepository.findById(version.getUploadedBy())
                        .map(u -> u.getRole() == Role.ADMIN)
                        .orElse(false);
                if (isAdmin) {
                    versionService.publishVersionAsCurrent(document, version, existingPreviewObjectKey);
                } else {
                    version.setPreviewObjectKey(existingPreviewObjectKey);
                    version.setStatus(DocumentStatus.PENDING_APPROVAL);
                    versionRepository.save(version);
                    if (document.getCurrentVersionId() == null) {
                        document.setStatus(DocumentStatus.PENDING_APPROVAL);
                        document.setPreviewObjectKey(existingPreviewObjectKey);
                        documentRepository.save(document);
                    }
                }
            }
            return;
        }

        Path inputFile = null;
        Path outputFile = null;
        try {
            inputFile = Files.createTempFile("dms-preview-", "." + (version == null ? extension(document) : extension(version.getFileName())));
            outputFile = Files.createTempFile("dms-preview-output-", ".pdf");
            try (InputStream source = objectStorageService.openStream(message.objectKey())) {
                Files.copy(source, inputFile, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
            }
            documentConverter.convert(inputFile.toFile()).to(outputFile.toFile()).execute();
            objectStorageService.putObject(previewObjectKey, outputFile, PDF_CONTENT_TYPE);
            if (version == null) {
                document.setPreviewObjectKey(previewObjectKey);
                boolean isAdmin = userRepository.findById(document.getUploadedBy())
                        .map(u -> u.getRole() == Role.ADMIN)
                        .orElse(false);
                document.setStatus(isAdmin ? DocumentStatus.INDEXED : DocumentStatus.PENDING_APPROVAL);
                documentRepository.save(document);
            } else {
                boolean isAdmin = userRepository.findById(version.getUploadedBy())
                        .map(u -> u.getRole() == Role.ADMIN)
                        .orElse(false);
                if (isAdmin) {
                    versionService.publishVersionAsCurrent(document, version, previewObjectKey);
                } else {
                    version.setPreviewObjectKey(previewObjectKey);
                    version.setStatus(DocumentStatus.PENDING_APPROVAL);
                    versionRepository.save(version);
                    if (document.getCurrentVersionId() == null) {
                        document.setStatus(DocumentStatus.PENDING_APPROVAL);
                        document.setPreviewObjectKey(previewObjectKey);
                        documentRepository.save(document);
                    }
                }
            }
        } catch (IOException | OfficeException exception) {
            throw new IllegalStateException("Could not create preview artifact", exception);
        } finally {
            deleteIfExists(inputFile);
            deleteIfExists(outputFile);
        }
    }

    private boolean shouldSkip(Document document, DocumentProcessingMessage message) {
        if (document == null || document.getStatus() == DocumentStatus.DELETED) {
            return true;
        }
        if (document.getStatus() != DocumentStatus.PROCESSING && document.getStatus() != DocumentStatus.INDEXED) {
            return true;
        }
        if (message.versionId() == null) {
            return !message.objectKey().equals(document.getStoragePath()) || !requiresConversion(document);
        }
        return versionRepository.findByIdAndDocumentId(message.versionId(), document.getId())
                .filter(version -> message.objectKey().equals(version.getStoragePath()))
                .filter(version -> requiresConversion(extension(version.getFileName())))
                .isEmpty();
    }

    private String extension(Document document) {
        return document.getFileType().toLowerCase(Locale.ROOT);
    }

    private String extension(String fileName) {
        int index = fileName.lastIndexOf('.');
        return fileName.substring(index + 1).toLowerCase(Locale.ROOT);
    }

    private void deleteIfExists(Path path) {
        if (path == null) {
            return;
        }
        try {
            Files.deleteIfExists(path);
        } catch (IOException ignored) {
        }
    }
}
