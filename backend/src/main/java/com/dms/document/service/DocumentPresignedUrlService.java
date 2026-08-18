package com.dms.document.service;

import com.dms.common.exception.AppException;
import com.dms.common.exception.ErrorCodes;
import com.dms.common.security.CurrentUserProvider;
import com.dms.document.dto.BatchUploadCompleteRequest;
import com.dms.document.dto.BatchUploadInitFileRequest;
import com.dms.document.dto.BatchUploadInitRequest;
import com.dms.document.dto.BatchUploadItemResponse;
import com.dms.document.dto.BatchUploadResponse;
import com.dms.document.dto.PresignedUrlResponse;
import com.dms.document.dto.UploadCompleteResponse;
import com.dms.document.dto.UploadInitRequest;
import com.dms.document.dto.UploadInitResponse;
import com.dms.document.entity.AccessLog;
import com.dms.document.entity.AccessLogAction;
import com.dms.document.entity.Document;
import com.dms.document.entity.DocumentStatus;
import com.dms.document.policy.AccessDecision;
import com.dms.document.policy.DocumentAccessPolicyService;
import com.dms.document.processing.DocumentExtractionRequestedEvent;
import com.dms.document.repository.AccessLogRepository;
import com.dms.document.repository.DocumentRepository;
import com.dms.document.repository.DocumentVersionRepository;
import com.dms.identity.entity.Role;
import com.dms.identity.entity.User;
import com.dms.identity.repository.UserRepository;
import com.dms.masterdata.repository.CategoryRepository;
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
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ThreadLocalRandom;

@Service
public class DocumentPresignedUrlService {
    private final DocumentRepository documentRepository;
    private final DocumentVersionRepository versionRepository;
    private final AccessLogRepository accessLogRepository;
    private final UserRepository userRepository;
    private final CategoryRepository categoryRepository;
    private final CurrentUserProvider currentUserProvider;
    private final DocumentAccessPolicyService accessPolicyService;
    private final ObjectStorageService objectStorageService;
    private final FileValidationService fileValidationService;
    private final MimeDetectionService mimeDetectionService;
    private final ApplicationEventPublisher eventPublisher;
    private final Slugify slugify = Slugify.builder().build();

    public DocumentPresignedUrlService(
            DocumentRepository documentRepository,
            DocumentVersionRepository versionRepository,
            AccessLogRepository accessLogRepository,
            UserRepository userRepository,
            CategoryRepository categoryRepository,
            CurrentUserProvider currentUserProvider,
            DocumentAccessPolicyService accessPolicyService,
            ObjectStorageService objectStorageService,
            FileValidationService fileValidationService,
            MimeDetectionService mimeDetectionService,
            ApplicationEventPublisher eventPublisher
    ) {
        this.documentRepository = documentRepository;
        this.versionRepository = versionRepository;
        this.accessLogRepository = accessLogRepository;
        this.userRepository = userRepository;
        this.categoryRepository = categoryRepository;
        this.currentUserProvider = currentUserProvider;
        this.accessPolicyService = accessPolicyService;
        this.objectStorageService = objectStorageService;
        this.fileValidationService = fileValidationService;
        this.mimeDetectionService = mimeDetectionService;
        this.eventPublisher = eventPublisher;
    }

