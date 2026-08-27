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
import com.dms.identity.entity.User;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.Map;

import com.dms.document.processing.DocumentContentService;
import com.dms.document.processing.PostgresSearchEngine;
import com.dms.document.processing.ExtractedDocumentText;
import com.dms.document.entity.DocumentVersion;

@Service
public class AdminApprovalService {
    private static final int DEFAULT_PAGE = 0;
    private static final int DEFAULT_SIZE = 20;
    private static final int MAX_SIZE = 100;

    private final AdminApprovalRepository approvalRepository;
    private final DocumentRepository documentRepository;
    private final AuditLogService auditLogService;
    private final DocumentVersionRepository versionRepository;
    private final DocumentContentService contentService;
    private final PostgresSearchEngine searchEngine;

    public AdminApprovalService(
            AdminApprovalRepository approvalRepository,
            DocumentRepository documentRepository,
            AuditLogService auditLogService,
            DocumentVersionRepository versionRepository,
            DocumentContentService contentService,
            PostgresSearchEngine searchEngine
    ) {
        this.approvalRepository = approvalRepository;
        this.documentRepository = documentRepository;
        this.auditLogService = auditLogService;
        this.versionRepository = versionRepository;
        this.contentService = contentService;
        this.searchEngine = searchEngine;
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
    public ApprovalDecisionResponse approve(Long documentId, Long versionId, User admin) {
        Document document = findDocument(documentId);
        DocumentVersion version = versionRepository.findByIdAndDocumentId(versionId, documentId)
                .orElseThrow(() -> new AppException(ErrorCodes.VERSION_NOT_FOUND, "Version not found", HttpStatus.NOT_FOUND));

        if (version.getStatus() != DocumentStatus.PENDING_APPROVAL) {
            throw new AppException(ErrorCodes.VALIDATION_ERROR, "Version is not pending approval", HttpStatus.BAD_REQUEST);
        }

        DocumentStatus previous = document.getStatus();
        
        version.setStatus(DocumentStatus.INDEXED);
        versionRepository.save(version);
        
        document.setStatus(DocumentStatus.INDEXED);
        document.setCurrentVersionId(version.getId());
        document.setVersionNumber(version.getVersionNumber());
        document.setFileName(version.getFileName());
        document.setFileType(version.getFileName().substring(version.getFileName().lastIndexOf('.') + 1).toUpperCase());
        document.setMimeType(version.getMimeType());
        document.setFileSize(version.getFileSize());
        document.setStoragePath(version.getStoragePath());
        document.setPreviewObjectKey(version.getPreviewObjectKey());
        document.setUpdatedAt(OffsetDateTime.now());
        Document saved = documentRepository.save(document);

        if (version.getExtractedText() != null) {
            ExtractedDocumentText extractedText = new ExtractedDocumentText(version.getExtractedText(), "MANUAL", "vi");
            contentService.saveSuccess(document.getId(), extractedText, 1);
            searchEngine.refreshIndex(document, version.getExtractedText());
        }

        auditLogService.log(admin, "APPROVE_DOCUMENT", "DOCUMENT", saved.getId(), Map.of("status", previous.name()), Map.of("status", saved.getStatus().name(), "versionId", versionId));
        return new ApprovalDecisionResponse(saved.getId(), version.getId(), saved.getStatus().name());
    }

    @Transactional
    public ApprovalDecisionResponse reject(Long documentId, Long versionId, String reason, User admin) {
        Document document = findDocument(documentId); // ensure document exists and is not deleted
        DocumentVersion version = versionRepository.findByIdAndDocumentId(versionId, documentId)
                .orElseThrow(() -> new AppException(ErrorCodes.VERSION_NOT_FOUND, "Version not found", HttpStatus.NOT_FOUND));

        if (version.getStatus() != DocumentStatus.PENDING_APPROVAL) {
            throw new AppException(ErrorCodes.VALIDATION_ERROR, "Version is not pending approval", HttpStatus.BAD_REQUEST);
        }

        DocumentStatus previous = version.getStatus();
        version.setStatus(DocumentStatus.REJECTED);
        version.setRejectReason(reason);
        versionRepository.save(version);
        
        if (document.getCurrentVersionId() == null) {
            document.setStatus(DocumentStatus.REJECTED);
            document.setUpdatedAt(OffsetDateTime.now());
            documentRepository.save(document);
        }
        
        auditLogService.log(admin, "REJECT_DOCUMENT", "DOCUMENT", documentId, Map.of("status", previous.name()), Map.of("status", "REJECTED", "reason", reason == null ? "" : reason, "versionId", versionId));
        return new ApprovalDecisionResponse(documentId, version.getId(), "REJECTED");
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
