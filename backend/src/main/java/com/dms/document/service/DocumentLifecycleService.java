package com.dms.document.service;

import com.dms.common.exception.AppException;
import com.dms.common.exception.ErrorCodes;
import com.dms.common.security.CurrentUserProvider;
import com.dms.document.dto.BatchDocumentLifecycleFailure;
import com.dms.document.dto.BatchDocumentLifecycleResponse;
import com.dms.document.dto.BatchOperationItemResponse;
import com.dms.document.dto.BatchOperationResponse;
import com.dms.document.dto.DocumentLifecycleResponse;
import com.dms.document.dto.DocumentSearchRequest;
import com.dms.document.dto.PageResponse;
import com.dms.document.dto.TrashDocumentResponse;
import com.dms.document.entity.AccessLog;
import com.dms.document.entity.AccessLogAction;
import com.dms.document.entity.Document;
import com.dms.document.entity.DocumentContent;
import com.dms.document.entity.DocumentExtractionStatus;
import com.dms.document.entity.DocumentStatus;
import com.dms.document.entity.DocumentVersion;
import com.dms.document.processing.DocumentProcessingMessage;
import com.dms.document.processing.DocumentProcessingPublisher;
import com.dms.document.processing.DocumentProcessingRabbitConfig;
import com.dms.document.processing.DocumentTrashProperties;
import com.dms.document.processing.PostgresSearchEngine;
import com.dms.document.repository.AccessLogRepository;
import com.dms.document.repository.DocumentContentRepository;
import com.dms.document.repository.DocumentRepository;
import com.dms.document.repository.DocumentVersionRepository;
import com.dms.identity.entity.Role;
import com.dms.identity.entity.User;
import com.dms.storage.ObjectStorageService;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

@Service
public class DocumentLifecycleService {
    private static final int DEFAULT_PAGE = 0;
    private static final int DEFAULT_SIZE = 20;
    private static final int MAX_SIZE = 100;

    private final DocumentRepository documentRepository;
    private final DocumentVersionRepository versionRepository;
    private final DocumentContentRepository contentRepository;
    private final AccessLogRepository accessLogRepository;
    private final CurrentUserProvider currentUserProvider;
    private final ObjectStorageService objectStorageService;
    private final PostgresSearchEngine searchEngine;
    private final DocumentTrashProperties trashProperties;
    private final DocumentProcessingPublisher processingPublisher;

    public DocumentLifecycleService(
            DocumentRepository documentRepository,
            DocumentVersionRepository versionRepository,
            DocumentContentRepository contentRepository,
            AccessLogRepository accessLogRepository,
            CurrentUserProvider currentUserProvider,
            ObjectStorageService objectStorageService,
            PostgresSearchEngine searchEngine,
            DocumentTrashProperties trashProperties,
            DocumentProcessingPublisher processingPublisher
    ) {
        this.documentRepository = documentRepository;
        this.versionRepository = versionRepository;
        this.contentRepository = contentRepository;
        this.accessLogRepository = accessLogRepository;
        this.currentUserProvider = currentUserProvider;
        this.objectStorageService = objectStorageService;
        this.searchEngine = searchEngine;
        this.trashProperties = trashProperties;
        this.processingPublisher = processingPublisher;
    }

    @Transactional
    public DocumentLifecycleResponse archive(Long documentId) {
        User admin = requireAdmin();
        Document document = findDocument(documentId);
        if (document.getStatus() != DocumentStatus.INDEXED && document.getStatus() != DocumentStatus.EXTRACTION_FAILED) {
            throw invalidStatus("Document cannot be archived from status " + document.getStatus());
        }
        OffsetDateTime now = OffsetDateTime.now();
        document.setStatus(DocumentStatus.ARCHIVED);
        document.setArchivedAt(now);
        document.setUpdatedAt(now);
        searchEngine.removeIndex(document.getId());
        logAction(admin, document, AccessLogAction.ARCHIVE);
        return response(documentRepository.save(document), null);
    }

    @Transactional
    public void softDelete(Long documentId) {
        User admin = requireAdmin();
        Document document = findDocument(documentId);
        ensureCanMoveToTrash(document);
        moveToTrash(document, admin, OffsetDateTime.now());
    }

    @Transactional(readOnly = true)
    public PageResponse<TrashDocumentResponse> listTrash(DocumentSearchRequest request) {
        requireAdmin();
        Pageable pageable = pageable(request);
        Page<TrashDocumentResponse> page = documentRepository.findAll(trashSpecification(request), pageable)
                .map(this::trashResponse);
        return PageResponse.from(page);
    }