    @Transactional
    public UploadInitResponse initiateUpload(UploadInitRequest request) {
        User currentUser = currentUserProvider.getRequiredUser();
        boolean admin = currentUser.getRole() == Role.ADMIN;
        ValidatedFile file = fileValidationService.validateDeclared(request.fileName(), request.fileSize(), request.contentType());
        ensureCategoryExists(request.categoryId());
        AccessDecision uploadDecision = accessPolicyService.canUpload(currentUser, request.categoryId());
        if (!uploadDecision.granted()) {
            throw denied(uploadDecision);
        }
        Long ownerId = admin && request.ownerId() != null ? request.ownerId() : currentUser.getId();
        ensureUserExists(ownerId);

        String objectKey = objectStorageService.generateDocumentObjectKey();
        PresignedPutUrl presignedUrl = objectStorageService.presignPut(objectKey, file.mimeType());
        Document document = new Document();
        document.setTitle(request.title().trim());
        document.setSlug(uniqueSlug(request.title()));
        document.setDescription(request.description());
        document.setCategoryId(request.categoryId());
        document.setDepartmentId(request.departmentId());
        document.setUploadedBy(currentUser.getId());
        document.setOwnerId(ownerId);
        document.setFileName(file.fileName());
        document.setFileType(file.fileType());
        document.setMimeType(file.mimeType());
        document.setFileSize(request.fileSize());
        document.setStoragePath(objectKey);
        document.setUploadExpiresAt(presignedUrl.expiresAt());
        document.setStatus(DocumentStatus.AWAITING_UPLOAD);
        document.setEffectiveDate(request.effectiveDate());
        document.setExpiryDate(request.expiryDate());
        document = documentRepository.save(document);
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
        User currentUser = currentUserProvider.getRequiredUser();
        Document document = findDocument(documentId);
        requireUploadOwnerOrAdmin(currentUser, document);
        if (document.getStatus() != DocumentStatus.AWAITING_UPLOAD) {
            throw new AppException(ErrorCodes.DOCUMENT_NOT_READY, "Document is not awaiting upload", HttpStatus.CONFLICT);
        }
        if (document.getUploadExpiresAt() != null && document.getUploadExpiresAt().isBefore(OffsetDateTime.now())) {
            throw new AppException(ErrorCodes.UPLOAD_NOT_COMPLETED, "Upload URL has expired", HttpStatus.BAD_REQUEST);
        }

        ObjectMetadata metadata = objectStorageService.headObject(document.getStoragePath());
        if (metadata.contentLength() != document.getFileSize()) {
            objectStorageService.deleteObject(document.getStoragePath());
            documentRepository.delete(document);
            throw new AppException(ErrorCodes.UPLOAD_SIZE_MISMATCH, "Uploaded size does not match declared size", HttpStatus.BAD_REQUEST);
        }
        String detectedMimeType = mimeDetectionService.detect(objectStorageService.openStream(document.getStoragePath()), document.getFileName());
        try {
            fileValidationService.validateDetected(document.getFileType(), detectedMimeType);
        } catch (AppException exception) {
            objectStorageService.deleteObject(document.getStoragePath());
            documentRepository.delete(document);
            throw exception;
        }

        document.setMimeType(detectedMimeType);
        document.setStatus(DocumentStatus.PROCESSING);
        document.setUploadExpiresAt(null);
        if (document.getDocumentCode() == null) {
            document.setDocumentCode(generateDocumentCode());
        }
        
        com.dms.document.entity.DocumentVersion version = new com.dms.document.entity.DocumentVersion();
        version.setDocumentId(document.getId());
        version.setVersionNumber(document.getVersionNumber());
        version.setFileName(document.getFileName());
        version.setFileSize(document.getFileSize());
        version.setMimeType(detectedMimeType);
        version.setStoragePath(document.getStoragePath());
        version.setStatus(DocumentStatus.PROCESSING);
        version.setChangelog("Tải lên lần đầu");
        version.setUploadedBy(document.getUploadedBy());
        version = versionRepository.save(version);
        
        eventPublisher.publishEvent(new DocumentExtractionRequestedEvent(document.getId(), version.getId(), document.getStoragePath(), document.getMimeType()));
        logUpload(currentUser, document);
        Document saved = documentRepository.save(document);
        return new UploadCompleteResponse(saved.getId(), saved.getStatus().name(), saved.getDocumentCode(), saved.getVersionNumber(), saved.getCreatedAt());
    }

    public BatchUploadResponse initiateBatchUpload(BatchUploadInitRequest request) {
        validateBatchUploadRequest(request);
        List<BatchUploadItemResponse> items = new ArrayList<>();
        Set<String> clientItemIds = new HashSet<>();
        for (BatchUploadInitFileRequest file : request.files()) {
            if (!clientItemIds.add(file.clientItemId())) {
                items.add(BatchUploadItemResponse.failure(file.clientItemId(), file.fileName(), ErrorCodes.VALIDATION_ERROR, "Duplicate client item id"));
                continue;
            }
            try {
                UploadInitRequest itemRequest = new UploadInitRequest(
                        file.fileName(),
                        file.fileSize(),
                        file.contentType(),
                        file.title(),
                        null,
                        file.categoryId() != null ? file.categoryId() : request.categoryId(),
                        request.departmentId(),
                        file.tagIds() != null ? file.tagIds() : request.tagIds(),
                        request.ownerId(),
                        file.effectiveDate() != null ? file.effectiveDate() : request.effectiveDate(),
                        file.expiryDate() != null ? file.expiryDate() : request.expiryDate()
                );
                items.add(BatchUploadItemResponse.success(file.clientItemId(), file.fileName(), initiateUpload(itemRequest)));
            } catch (AppException exception) {
                items.add(BatchUploadItemResponse.failure(file.clientItemId(), file.fileName(), exception.getCode(), exception.getMessage()));
            }
        }
        return BatchUploadResponse.from(items);
    }

