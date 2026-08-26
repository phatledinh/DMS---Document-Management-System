package com.dms.approval.service;

import com.dms.approval.dto.ApprovalDecisionResponse;
import com.dms.approval.dto.ApprovalItemResponse;
import com.dms.approval.dto.ApprovalSummaryResponse;
import com.dms.approval.repository.AdminApprovalRepository;
import com.dms.audit.service.AuditLogService;
import com.dms.common.exception.AppException;
import com.dms.common.exception.ErrorCodes;
import com.dms.document.dto.PageResponse;
import com.dms.document.entity.Document;
import com.dms.document.entity.DocumentStatus;
import com.dms.document.repository.DocumentRepository;
import com.dms.document.repository.DocumentVersionRepository;
import com.dms.document.service.DocumentLifecycleService;
import com.dms.identity.entity.User;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.Map;

@Service
public class AdminApprovalService {
    private static final int DEFAULT_PAGE = 0;
    private static final int DEFAULT_SIZE = 20;
    private static final int MAX_SIZE = 100;

    private final AdminApprovalRepository approvalRepository;
    private final DocumentRepository documentRepository;
    private final AuditLogService auditLogService;
    private final DocumentLifecycleService lifecycleService;
    private final DocumentVersionRepository versionRepository;

    public AdminApprovalService(
            AdminApprovalRepository approvalRepository,
            DocumentRepository documentRepository,
            AuditLogService auditLogService,
            DocumentLifecycleService lifecycleService,
            DocumentVersionRepository versionRepository
    ) {
        this.approvalRepository = approvalRepository;
        this.documentRepository = documentRepository;
        this.auditLogService = auditLogService;
        this.lifecycleService = lifecycleService;
        this.versionRepository = versionRepository;
    }

    @Transactional(readOnly = true)
    public PageResponse<ApprovalItemResponse> search(String status, String keyword, String department, String category, Integer page, Integer size) {
        return approvalRepository.search(status, keyword, department, category, page(page), size(size));
    }

    @Transactional(readOnly = true)
    public ApprovalSummaryResponse summary() {
        return approvalRepository.summary();
    }

    @Transactional
    public ApprovalDecisionResponse approve(Long documentId, User admin) {
        Document document = findDocument(documentId);
        DocumentStatus previous = document.getStatus();
        document.setStatus(DocumentStatus.INDEXED);
        document.setUpdatedAt(OffsetDateTime.now());
        Document saved = documentRepository.save(document);
        
        if (saved.getCurrentVersionId() != null) {
            versionRepository.findById(saved.getCurrentVersionId()).ifPresent(version -> {
                version.setStatus(DocumentStatus.INDEXED);
                versionRepository.save(version);
            });
        }
        
        auditLogService.log(admin, "APPROVE_DOCUMENT", "DOCUMENT", saved.getId(), Map.of("status", previous.name()), Map.of("status", saved.getStatus().name()));
        return new ApprovalDecisionResponse(saved.getId(), saved.getStatus().name());
    }

    @Transactional
    public ApprovalDecisionResponse reject(Long documentId, String reason, User admin) {
        Document document = findDocument(documentId);
        DocumentStatus previous = document.getStatus();
        lifecycleService.forcePurgeDocument(documentId, admin);
        auditLogService.log(admin, "REJECT_DOCUMENT", "DOCUMENT", documentId, Map.of("status", previous.name()), Map.of("status", "PURGED", "reason", reason == null ? "" : reason));
        return new ApprovalDecisionResponse(documentId, "PURGED");
    }

    private Document findDocument(Long documentId) {
        return documentRepository.findById(documentId)
                .filter(document -> document.getPermanentlyDeletedAt() == null)
                .orElseThrow(() -> new AppException(ErrorCodes.DOCUMENT_NOT_FOUND, "Document not found", HttpStatus.NOT_FOUND));
    }

    private int page(Integer page) {
        return page == null || page < 0 ? DEFAULT_PAGE : page;
    }

    private int size(Integer size) {
        return size == null || size < 1 ? DEFAULT_SIZE : Math.min(size, MAX_SIZE);
    }
}