    @Transactional
    public DocumentLifecycleResponse restore(Long documentId) {
        User admin = requireAdmin();
        Document document = findDocument(documentId);
        if (document.getPermanentlyDeletedAt() != null) {
            throw invalidStatus("Document has been permanently deleted and cannot be restored");
        }
        if (document.getStatus() == DocumentStatus.ARCHIVED) {
            OffsetDateTime now = OffsetDateTime.now();
            document.setStatus(DocumentStatus.INDEXED);
            document.setArchivedAt(null);
            document.setUpdatedAt(now);
            logAction(admin, document, AccessLogAction.RESTORE);
            return response(documentRepository.save(document), now);
        }
        if (document.getStatus() == DocumentStatus.DELETED) {
            return restoreDeleted(document, admin);
        }
        throw invalidStatus("Document cannot be restored from status " + document.getStatus());
    }

    @Transactional
    public BatchDocumentLifecycleResponse restoreTrash(List<Long> documentIds) {
        requireAdmin();
        List<DocumentLifecycleResponse> successes = new ArrayList<>();
        List<BatchDocumentLifecycleFailure> failures = new ArrayList<>();
        for (Long documentId : distinctIds(documentIds)) {
            try {
                successes.add(restore(documentId));
            } catch (AppException exception) {
                failures.add(new BatchDocumentLifecycleFailure(documentId, exception.getCode(), exception.getMessage()));
            }
        }
        return new BatchDocumentLifecycleResponse(successes.size(), failures.size(), successes, failures);
    }

    @Transactional
    public DocumentLifecycleResponse retryIndexing(Long documentId) {
        User admin = requireAdmin();
        Document document = findDocument(documentId);
        DocumentContent content = contentRepository.findByDocumentId(documentId).orElse(null);
        
        boolean canRetry = document.getStatus() == DocumentStatus.EXTRACTION_FAILED
                || (content != null && content.getExtractionStatus() == DocumentExtractionStatus.FAILED);
                
        if (!canRetry) {
            throw invalidStatus("Only extraction failed documents can be retried");
        }
        OffsetDateTime now = OffsetDateTime.now();
        document.setStatus(DocumentStatus.PROCESSING);
        document.setUpdatedAt(now);
        Document saved = documentRepository.save(document);
        processingPublisher.publish(
                DocumentProcessingRabbitConfig.EXTRACT_ROUTING_KEY,
                DocumentProcessingMessage.extract(saved.getId(), null, saved.getStoragePath(), saved.getMimeType())
        );
        logAction(admin, saved, AccessLogAction.RETRY);
        return response(saved, null);
    }

    @Transactional
    public BatchOperationResponse batchArchive(List<Long> documentIds) {
        requireAdmin();
        List<BatchOperationItemResponse> items = new ArrayList<>();
        for (Long documentId : distinctIds(documentIds)) {
            try {
                DocumentLifecycleResponse response = archive(documentId);
                items.add(BatchOperationItemResponse.success(documentId, response.status()));
            } catch (AppException exception) {
                items.add(BatchOperationItemResponse.failure(documentId, exception.getCode(), exception.getMessage()));
            }
        }
        return BatchOperationResponse.from(items);
    }

    @Transactional
    public BatchOperationResponse batchDelete(List<Long> documentIds) {
        requireAdmin();
        List<BatchOperationItemResponse> items = new ArrayList<>();
        for (Long documentId : distinctIds(documentIds)) {
            try {
                softDelete(documentId);
                items.add(BatchOperationItemResponse.success(documentId, DocumentStatus.DELETED.name()));
            } catch (AppException exception) {
                items.add(BatchOperationItemResponse.failure(documentId, exception.getCode(), exception.getMessage()));
            }
        }
        return BatchOperationResponse.from(items);
    }

    @Transactional
    public BatchOperationResponse batchRestore(List<Long> documentIds) {
        requireAdmin();
        List<BatchOperationItemResponse> items = new ArrayList<>();
        for (Long documentId : distinctIds(documentIds)) {
            try {
                DocumentLifecycleResponse response = restore(documentId);
                items.add(BatchOperationItemResponse.success(documentId, response.status()));
            } catch (AppException exception) {
                items.add(BatchOperationItemResponse.failure(documentId, exception.getCode(), exception.getMessage()));
            }
        }
        return BatchOperationResponse.from(items);
    }

