package com.dms.document.service;

import com.dms.common.exception.AppException;
import com.dms.common.exception.ErrorCodes;
import com.dms.common.security.CurrentUserProvider;
import com.dms.document.dto.PresignedUrlResponse;
import com.dms.document.dto.UploadCompleteResponse;
import com.dms.document.dto.UploadInitRequest;
import com.dms.document.dto.UploadInitResponse;
import com.dms.document.entity.AccessLog;
import com.dms.document.entity.AccessLogAction;
import com.dms.document.entity.Document;
import com.dms.document.entity.DocumentAccessLevel;
import com.dms.document.entity.DocumentDepartmentAccess;
import com.dms.document.entity.DocumentStatus;
import com.dms.document.entity.DocumentUserAccess;
import com.dms.document.policy.AccessDecision;
import com.dms.document.policy.DocumentAccessPolicyService;
import com.dms.document.processing.DocumentExtractionRequestedEvent;
import com.dms.document.repository.AccessLogRepository;
import com.dms.document.repository.DocumentDepartmentAccessRepository;
import com.dms.document.repository.DocumentRepository;
import com.dms.document.repository.DocumentUserAccessRepository;
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
import com.github.slugify.Slugify;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;

@Service
public class DocumentPresignedUrlService {
    private final DocumentRepository documentRepository;
    private final DocumentDepartmentAccessRepository departmentAccessRepository;
    private final DocumentUserAccessRepository userAccessRepository;
    private final AccessLogRepository accessLogRepository;
    private final UserRepository userRepository;
    private final CurrentUserProvider currentUserProvider;
    private final DocumentAccessPolicyService accessPolicyService;
    private final ObjectStorageService objectStorageService;
    private final FileValidationService fileValidationService;
    private final MimeDetectionService mimeDetectionService;
    private final ApplicationEventPublisher eventPublisher;
    private final Slugify slugify = Slugify.builder().build();

    public DocumentPresignedUrlService(
            DocumentRepository documentRepository,
            DocumentDepartmentAccessRepository departmentAccessRepository,
            DocumentUserAccessRepository userAccessRepository,
            AccessLogRepository accessLogRepository,
            UserRepository userRepository,
            CurrentUserProvider currentUserProvider,
            DocumentAccessPolicyService accessPolicyService,
            ObjectStorageService objectStorageService,
            FileValidationService fileValidationService,
            MimeDetectionService mimeDetectionService,
            ApplicationEventPublisher eventPublisher
    ) {
        this.documentRepository = documentRepository;
        this.departmentAccessRepository = departmentAccessRepository;
        this.userAccessRepository = userAccessRepository;
        this.accessLogRepository = accessLogRepository;
        this.userRepository = userRepository;
        this.currentUserProvider = currentUserProvider;
        this.accessPolicyService = accessPolicyService;
        this.objectStorageService = objectStorageService;
        this.fileValidationService = fileValidationService;
        this.mimeDetectionService = mimeDetectionService;
        this.eventPublisher = eventPublisher;
    }

    @Transactional
    public UploadInitResponse initiateUpload(UploadInitRequest request) {
        User admin = currentUserProvider.getRequiredUser();
        requireAdmin(admin);
        ValidatedFile file = fileValidationService.validateDeclared(request.fileName(), request.fileSize(), request.contentType());
        Long ownerId = request.ownerId() != null ? request.ownerId() : admin.getId();
        ensureUserExists(ownerId);

        String objectKey = objectStorageService.generateDocumentObjectKey();
        PresignedPutUrl presignedUrl = objectStorageService.presignPut(objectKey, file.mimeType());
        Document document = new Document();
        document.setTitle(request.title().trim());
        document.setSlug(uniqueSlug(request.title()));
        document.setDescription(request.description());
        document.setCategoryId(request.categoryId());
        document.setDepartmentId(request.departmentId());
        document.setUploadedBy(admin.getId());
        document.setOwnerId(ownerId);
        document.setFileName(file.fileName());
        document.setFileType(file.fileType());
        document.setMimeType(file.mimeType());
        document.setFileSize(request.fileSize());
        document.setStoragePath(objectKey);
        document.setUploadExpiresAt(presignedUrl.expiresAt());
        document.setStatus(DocumentStatus.AWAITING_UPLOAD);
        document.setAccessLevel(request.visibility() != null ? request.visibility() : DocumentAccessLevel.PUBLIC);
        document.setEffectiveDate(request.effectiveDate());
        document.setExpiryDate(request.expiryDate());
        document = documentRepository.save(document);
        saveAudience(document.getId(), admin.getId(), request.departmentIds(), request.sharedUserIds());
        return new UploadInitResponse(
                document.getId(),
                document.getStatus().name(),
                objectKey,
                presignedUrl.url(),
                presignedUrl.method(),
                presignedUrl.requiredHeaders(),
                presignedUrl.expiresIn()
        );
    }