    @Transactional
    public BatchUploadResponse completeBatchUpload(BatchUploadCompleteRequest request) {
        List<BatchUploadItemResponse> items = new ArrayList<>();
        for (var item : request.items()) {
            try {
                items.add(BatchUploadItemResponse.completeSuccess(item.clientItemId(), completeUpload(item.documentId())));
            } catch (AppException exception) {
                items.add(BatchUploadItemResponse.documentFailure(item.clientItemId(), item.documentId(), exception.getCode(), exception.getMessage()));
            }
        }
        return BatchUploadResponse.from(items);
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
        String fileName = previewFileName(document);
        PresignedGetUrl url = objectStorageService.presignGet(key, "inline; filename=\"" + fileName + "\"");
        document.setViewCount(document.getViewCount() + 1);
        logAccess(user, document, AccessLogAction.PREVIEW, true, null, request);
        return new PresignedUrlResponse(url.url(), fileName, url.expiresIn());
    }

    private String previewKey(Document document) {
        if (fileValidationService.requiresPreviewConversion(document.getFileType())) {
            if (document.getPreviewObjectKey() != null && !document.getPreviewObjectKey().isBlank()) {
                return document.getPreviewObjectKey();
            }
            throw new AppException(ErrorCodes.DOCUMENT_NOT_READY, "Preview is not ready", HttpStatus.CONFLICT);
        }
        if (fileValidationService.canPreviewOriginal(document.getFileType())) {
            return document.getStoragePath();
        }
        throw new AppException(ErrorCodes.DOCUMENT_NOT_READY, "Preview is not ready", HttpStatus.CONFLICT);
    }

    private String previewFileName(Document document) {
        if (!fileValidationService.requiresPreviewConversion(document.getFileType())) {
            return document.getFileName();
        }
        int extensionIndex = document.getFileName().lastIndexOf('.');
        String baseName = extensionIndex > 0 ? document.getFileName().substring(0, extensionIndex) : document.getFileName();
        return baseName + ".pdf";
    }

    private void validateBatchUploadRequest(BatchUploadInitRequest request) {
        if (request.files().size() > objectStorageService.batchUploadMaxFiles()) {
            throw new AppException(ErrorCodes.VALIDATION_ERROR, "Batch upload file count exceeds the configured limit", HttpStatus.BAD_REQUEST);
        }
    }

    private void logUpload(User user, Document document) {
        AccessLog log = new AccessLog();
        log.setUserId(user.getId());
        log.setDocumentId(document.getId());
        log.setAction(AccessLogAction.UPLOAD);
        log.setAccessGranted(true);
        accessLogRepository.save(log);
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
        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new AppException(ErrorCodes.DOCUMENT_NOT_FOUND, "Document not found", HttpStatus.NOT_FOUND));
        if (document.getPermanentlyDeletedAt() != null) {
            throw new AppException(ErrorCodes.DOCUMENT_NOT_FOUND, "Document not found", HttpStatus.NOT_FOUND);
        }
        return document;
    }

    private void requireAdmin(User user) {
        if (user.getRole() != Role.ADMIN) {
            throw new AppException(ErrorCodes.ACCESS_DENIED, "Admin role is required", HttpStatus.FORBIDDEN);
        }
    }

    private void requireUploadOwnerOrAdmin(User user, Document document) {
        if (user.getRole() == Role.ADMIN || user.getId().equals(document.getUploadedBy()) || user.getId().equals(document.getOwnerId())) {
            return;
        }
        throw new AppException(ErrorCodes.ACCESS_DENIED, "Only uploader or owner can complete upload", HttpStatus.FORBIDDEN);
    }

    private void ensureUserExists(Long userId) {
        if (!userRepository.existsById(userId)) {
            throw new AppException(ErrorCodes.VALIDATION_ERROR, "User does not exist", HttpStatus.BAD_REQUEST);
        }
    }

    private void ensureCategoryExists(Long categoryId) {
        if (categoryRepository.findByIdAndDeletedAtIsNull(categoryId).isEmpty()) {
            throw new AppException(ErrorCodes.NOT_FOUND, "Category does not exist", HttpStatus.BAD_REQUEST);
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
