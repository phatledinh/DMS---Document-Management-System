package com.dms.document.service;

import com.dms.common.exception.AppException;
import com.dms.common.exception.ErrorCodes;
import com.dms.common.security.CurrentUserProvider;
import com.dms.document.dto.DocumentVersionResponse;
import com.dms.document.dto.PresignedUrlResponse;
import com.dms.document.dto.VersionRestoreResponse;
import com.dms.document.dto.VersionUploadCompleteResponse;
import com.dms.document.dto.VersionUploadInitRequest;
import com.dms.document.dto.VersionUploadInitResponse;
import com.dms.document.entity.AccessLog;
import com.dms.document.entity.AccessLogAction;
import com.dms.document.entity.Document;
import com.dms.document.entity.DocumentStatus;
import com.dms.document.entity.DocumentVersion;
import com.dms.document.policy.AccessDecision;
import com.dms.document.policy.DocumentAccessPolicyService;
import com.dms.document.processing.DocumentExtractionRequestedEvent;
import com.dms.document.repository.AccessLogRepository;
import com.dms.document.repository.DocumentRepository;
import com.dms.document.repository.DocumentVersionRepository;
import com.dms.identity.entity.Role;
import com.dms.identity.entity.User;
import com.dms.storage.FileValidationService;
import com.dms.storage.MimeDetectionService;
import com.dms.storage.ObjectMetadata;
import com.dms.storage.ObjectStorageService;
import com.dms.storage.PresignedGetUrl;
import com.dms.storage.PresignedPutUrl;
import com.dms.storage.ValidatedFile;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;

@Service
public class DocumentVersionService {
    private final DocumentRepository documentRepository;
    private final DocumentVersionRepository versionRepository;
    private final CurrentUserProvider currentUserProvider;
    private final DocumentAccessPolicyService accessPolicyService;
    private final ObjectStorageService objectStorageService;
    private final FileValidationService fileValidationService;
    private final MimeDetectionService mimeDetectionService;
    private final ApplicationEventPublisher eventPublisher;
    private final AccessLogRepository accessLogRepository;

    public DocumentVersionService(
            DocumentRepository documentRepository,
            DocumentVersionRepository versionRepository,
            CurrentUserProvider currentUserProvider,
            DocumentAccessPolicyService accessPolicyService,
            ObjectStorageService objectStorageService,
            FileValidationService fileValidationService,
            MimeDetectionService mimeDetectionService,
            ApplicationEventPublisher eventPublisher,
            AccessLogRepository accessLogRepository
    ) {
        this.documentRepository = documentRepository;
        this.versionRepository = versionRepository;
        this.currentUserProvider = currentUserProvider;
        this.accessPolicyService = accessPolicyService;
        this.objectStorageService = objectStorageService;
        this.fileValidationService = fileValidationService;
        this.mimeDetectionService = mimeDetectionService;
        this.eventPublisher = eventPublisher;
        this.accessLogRepository = accessLogRepository;
    }

    @Transactional(readOnly = true)
    public List<DocumentVersionResponse> history(Long documentId) {
        User user = currentUserProvider.getRequiredUser();
        Document document = findDocument(documentId);
        AccessDecision decision = accessPolicyService.canViewMetadata(user, document);
        if (!decision.granted()) {
            throw denied(decision);
        }
        return versionRepository.findByDocumentIdOrderByCreatedAtDesc(documentId).stream()
                .map(version -> toResponse(version, document))
                .toList();
    }

    @Transactional
    public VersionUploadInitResponse initiateVersionUpload(Long documentId, VersionUploadInitRequest request) {
        User admin = currentUserProvider.getRequiredUser();
        requireAdmin(admin);
        Document document = findDocument(documentId);
        if (document.getStatus() == DocumentStatus.DELETED) {
            throw new AppException(ErrorCodes.DOCUMENT_NOT_FOUND, "Document not found", HttpStatus.NOT_FOUND);
        }
        String versionNumber = request.versionNumber().trim();
        if (versionRepository.existsByDocumentIdAndVersionNumber(documentId, versionNumber)) {
            throw new AppException(ErrorCodes.VERSION_DUPLICATE, "Version number already exists", HttpStatus.CONFLICT);
        }
        ValidatedFile file = fileValidationService.validateDeclared(request.fileName(), request.fileSize(), request.contentType());
        String objectKey = objectStorageService.generateDocumentObjectKey();
        PresignedPutUrl presignedUrl = objectStorageService.presignPut(objectKey, file.mimeType());

        DocumentVersion version = new DocumentVersion();
        version.setDocumentId(document.getId());
        version.setVersionNumber(versionNumber);
        version.setFileName(file.fileName());
        version.setFileSize(request.fileSize());
        version.setMimeType(file.mimeType());
        version.setStoragePath(objectKey);
        version.setStatus(DocumentStatus.AWAITING_UPLOAD);
        version.setUploadExpiresAt(presignedUrl.expiresAt());
        version.setChangelog(request.changelog().trim());
        version.setUploadedBy(admin.getId());
        version = versionRepository.save(version);

        return new VersionUploadInitResponse(
                document.getId(),
                version.getId(),
                objectKey,
                presignedUrl.url(),
                presignedUrl.method(),
                presignedUrl.requiredHeaders(),
                presignedUrl.expiresIn()
        );
    }