    @Transactional
    public UploadCompleteResponse completeUpload(Long documentId) {
        User admin = currentUserProvider.getRequiredUser();
        requireAdmin(admin);
        Document document = findDocument(documentId);
        if (document.getStatus() != DocumentStatus.AWAITING_UPLOAD) {
            throw new AppException(ErrorCodes.DOCUMENT_NOT_READY, "Document is not awaiting upload", HttpStatus.CONFLICT);
        }
        if (document.getUploadExpiresAt() != null && document.getUploadExpiresAt().isBefore(OffsetDateTime.now())) {
            throw new AppException(ErrorCodes.UPLOAD_NOT_COMPLETED, "Upload URL has expired", HttpStatus.BAD_REQUEST);
        }

        ObjectMetadata metadata = objectStorageService.headObject(document.getStoragePath());
        if (metadata.contentLength() != document.getFileSize()) {
            objectStorageService.deleteObject(document.getStoragePath());
            throw new AppException(ErrorCodes.UPLOAD_SIZE_MISMATCH, "Uploaded size does not match declared size", HttpStatus.BAD_REQUEST);
        }
        String detectedMimeType = mimeDetectionService.detect(objectStorageService.openStream(document.getStoragePath()), document.getFileName());
        try {
            fileValidationService.validateDetected(document.getFileType(), detectedMimeType);
        } catch (AppException exception) {
            objectStorageService.deleteObject(document.getStoragePath());
            throw exception;
        }

        document.setMimeType(detectedMimeType);
        document.setStatus(DocumentStatus.PROCESSING);
        document.setUploadExpiresAt(null);
        if (document.getDocumentCode() == null) {
            document.setDocumentCode(generateDocumentCode());
        }
        eventPublisher.publishEvent(new DocumentExtractionRequestedEvent(document.getId(), null, document.getStoragePath(), document.getMimeType()));
        Document saved = documentRepository.save(document);
        return new UploadCompleteResponse(saved.getId(), saved.getStatus().name(), saved.getDocumentCode(), saved.getVersionNumber(), saved.getCreatedAt());
    }

    @Transactional
    public PresignedUrlResponse createDownloadUrl(Long documentId, HttpServletRequest request) {
        User user = currentUserProvider.getRequiredUser();
        Document document = findDocument(documentId);
        AccessDecision decision = accessPolicyService.canDownload(user, document);
        if (!decision.granted()) {
            logAccess(user, document, AccessLogAction.DOWNLOAD, false, decision.denialReason(), request);
            throw denied(decision);
        }
        PresignedGetUrl url = objectStorageService.presignGet(document.getStoragePath(), "attachment; filename=\"" + document.getFileName() + "\"");
        document.setDownloadCount(document.getDownloadCount() + 1);
        logAccess(user, document, AccessLogAction.DOWNLOAD, true, null, request);
        return new PresignedUrlResponse(url.url(), document.getFileName(), url.expiresIn());
    }

    @Transactional
    public PresignedUrlResponse createPreviewUrl(Long documentId, HttpServletRequest request) {
        User user = currentUserProvider.getRequiredUser();
        Document document = findDocument(documentId);
        AccessDecision decision = accessPolicyService.canPreview(user, document);
        if (!decision.granted()) {
            logAccess(user, document, AccessLogAction.PREVIEW, false, decision.denialReason(), request);
            throw denied(decision);
        }
        String key = previewKey(document);
        PresignedGetUrl url = objectStorageService.presignGet(key, "inline; filename=\"" + document.getFileName() + "\"");
        logAccess(user, document, AccessLogAction.PREVIEW, true, null, request);
        return new PresignedUrlResponse(url.url(), document.getFileName(), url.expiresIn());
    }

    private String previewKey(Document document) {
        if (document.getPreviewObjectKey() != null && !document.getPreviewObjectKey().isBlank()) {
            return document.getPreviewObjectKey();
        }
        if (fileValidationService.canPreviewOriginal(document.getFileType())) {
            return document.getStoragePath();
        }
        throw new AppException(ErrorCodes.DOCUMENT_NOT_READY, "Preview is not ready", HttpStatus.CONFLICT);
    }

    private void saveAudience(Long documentId, Long grantedBy, List<Long> departmentIds, List<Long> sharedUserIds) {
        if (departmentIds != null) {
            departmentIds.stream().distinct().forEach(departmentId -> {
                DocumentDepartmentAccess access = new DocumentDepartmentAccess();
                access.setDocumentId(documentId);
                access.setDepartmentId(departmentId);
                access.setGrantedBy(grantedBy);
                departmentAccessRepository.save(access);
            });
        }
        if (sharedUserIds != null) {
            sharedUserIds.stream().distinct().forEach(userId -> {
                ensureUserExists(userId);
                DocumentUserAccess access = new DocumentUserAccess();
                access.setDocumentId(documentId);
                access.setUserId(userId);
                access.setGrantedBy(grantedBy);
                userAccessRepository.save(access);
            });
        }
    }

    private void logAccess(User user, Document document, AccessLogAction action, boolean granted, String denialReason, HttpServletRequest request) {
        AccessLog log = new AccessLog();
        log.setUserId(user.getId());
        log.setDocumentId(document.getId());
        log.setAction(action);
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

    private void requireAdmin(User user) {
        if (user.getRole() != Role.ADMIN) {
            throw new AppException(ErrorCodes.ACCESS_DENIED, "Admin role is required", HttpStatus.FORBIDDEN);
        }
    }

    private void ensureUserExists(Long userId) {
        if (!userRepository.existsById(userId)) {
            throw new AppException(ErrorCodes.VALIDATION_ERROR, "User does not exist", HttpStatus.BAD_REQUEST);
        }
    }

    private RuntimeException denied(AccessDecision decision) {
        if ("DOCUMENT_NOT_READY".equals(decision.denialReason())) {
            return new AppException(ErrorCodes.DOCUMENT_NOT_READY, "Document is not ready", HttpStatus.CONFLICT);
        }
        return new AppException(ErrorCodes.ACCESS_DENIED, "Access denied", HttpStatus.FORBIDDEN);
    }

    private String uniqueSlug(String title) {
        return slugify.slugify(title) + "-" + Long.toString(System.nanoTime(), 36);
    }

    private String generateDocumentCode() {
        return "DMS-" + DateTimeFormatter.ofPattern("yyyyMM").format(OffsetDateTime.now()) + "-" + ThreadLocalRandom.current().nextInt(100000, 1000000);
    }
}
