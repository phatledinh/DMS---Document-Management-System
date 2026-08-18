package com.dms.document.processing;

import com.dms.document.entity.Document;
import com.dms.document.entity.DocumentStatus;
import com.dms.document.entity.DocumentVersion;
import com.dms.document.repository.DocumentRepository;
import com.dms.document.repository.DocumentVersionRepository;
import com.dms.document.service.DocumentVersionService;
import com.dms.storage.FileValidationService;
import com.dms.storage.ObjectStorageService;
import org.springframework.stereotype.Service;

@Service
public class DocumentExtractionPipeline {
    private final ObjectStorageService objectStorageService;
    private final DocumentTextExtractionService textExtractionService;
    private final DocumentContentService contentService;
    private final PostgresSearchEngine searchEngine;
    private final DocumentRepository documentRepository;
    private final DocumentVersionRepository versionRepository;
    private final DocumentVersionService versionService;
    private final DocumentProcessingPublisher publisher;
    private final FileValidationService fileValidationService;

    public DocumentExtractionPipeline(
            ObjectStorageService objectStorageService,
            DocumentTextExtractionService textExtractionService,
            DocumentContentService contentService,
            PostgresSearchEngine searchEngine,
            DocumentRepository documentRepository,
            DocumentVersionRepository versionRepository,
            DocumentVersionService versionService,
            DocumentProcessingPublisher publisher,
            FileValidationService fileValidationService
    ) {
        this.objectStorageService = objectStorageService;
        this.textExtractionService = textExtractionService;
        this.contentService = contentService;
        this.searchEngine = searchEngine;
        this.documentRepository = documentRepository;
        this.versionRepository = versionRepository;
        this.versionService = versionService;
        this.publisher = publisher;
        this.fileValidationService = fileValidationService;
    }

    public void process(Document document, DocumentProcessingMessage message) {
        try {
            DocumentVersion version = message.versionId() == null ? null : versionRepository.findByIdAndDocumentId(message.versionId(), document.getId()).orElse(null);
            String objectKey = version == null ? document.getStoragePath() : version.getStoragePath();
            String fileType = version == null ? document.getFileType() : fileType(version.getFileName());
            ExtractedDocumentText extractedText = textExtractionService.extract(fileType, document, objectStorageService.openStream(objectKey));
            boolean requiresPreviewConversion = fileValidationService.requiresPreviewConversion(fileType);
            if (version == null) {
                contentService.saveSuccess(document.getId(), extractedText, message.attempt());
                searchEngine.refreshIndex(document, extractedText.text());
                if (!requiresPreviewConversion) {
                    document.setStatus(DocumentStatus.INDEXED);
                }
                documentRepository.save(document);
                if (requiresPreviewConversion) {
                    publisher.publishPreview(document.getId(), null, objectKey, document.getMimeType());
                }
            } else {
                contentService.saveSuccess(document.getId(), extractedText, message.attempt());
                searchEngine.refreshIndex(document, extractedText.text());
                if (!requiresPreviewConversion) {
                    versionService.publishVersionAsCurrent(document, version, null);
                }
                if (requiresPreviewConversion) {
                    publisher.publishPreview(document.getId(), message.versionId(), objectKey, version.getMimeType());
                }
            }
        } catch (RuntimeException exception) {
            if (message.versionId() == null) {
                contentService.saveFailure(document.getId(), "TEXT_EXTRACTION", exception.getMessage(), message.attempt());
            } else {
                versionService.markVersionFailed(document.getId(), message.versionId());
            }
            throw exception;
        }
    }

    private String fileType(String fileName) {
        int index = fileName.lastIndexOf('.');
        return fileName.substring(index + 1).toUpperCase();
    }
}