    @Transactional
    public VersionUploadCompleteResponse completeVersionUpload(Long documentId, Long versionId) {
        User admin = currentUserProvider.getRequiredUser();
        requireAdmin(admin);
        Document document = findDocument(documentId);
        DocumentVersion version = findVersion(documentId, versionId);
        if (version.getStatus() != DocumentStatus.AWAITING_UPLOAD) {
            throw new AppException(ErrorCodes.DOCUMENT_NOT_READY, "Version is not awaiting upload", HttpStatus.CONFLICT);
        }
        if (version.getUploadExpiresAt() != null && version.getUploadExpiresAt().isBefore(OffsetDateTime.now())) {
            throw new AppException(ErrorCodes.UPLOAD_NOT_COMPLETED, "Upload URL has expired", HttpStatus.BAD_REQUEST);
        }

        ObjectMetadata metadata = objectStorageService.headObject(version.getStoragePath());
        if (metadata.contentLength() != version.getFileSize()) {
            objectStorageService.deleteObject(version.getStoragePath());
            throw new AppException(ErrorCodes.UPLOAD_SIZE_MISMATCH, "Uploaded size does not match declared size", HttpStatus.BAD_REQUEST);
        }
        String fileType = fileType(version.getFileName());
        String detectedMimeType = mimeDetectionService.detect(objectStorageService.openStream(version.getStoragePath()), version.getFileName());
        try {
            fileValidationService.validateDetected(fileType, detectedMimeType);
        } catch (AppException exception) {
            objectStorageService.deleteObject(version.getStoragePath());
            throw exception;
        }

        version.setMimeType(detectedMimeType);
        version.setStatus(DocumentStatus.PROCESSING);
        version.setUploadExpiresAt(null);
        document.setStatus(DocumentStatus.PROCESSING);
        versionRepository.save(version);
        documentRepository.save(document);
        eventPublisher.publishEvent(new DocumentExtractionRequestedEvent(document.getId(), version.getId(), version.getStoragePath(), version.getMimeType()));
        return new VersionUploadCompleteResponse(version.getId(), document.getId(), version.getVersionNumber(), document.getStatus().name(), version.getCreatedAt());
    }

    @Transactional
    public PresignedUrlResponse createDownloadUrl(Long documentId, Long versionId, HttpServletRequest request) {
        User user = currentUserProvider.getRequiredUser();
        Document document = findDocument(documentId);
        DocumentVersion version = findVersion(documentId, versionId);
        AccessDecision decision = accessPolicyService.canDownload(user, document);
        if (!decision.granted()) {
            logAccess(user, document, false, decision.denialReason(), request);
            throw denied(decision);
        }
        if (version.getStatus() != DocumentStatus.INDEXED) {
            throw new AppException(ErrorCodes.DOCUMENT_NOT_READY, "Version is not ready", HttpStatus.CONFLICT);
        }
        PresignedGetUrl url = objectStorageService.presignGet(version.getStoragePath(), "attachment; filename=\"" + version.getFileName() + "\"");
        logAccess(user, document, true, null, request);
        return new PresignedUrlResponse(url.url(), version.getFileName(), url.expiresIn());
    }

    @Transactional
    public VersionRestoreResponse restore(Long documentId, Long versionId) {
        User admin = currentUserProvider.getRequiredUser();
        requireAdmin(admin);
        Document document = findDocument(documentId);
        DocumentVersion version = findVersion(documentId, versionId);
        if (version.getStatus() != DocumentStatus.INDEXED) {
            throw new AppException(ErrorCodes.DOCUMENT_NOT_READY, "Version is not ready", HttpStatus.CONFLICT);
        }
        if (version.getVersionNumber().equals(document.getVersionNumber())) {
            return new VersionRestoreResponse(document.getId(), version.getId(), version.getVersionNumber(), document.getStatus().name());
        }
        version.setStatus(DocumentStatus.PROCESSING);
        document.setStatus(DocumentStatus.PROCESSING);
        versionRepository.save(version);
        documentRepository.save(document);
        eventPublisher.publishEvent(new DocumentExtractionRequestedEvent(document.getId(), version.getId(), version.getStoragePath(), version.getMimeType()));
        return new VersionRestoreResponse(document.getId(), version.getId(), version.getVersionNumber(), document.getStatus().name());
    }

