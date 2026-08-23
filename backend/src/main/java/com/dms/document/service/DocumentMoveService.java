package com.dms.document.service;

import com.dms.common.exception.AppException;
import com.dms.common.exception.ErrorCodes;
import com.dms.common.security.CurrentUserProvider;
import com.dms.document.dto.BatchMoveDocumentsRequest;
import com.dms.document.dto.BatchOperationItemResponse;
import com.dms.document.dto.BatchOperationResponse;
import com.dms.document.entity.AccessLog;
import com.dms.document.entity.AccessLogAction;
import com.dms.document.entity.Document;
import com.dms.document.entity.DocumentStatus;
import com.dms.document.processing.PostgresSearchEngine;
import com.dms.document.repository.AccessLogRepository;
import com.dms.document.repository.DocumentRepository;
import com.dms.identity.entity.Role;
import com.dms.identity.entity.User;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
public class DocumentMoveService {
    private final DocumentRepository documentRepository;
    private final AccessLogRepository accessLogRepository;
    private final CurrentUserProvider currentUserProvider;
    private final PostgresSearchEngine searchEngine;

    public DocumentMoveService(
            DocumentRepository documentRepository,
            AccessLogRepository accessLogRepository,
            CurrentUserProvider currentUserProvider,
            PostgresSearchEngine searchEngine
    ) {
        this.documentRepository = documentRepository;
        this.accessLogRepository = accessLogRepository;
        this.currentUserProvider = currentUserProvider;
        this.searchEngine = searchEngine;
    }

    @Transactional
    public BatchOperationResponse batchMove(BatchMoveDocumentsRequest request) {
        User admin = requireAdmin();
        List<BatchOperationItemResponse> items = new ArrayList<>();
        for (Long documentId : request.documentIds().stream().distinct().toList()) {
            try {
                items.add(moveOne(documentId, request.targetCategoryId(), admin));
            } catch (AppException exception) {
                items.add(BatchOperationItemResponse.failure(documentId, exception.getCode(), exception.getMessage()));
            }
        }
        return BatchOperationResponse.from(items);
    }

    private BatchOperationItemResponse moveOne(Long documentId, Long targetCategoryId, User admin) {
        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new AppException(ErrorCodes.DOCUMENT_NOT_FOUND, "Document not found", HttpStatus.NOT_FOUND));
        if (document.getPermanentlyDeletedAt() != null || document.getStatus() == DocumentStatus.DELETED) {
            throw new AppException(ErrorCodes.DOCUMENT_NOT_FOUND, "Document not found", HttpStatus.NOT_FOUND);
        }
        Long previousCategoryId = document.getCategoryId();
        document.setCategoryId(targetCategoryId);
        document.setUpdatedAt(OffsetDateTime.now());
        documentRepository.save(document);
        if (document.getStatus() == DocumentStatus.INDEXED) {
            searchEngine.removeIndex(document.getId());
        }
        logMove(admin, document);
        return BatchOperationItemResponse.moved(document.getId(), previousCategoryId, targetCategoryId);
    }

    private User requireAdmin() {
        User user = currentUserProvider.getRequiredUser();
        if (user.getRole() != Role.ADMIN) {
            throw new AppException(ErrorCodes.ACCESS_DENIED, "Admin role is required", HttpStatus.FORBIDDEN);
        }
        return user;
    }

    private void logMove(User user, Document document) {
        AccessLog log = new AccessLog();
        log.setUserId(user.getId());
        log.setDocumentId(document.getId());
        log.setAction(AccessLogAction.MOVE);
        log.setAccessGranted(true);
        populateRequestInfo(log);
        accessLogRepository.save(log);
    }

    private void populateRequestInfo(AccessLog log) {
        if (org.springframework.web.context.request.RequestContextHolder.getRequestAttributes() instanceof org.springframework.web.context.request.ServletRequestAttributes attributes) {
            jakarta.servlet.http.HttpServletRequest request = attributes.getRequest();
            String forwardedFor = request.getHeader("X-Forwarded-For");
            if (forwardedFor != null && !forwardedFor.isBlank()) {
                log.setIpAddress(forwardedFor.split(",")[0].trim());
            } else {
                log.setIpAddress(request.getRemoteAddr());
            }
            log.setUserAgent(request.getHeader("User-Agent"));
        }
    }
}
