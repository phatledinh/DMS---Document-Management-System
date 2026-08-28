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
import com.dms.document.dto.VersionUpdateRequest;
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
import com.dms.identity.repository.UserRepository;
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
import org.springframework.beans.factory.annotation.Value;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

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
    private final UserRepository userRepository;

    @Value("${app.document.max-versions:20}")
    private int maxVersions;

    public DocumentVersionService(
            DocumentRepository documentRepository,
            DocumentVersionRepository versionRepository,
            CurrentUserProvider currentUserProvider,
            DocumentAccessPolicyService accessPolicyService,
            ObjectStorageService objectStorageService,
            FileValidationService fileValidationService,
            MimeDetectionService mimeDetectionService,
            ApplicationEventPublisher eventPublisher,
            AccessLogRepository accessLogRepository,
            UserRepository userRepository
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
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public List<DocumentVersionResponse> history(Long documentId) {
        User user = currentUserProvider.getRequiredUser();
        Document document = findDocument(documentId);
        AccessDecision decision = accessPolicyService.canViewMetadata(user, document);
        if (!decision.granted()) {
            throw denied(decision);
        }
        
        List<DocumentVersion> versions = versionRepository.findByDocumentIdOrderByCreatedAtDesc(documentId);
        Set<Long> userIds = versions.stream().map(DocumentVersion::getUploadedBy).collect(Collectors.toSet());
        Map<Long, String> userNames = userRepository.findAllById(userIds).stream()
                .collect(Collectors.toMap(User::getId, User::getName));
                
        return versions.stream()
                .map(version -> toResponse(version, document, userNames.get(version.getUploadedBy())))
                .toList();
    }

    @Transactional
    public VersionUploadInitResponse initiateVersionUpload(Long documentId, VersionUploadInitRequest request) {
        User currentUser = currentUserProvider.getRequiredUser();
        Document document = findDocument(documentId);
        requireAdminOrOriginalUploader(currentUser, document);
        if (document.getStatus() == DocumentStatus.DELETED) {
            throw new AppException(ErrorCodes.DOCUMENT_NOT_FOUND, "Document not found", HttpStatus.NOT_FOUND);
        }
        if (document.getStatus() == DocumentStatus.PROCESSING) {
            throw new AppException(ErrorCodes.DOCUMENT_NOT_READY, "Document is currently processing another version", HttpStatus.CONFLICT);
        }
        if (versionRepository.existsByDocumentIdAndStatus(documentId, DocumentStatus.PENDING_APPROVAL)) {
            throw new AppException(ErrorCodes.DOCUMENT_NOT_READY, "A version is currently pending approval", HttpStatus.CONFLICT);
        }
        
        List<DocumentVersion> existingVersions = versionRepository.findByDocumentIdOrderByCreatedAtDesc(documentId);
        if (!existingVersions.isEmpty()) {
            DocumentVersion latestVersion = existingVersions.get(0);
            if (latestVersion.getStatus() == DocumentStatus.PENDING_APPROVAL || latestVersion.getStatus() == DocumentStatus.REJECTED) {
                if (currentUser.getRole() == Role.ADMIN && !currentUser.getId().equals(document.getUploadedBy())) {
                    throw new AppException(ErrorCodes.ACCESS_DENIED, "Admin cannot upload versions while the latest version is pending or rejected", HttpStatus.FORBIDDEN);
                }
            }
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
        version.setUploadedBy(currentUser.getId());
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
        User currentUser = currentUserProvider.getRequiredUser();
        Document document = findDocument(documentId);
        requireAdminOrOriginalUploader(currentUser, document);
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
            versionRepository.delete(version);
            throw new AppException(ErrorCodes.UPLOAD_SIZE_MISMATCH, "Uploaded size does not match declared size", HttpStatus.BAD_REQUEST);
        }
        String fileType = fileType(version.getFileName());
        String detectedMimeType = mimeDetectionService.detect(objectStorageService.openStream(version.getStoragePath()), version.getFileName());
        try {
            fileValidationService.validateDetected(fileType, detectedMimeType);
        } catch (AppException exception) {
            objectStorageService.deleteObject(version.getStoragePath());
            versionRepository.delete(version);
            throw exception;
        }

        version.setMimeType(detectedMimeType);
        version.setStatus(DocumentStatus.PROCESSING);
        version.setUploadExpiresAt(null);
        versionRepository.save(version);
        eventPublisher.publishEvent(new DocumentExtractionRequestedEvent(document.getId(), version.getId(), version.getStoragePath(), version.getMimeType()));
        logAction(currentUser, document, AccessLogAction.VERSION_UPLOAD);
        enforceMaxVersions(document.getId());
        return new VersionUploadCompleteResponse(version.getId(), document.getId(), version.getVersionNumber(), document.getStatus().name(), version.getCreatedAt());
    }

    @Transactional
    public PresignedUrlResponse createDownloadUrl(Long documentId, Long versionId, HttpServletRequest request) {
        User user = currentUserProvider.getRequiredUser();
        Document document = findDocument(documentId);
        DocumentVersion version = findVersion(documentId, versionId);
        AccessDecision decision = accessPolicyService.canDownload(user, document);
        if (!decision.granted()) {
            logAccess(user, document, AccessLogAction.VERSION_DOWNLOAD, false, decision.denialReason(), request);
            throw denied(decision);
        }
        if (version.getStatus() != DocumentStatus.INDEXED) {
            throw new AppException(ErrorCodes.DOCUMENT_NOT_READY, "Version is not ready", HttpStatus.CONFLICT);
        }
        PresignedGetUrl url = objectStorageService.presignGet(version.getStoragePath(), "attachment; filename=\"" + version.getFileName() + "\"");
        logAccess(user, document, AccessLogAction.VERSION_DOWNLOAD, true, null, request);
        return new PresignedUrlResponse(url.url(), version.getFileName(), url.expiresIn());
    }

    @Transactional
    public PresignedUrlResponse createPreviewUrl(Long documentId, Long versionId, HttpServletRequest request) {
        User user = currentUserProvider.getRequiredUser();
        Document document = findDocument(documentId);
        DocumentVersion version = findVersion(documentId, versionId);
        AccessDecision decision = accessPolicyService.canPreviewVersion(user, document, version);
        if (!decision.granted()) {
            logAccess(user, document, AccessLogAction.VERSION_PREVIEW, false, decision.denialReason(), request);
            throw denied(decision);
        }
        String key = previewKey(document, version);
        String fileName = previewFileName(version.getFileName(), document.getFileType());
        PresignedGetUrl url = objectStorageService.presignGet(key, "inline; filename=\"" + fileName + "\"");
        logAccess(user, document, AccessLogAction.VERSION_PREVIEW, true, null, request);
        return new PresignedUrlResponse(url.url(), fileName, url.expiresIn());
    }

    private String previewKey(Document document, DocumentVersion version) {
        if (fileValidationService.requiresPreviewConversion(document.getFileType())) {
            if (version.getPreviewObjectKey() != null && !version.getPreviewObjectKey().isBlank()) {
                return version.getPreviewObjectKey();
            }
            throw new AppException(ErrorCodes.DOCUMENT_NOT_READY, "Preview is not ready", HttpStatus.CONFLICT);
        }
        if (fileValidationService.canPreviewOriginal(document.getFileType())) {
            return version.getStoragePath();
        }
        throw new AppException(ErrorCodes.DOCUMENT_NOT_READY, "Preview is not ready", HttpStatus.CONFLICT);
    }
    
    private String previewFileName(String fileName, String fileType) {
        if (!fileValidationService.requiresPreviewConversion(fileType)) {
            return fileName;
        }
        int extensionIndex = fileName.lastIndexOf('.');
        String baseName = extensionIndex > 0 ? fileName.substring(0, extensionIndex) : fileName;
        return baseName + ".pdf";
    }

    @Transactional
    public VersionRestoreResponse restore(Long documentId, Long versionId) {
        User currentUser = currentUserProvider.getRequiredUser();
        Document document = findDocument(documentId);
        requireAdminOrOriginalUploader(currentUser, document);
        if (document.getStatus() != DocumentStatus.INDEXED && document.getStatus() != DocumentStatus.EXTRACTION_FAILED) {
            throw new AppException(ErrorCodes.INVALID_DOCUMENT_STATUS, "Document cannot be restored from status " + document.getStatus(), HttpStatus.CONFLICT);
        }
        DocumentVersion version = findVersion(documentId, versionId);
        if (version.getStatus() != DocumentStatus.INDEXED) {
            throw new AppException(ErrorCodes.DOCUMENT_NOT_READY, "Version is not ready", HttpStatus.CONFLICT);
        }
        if (version.getId().equals(document.getCurrentVersionId())) {
            return new VersionRestoreResponse(document.getId(), version.getId(), version.getVersionNumber(), document.getStatus().name());
        }
        version.setStatus(DocumentStatus.PROCESSING);
        document.setStatus(DocumentStatus.PROCESSING);
        versionRepository.save(version);
        documentRepository.save(document);
        eventPublisher.publishEvent(new DocumentExtractionRequestedEvent(document.getId(), version.getId(), version.getStoragePath(), version.getMimeType()));
        logAction(currentUser, document, AccessLogAction.VERSION_RESTORE);
        return new VersionRestoreResponse(document.getId(), version.getId(), version.getVersionNumber(), document.getStatus().name());
    }

    @Transactional
    public DocumentVersionResponse updateVersion(Long documentId, Long versionId, VersionUpdateRequest request) {
        User currentUser = currentUserProvider.getRequiredUser();
        Document document = findDocument(documentId);
        requireAdminOrOriginalUploader(currentUser, document);
        DocumentVersion version = findVersion(documentId, versionId);
        String versionNumber = request.versionNumber().trim();
        if (!versionNumber.equals(version.getVersionNumber())
                && versionRepository.existsByDocumentIdAndVersionNumber(documentId, versionNumber)) {
            throw new AppException(ErrorCodes.VERSION_DUPLICATE, "Version number already exists", HttpStatus.CONFLICT);
        }
        version.setVersionNumber(versionNumber);
        version.setChangelog(request.changelog().trim());
        versionRepository.save(version);
        if (version.getId().equals(document.getCurrentVersionId())) {
            document.setVersionNumber(versionNumber);
            document.setUpdatedAt(OffsetDateTime.now());
            documentRepository.save(document);
        }
        String uploadedByName = userRepository.findById(version.getUploadedBy()).map(User::getName).orElse(null);
        return toResponse(version, document, uploadedByName);
    }

    public void publishVersionAsCurrent(Document document, DocumentVersion version, String previewObjectKey) {
        document.setCurrentVersionId(version.getId());
        document.setVersionNumber(version.getVersionNumber());
        document.setFileName(version.getFileName());
        document.setFileType(fileType(version.getFileName()).toUpperCase());
        document.setMimeType(version.getMimeType());
        document.setFileSize(version.getFileSize());
        document.setStoragePath(version.getStoragePath());
        document.setPreviewObjectKey(previewObjectKey);
        
        boolean isAdmin = userRepository.findById(version.getUploadedBy())
                .map(u -> u.getRole() == Role.ADMIN)
                .orElse(false);
        DocumentStatus newStatus = isAdmin ? DocumentStatus.INDEXED : DocumentStatus.PENDING_APPROVAL;
        
        document.setStatus(newStatus);
        version.setPreviewObjectKey(previewObjectKey);
        version.setStatus(newStatus);
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
            if (document.getCurrentVersionId() != null) {
                versionRepository.findById(document.getCurrentVersionId())
                        .ifPresentOrElse(
                                current -> document.setStatus(current.getStatus() == DocumentStatus.INDEXED ? DocumentStatus.INDEXED : DocumentStatus.EXTRACTION_FAILED),
                                () -> document.setStatus(DocumentStatus.EXTRACTION_FAILED)
                        );
            } else {
                document.setStatus(DocumentStatus.EXTRACTION_FAILED);
            }
            documentRepository.save(document);
        });
    }

    private DocumentVersionResponse toResponse(DocumentVersion version, Document document, String uploadedByName) {
        return new DocumentVersionResponse(
                version.getId(),
                version.getDocumentId(),
                version.getVersionNumber(),
                version.getFileName(),
                version.getFileSize(),
                version.getMimeType(),
                version.getStatus().name(),
                version.getChangelog(),
                version.getId().equals(document.getCurrentVersionId()) && version.getStatus() == DocumentStatus.INDEXED,
                version.getUploadedBy(),
                uploadedByName,
                version.getCreatedAt(),
                version.getRejectReason()
        );
    }

    @Transactional
    public void deleteVersion(Long documentId, Long versionId) {
        User currentUser = currentUserProvider.getRequiredUser();
        Document document = findDocument(documentId);
        requireAdminOrOriginalUploader(currentUser, document);
        DocumentVersion version = findVersion(documentId, versionId);
        if (version.getId().equals(document.getCurrentVersionId())) {
            throw new AppException(ErrorCodes.VALIDATION_ERROR, "Cannot delete current version", HttpStatus.BAD_REQUEST);
        }
        deleteVersion(version);
        logAction(currentUser, document, AccessLogAction.VERSION_DELETE);
    }

    private void deleteVersion(DocumentVersion version) {
        deleteObjectIfPresent(version.getStoragePath());
        deleteObjectIfPresent(version.getPreviewObjectKey());
        versionRepository.delete(version);
    }

    private void deleteObjectIfPresent(String objectKey) {
        if (objectKey == null || objectKey.isBlank()) {
            return;
        }
        try {
            objectStorageService.deleteObject(objectKey);
        } catch (Exception ignored) {
        }
    }

    private void enforceMaxVersions(Long documentId) {
        List<DocumentVersion> versions = versionRepository.findByDocumentIdOrderByCreatedAtDesc(documentId);
        if (versions.size() > maxVersions) {
            Document document = documentRepository.findById(documentId).orElse(null);
            Long currentId = document != null ? document.getCurrentVersionId() : null;
            
            for (int i = maxVersions; i < versions.size(); i++) {
                DocumentVersion v = versions.get(i);
                if (currentId != null && v.getId().equals(currentId)) {
                    continue;
                }
                deleteVersion(v);
            }
        }
    }

    private void logAccess(User user, Document document, AccessLogAction action, boolean granted, String denialReason, HttpServletRequest request) {
        AccessLog log = new AccessLog();
        log.setUserId(user.getId());
        log.setDocumentId(document.getId());
        log.setAction(action);
        log.setAccessGranted(granted);
        log.setDenialReason(denialReason);
        if (request != null) {
            String forwardedFor = request.getHeader("X-Forwarded-For");
            if (forwardedFor != null && !forwardedFor.isBlank()) {
                log.setIpAddress(forwardedFor.split(",")[0].trim());
            } else {
                log.setIpAddress(request.getRemoteAddr());
            }
            log.setUserAgent(request.getHeader("User-Agent"));
        } else {
            populateRequestInfo(log);
        }
        accessLogRepository.save(log);
    }

    private void logAction(User user, Document document, AccessLogAction action) {
        AccessLog log = new AccessLog();
        log.setUserId(user.getId());
        log.setDocumentId(document.getId());
        log.setAction(action);
        log.setAccessGranted(true);
        populateRequestInfo(log);
        accessLogRepository.save(log);
    }

    private void populateRequestInfo(AccessLog log) {
        if (org.springframework.web.context.request.RequestContextHolder.getRequestAttributes() instanceof org.springframework.web.context.request.ServletRequestAttributes attributes) {
            HttpServletRequest request = attributes.getRequest();
            String forwardedFor = request.getHeader("X-Forwarded-For");
            if (forwardedFor != null && !forwardedFor.isBlank()) {
                log.setIpAddress(forwardedFor.split(",")[0].trim());
            } else {
                log.setIpAddress(request.getRemoteAddr());
            }
            log.setUserAgent(request.getHeader("User-Agent"));
        }
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

    private void requireAdminOrOriginalUploader(User user, Document document) {
        boolean isAdmin = user.getRole() == Role.ADMIN;
        boolean isOriginalUploader = document.getUploadedBy() != null
                && document.getUploadedBy().equals(user.getId());
        if (!isAdmin && !isOriginalUploader) {
            throw new AppException(
                    ErrorCodes.ACCESS_DENIED,
                    "Only an admin or the original uploader can upload a new version",
                    HttpStatus.FORBIDDEN
            );
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