    public void publishVersionAsCurrent(Document document, DocumentVersion version, String previewObjectKey) {
        document.setVersionNumber(version.getVersionNumber());
        document.setFileName(version.getFileName());
        document.setFileType(fileType(version.getFileName()).toUpperCase());
        document.setMimeType(version.getMimeType());
        document.setFileSize(version.getFileSize());
        document.setStoragePath(version.getStoragePath());
        document.setPreviewObjectKey(previewObjectKey);
        document.setStatus(DocumentStatus.INDEXED);
        version.setPreviewObjectKey(previewObjectKey);
        version.setStatus(DocumentStatus.INDEXED);
        versionRepository.save(version);
        documentRepository.save(document);
    }

    public void markVersionFailed(Long documentId, Long versionId) {
        if (versionId == null) {
            return;
        }
        versionRepository.findByIdAndDocumentId(versionId, documentId).ifPresent(version -> {
            version.setStatus(DocumentStatus.EXTRACTION_FAILED);
            versionRepository.save(version);
        });
        documentRepository.findById(documentId).ifPresent(document -> {
            versionRepository.findFirstByDocumentIdAndVersionNumberAndStatus(documentId, document.getVersionNumber(), DocumentStatus.INDEXED)
                    .ifPresentOrElse(current -> document.setStatus(DocumentStatus.INDEXED), () -> document.setStatus(DocumentStatus.EXTRACTION_FAILED));
            documentRepository.save(document);
        });
    }

    private DocumentVersionResponse toResponse(DocumentVersion version, Document document) {
        return new DocumentVersionResponse(
                version.getId(),
                version.getDocumentId(),
                version.getVersionNumber(),
                version.getFileName(),
                version.getFileSize(),
                version.getMimeType(),
                version.getStatus().name(),
                version.getChangelog(),
                version.getVersionNumber().equals(document.getVersionNumber()) && version.getStatus() == DocumentStatus.INDEXED,
                version.getUploadedBy(),
                version.getCreatedAt()
        );
    }

    private void logAccess(User user, Document document, boolean granted, String denialReason, HttpServletRequest request) {
        AccessLog log = new AccessLog();
        log.setUserId(user.getId());
        log.setDocumentId(document.getId());
        log.setAction(AccessLogAction.VERSION_DOWNLOAD);
        log.setAccessGranted(granted);
        log.setDenialReason(denialReason);
        log.setIpAddress(request.getRemoteAddr());
        log.setUserAgent(request.getHeader("User-Agent"));
        accessLogRepository.save(log);
    }

    private Document findDocument(Long documentId) {
        return documentRepository.findById(documentId)
                .orElseThrow(() -> new AppException(ErrorCodes.DOCUMENT_NOT_FOUND, "Document not found", HttpStatus.NOT_FOUND));
    }

    private DocumentVersion findVersion(Long documentId, Long versionId) {
        return versionRepository.findByIdAndDocumentId(versionId, documentId)
                .orElseThrow(() -> new AppException(ErrorCodes.VERSION_NOT_FOUND, "Version not found", HttpStatus.NOT_FOUND));
    }

    private void requireAdmin(User user) {
        if (user.getRole() != Role.ADMIN) {
            throw new AppException(ErrorCodes.ACCESS_DENIED, "Admin role is required", HttpStatus.FORBIDDEN);
        }
    }

    private RuntimeException denied(AccessDecision decision) {
        if ("DOCUMENT_NOT_READY".equals(decision.denialReason())) {
            return new AppException(ErrorCodes.DOCUMENT_NOT_READY, "Document is not ready", HttpStatus.CONFLICT);
        }
        return new AppException(ErrorCodes.ACCESS_DENIED, "Access denied", HttpStatus.FORBIDDEN);
    }

    private String fileType(String fileName) {
        int index = fileName.lastIndexOf('.');
        if (index < 0 || index == fileName.length() - 1) {
            throw new AppException(ErrorCodes.VALIDATION_ERROR, "File extension is required", HttpStatus.BAD_REQUEST);
        }
        return fileName.substring(index + 1).toLowerCase();
    }
}