    @Transactional
    public BatchDocumentLifecycleResponse permanentDelete(List<Long> documentIds) {
        requireAdmin();
        return purgeDocuments(distinctIds(documentIds));
    }

    @Transactional(readOnly = true)
    public List<Long> expiredTrashDocumentIds(OffsetDateTime now) {
        return documentRepository.findByStatusAndPurgeAfterLessThanEqual(DocumentStatus.DELETED, now)
                .stream()
                .map(Document::getId)
                .toList();
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public BatchDocumentLifecycleResponse purgeDocuments(List<Long> documentIds) {
        List<DocumentLifecycleResponse> successes = new ArrayList<>();
        List<BatchDocumentLifecycleFailure> failures = new ArrayList<>();
        for (Long documentId : documentIds) {
            try {
                Document document = documentRepository.findById(documentId).orElse(null);
                if (document == null || document.getPermanentlyDeletedAt() != null) {
                    successes.add(new DocumentLifecycleResponse(documentId, "PURGED", null, null, null, null));
                    continue;
                }
                if (document.getStatus() != DocumentStatus.DELETED) {
                    throw invalidStatus("Only deleted documents can be permanently deleted");
                }
                purgeDocument(document);
                successes.add(response(documentRepository.save(document), null));
            } catch (AppException exception) {
                failures.add(new BatchDocumentLifecycleFailure(documentId, exception.getCode(), exception.getMessage()));
            }
        }
        return new BatchDocumentLifecycleResponse(successes.size(), failures.size(), successes, failures);
    }

    private void purgeDocument(Document document) {
        deleteObjectIfPresent(document.getStoragePath());
        deleteObjectIfPresent(document.getPreviewObjectKey());
        for (DocumentVersion version : versionRepository.findByDocumentId(document.getId())) {
            deleteObjectIfPresent(version.getStoragePath());
            deleteObjectIfPresent(version.getPreviewObjectKey());
        }
        try {
            contentRepository.deleteByDocumentId(document.getId());
        } catch (EmptyResultDataAccessException ignored) {
        }
        searchEngine.removeIndex(document.getId());
        OffsetDateTime now = OffsetDateTime.now();
        document.setPermanentlyDeletedAt(now);
        document.setUpdatedAt(now);
        logSystemAction(document, AccessLogAction.PURGE);
    }

    private DocumentLifecycleResponse restoreDeleted(Document document, User admin) {
        OffsetDateTime now = OffsetDateTime.now();
        DocumentStatus restoredStatus = restoredStatus(document.getPreviousStatus());
        document.setStatus(restoredStatus);
        document.setDeletedAt(null);
        document.setDeletedBy(null);
        document.setPurgeAfter(null);
        document.setPreviousStatus(null);
        document.setPermanentlyDeletedAt(null);
        document.setUpdatedAt(now);
        logAction(admin, document, AccessLogAction.RESTORE);
        return response(documentRepository.save(document), now);
    }

    private void moveToTrash(Document document, User admin, OffsetDateTime now) {
        document.setPreviousStatus(document.getStatus().name());
        document.setStatus(DocumentStatus.DELETED);
        document.setDeletedAt(now);
        document.setDeletedBy(admin.getId());
        document.setPurgeAfter(now.plus(trashProperties.retentionDuration()));
        document.setUpdatedAt(now);
        searchEngine.removeIndex(document.getId());
        logAction(admin, document, AccessLogAction.DELETE);
        documentRepository.save(document);
    }

    private void ensureCanMoveToTrash(Document document) {
        if (document.getStatus() != DocumentStatus.INDEXED
                && document.getStatus() != DocumentStatus.ARCHIVED
                && document.getStatus() != DocumentStatus.EXTRACTION_FAILED) {
            throw invalidStatus("Document cannot be deleted from status " + document.getStatus());
        }
    }

    private org.springframework.data.jpa.domain.Specification<Document> trashSpecification(DocumentSearchRequest request) {
        return (root, query, builder) -> {
            List<jakarta.persistence.criteria.Predicate> predicates = new ArrayList<>();
            predicates.add(builder.equal(root.get("status"), DocumentStatus.DELETED));
            predicates.add(builder.isNull(root.get("permanentlyDeletedAt")));
            if (request.categoryId() != null) {
                predicates.add(builder.equal(root.get("categoryId"), request.categoryId()));
            }
            if (request.uploadedBy() != null) {
                predicates.add(builder.equal(root.get("deletedBy"), request.uploadedBy()));
            }
            if (request.fileType() != null && !request.fileType().isBlank()) {
                predicates.add(builder.equal(builder.upper(root.get("fileType")), request.fileType().trim().toUpperCase()));
            }
            if (request.resolvedDateFrom() != null) {
                predicates.add(builder.greaterThanOrEqualTo(root.get("deletedAt"), request.resolvedDateFrom().atStartOfDay().atOffset(OffsetDateTime.now().getOffset())));
            }
            if (request.resolvedDateTo() != null) {
                predicates.add(builder.lessThan(root.get("deletedAt"), request.resolvedDateTo().plusDays(1).atStartOfDay().atOffset(OffsetDateTime.now().getOffset())));
            }
            return builder.and(predicates.toArray(jakarta.persistence.criteria.Predicate[]::new));
        };
    }

    private TrashDocumentResponse trashResponse(Document document) {
        return new TrashDocumentResponse(
                document.getId(),
                document.getTitle(),
                document.getDocumentCode(),
                document.getFileName(),
                document.getFileType(),
                document.getFileSize(),
                document.getStatus().name(),
                document.getPreviousStatus(),
                document.getCategoryId(),
                document.getDeletedBy(),
                document.getDeletedAt(),
                document.getPurgeAfter(),
                daysUntilPurge(document)
        );
    }

    private long daysUntilPurge(Document document) {
        if (document.getPurgeAfter() == null) {
            return 0;
        }
        return Math.max(0, ChronoUnit.DAYS.between(OffsetDateTime.now(), document.getPurgeAfter()));
    }

    private Pageable pageable(DocumentSearchRequest request) {
        int page = request.page() == null || request.page() < 0 ? DEFAULT_PAGE : request.page();
        int size = request.size() == null || request.size() < 1 ? DEFAULT_SIZE : Math.min(request.size(), MAX_SIZE);
        return PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "deletedAt"));
    }

    private DocumentStatus restoredStatus(String previousStatus) {
        if (previousStatus == null || previousStatus.isBlank()) {
            return DocumentStatus.PROCESSING;
        }
        try {
            DocumentStatus status = DocumentStatus.valueOf(previousStatus);
            return status == DocumentStatus.DELETED ? DocumentStatus.PROCESSING : status;
        } catch (IllegalArgumentException exception) {
            return DocumentStatus.PROCESSING;
        }
    }

    private List<Long> distinctIds(List<Long> documentIds) {
        return documentIds.stream().distinct().toList();
    }

    private Document findDocument(Long documentId) {
        return documentRepository.findById(documentId)
                .orElseThrow(() -> new AppException(ErrorCodes.DOCUMENT_NOT_FOUND, "Document not found", HttpStatus.NOT_FOUND));
    }

    private User requireAdmin() {
        User user = currentUserProvider.getRequiredUser();
        if (user.getRole() != Role.ADMIN) {
            throw new AppException(ErrorCodes.ACCESS_DENIED, "Admin role is required", HttpStatus.FORBIDDEN);
        }
        return user;
    }

    private AppException invalidStatus(String message) {
        return new AppException(ErrorCodes.INVALID_DOCUMENT_STATUS, message, HttpStatus.CONFLICT);
    }

    private DocumentLifecycleResponse response(Document document, OffsetDateTime restoredAt) {
        return new DocumentLifecycleResponse(
                document.getId(),
                document.getPermanentlyDeletedAt() == null ? document.getStatus().name() : "PURGED",
                document.getArchivedAt(),
                document.getDeletedAt(),
                document.getPurgeAfter(),
                restoredAt
        );
    }

    private void deleteObjectIfPresent(String objectKey) {
        if (objectKey == null || objectKey.isBlank()) {
            return;
        }
        objectStorageService.deleteObject(objectKey);
    }

    private void logAction(User user, Document document, AccessLogAction action) {
        AccessLog log = new AccessLog();
        log.setUserId(user.getId());
        log.setDocumentId(document.getId());
        log.setAction(action);
        log.setAccessGranted(true);
        accessLogRepository.save(log);
    }

    private void logSystemAction(Document document, AccessLogAction action) {
        if (document.getDeletedBy() == null) {
            return;
        }
        AccessLog log = new AccessLog();
        log.setUserId(document.getDeletedBy());
        log.setDocumentId(document.getId());
        log.setAction(action);
        log.setAccessGranted(true);
        accessLogRepository.save(log);
    }
}
