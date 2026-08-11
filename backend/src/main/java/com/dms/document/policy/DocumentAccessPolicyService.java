package com.dms.document.policy;

import com.dms.category.policy.CategoryAccessPolicyService;
import com.dms.document.entity.Document;
import com.dms.document.entity.DocumentAccessLevel;
import com.dms.document.entity.DocumentStatus;
import com.dms.document.entity.DocumentVersion;
import com.dms.document.repository.DocumentDepartmentAccessRepository;
import com.dms.document.repository.DocumentUserAccessRepository;
import com.dms.identity.entity.Role;
import com.dms.identity.entity.User;
import org.springframework.stereotype.Service;

@Service
public class DocumentAccessPolicyService {
    private static final String USER_NOT_ACTIVE = "USER_NOT_ACTIVE";
    private static final String DOCUMENT_NOT_READY = "DOCUMENT_NOT_READY";
    private static final String ACCESS_DENIED = "ACCESS_DENIED";
    private static final String VERSION_NOT_READY = "VERSION_NOT_READY";

    private final DocumentDepartmentAccessRepository departmentAccessRepository;
    private final DocumentUserAccessRepository userAccessRepository;
    private final CategoryAccessPolicyService categoryAccessPolicyService;

    public DocumentAccessPolicyService(
            DocumentDepartmentAccessRepository departmentAccessRepository,
            DocumentUserAccessRepository userAccessRepository,
            CategoryAccessPolicyService categoryAccessPolicyService
    ) {
        this.departmentAccessRepository = departmentAccessRepository;
        this.userAccessRepository = userAccessRepository;
        this.categoryAccessPolicyService = categoryAccessPolicyService;
    }

    public AccessDecision canViewMetadata(User user, Document document) {
        AccessDecision userDecision = ensureActiveUser(user);
        if (!userDecision.granted()) {
            return userDecision;
        }
        if (document == null || document.getStatus() == null
                || document.getStatus() == DocumentStatus.DELETED
                || document.getStatus() == DocumentStatus.ARCHIVED) {
            return AccessDecision.denied(DOCUMENT_NOT_READY);
        }
        return evaluateAudience(user, document);
    }

    public AccessDecision canPreview(User user, Document document) {
        AccessDecision userDecision = ensureActiveUser(user);
        if (!userDecision.granted()) {
            return userDecision;
        }
        if (!canUseDocumentStatus(user, document, true)) {
            return AccessDecision.denied(DOCUMENT_NOT_READY);
        }
        return evaluateAudience(user, document);
    }

    public AccessDecision canDownload(User user, Document document) {
        AccessDecision userDecision = ensureActiveUser(user);
        if (!userDecision.granted()) {
            return userDecision;
        }
        if (!canUseDocumentStatus(user, document, true)) {
            return AccessDecision.denied(DOCUMENT_NOT_READY);
        }
        return evaluateAudience(user, document);
    }

    public AccessDecision canDownloadVersion(User user, Document document, DocumentVersion version) {
        AccessDecision documentDecision = canDownload(user, document);
        if (!documentDecision.granted()) {
            return documentDecision;
        }
        if (version == null || !document.getId().equals(version.getDocumentId()) || version.getStatus() != DocumentStatus.INDEXED) {
            return AccessDecision.denied(VERSION_NOT_READY);
        }
        return AccessDecision.allow();
    }

    public AccessDecision canUseAudience(User user, Document document) {
        AccessDecision userDecision = ensureActiveUser(user);
        if (!userDecision.granted()) {
            return userDecision;
        }
        return evaluateAudience(user, document);
    }

    private AccessDecision ensureActiveUser(User user) {
        if (user == null || !user.isEnabled()) {
            return AccessDecision.denied(USER_NOT_ACTIVE);
        }
        return AccessDecision.allow();
    }

    private boolean canUseDocumentStatus(User user, Document document, boolean allowArchivedAdmin) {
        if (document == null || document.getStatus() == null || document.getStatus() == DocumentStatus.DELETED) {
            return false;
        }
        if (document.getStatus() == DocumentStatus.INDEXED) {
            return true;
        }
        return allowArchivedAdmin && user.getRole() == Role.ADMIN && document.getStatus() == DocumentStatus.ARCHIVED;
    }

    private AccessDecision evaluateAudience(User user, Document document) {
        if (document == null || document.getAccessLevel() == null) {
            return AccessDecision.denied(ACCESS_DENIED);
        }
        if (user.getRole() == Role.ADMIN) {
            return AccessDecision.allow();
        }
        if (document.getAccessLevel() == DocumentAccessLevel.PUBLIC) {
            return AccessDecision.allow();
        }
        if (document.getAccessLevel() != DocumentAccessLevel.RESTRICTED) {
            return AccessDecision.denied(ACCESS_DENIED);
        }
        if (user.getId() != null && user.getId().equals(document.getOwnerId())) {
            return AccessDecision.allow();
        }
        if (user.getId() != null && userAccessRepository.existsByDocumentIdAndUserId(document.getId(), user.getId())) {
            return AccessDecision.allow();
        }
        if (user.getDepartmentId() != null && departmentAccessRepository.existsByDocumentIdAndDepartmentId(document.getId(), user.getDepartmentId())) {
            return AccessDecision.allow();
        }
        if (categoryAccessPolicyService.hasCategoryAudience(user, document.getCategoryId())) {
            return AccessDecision.allow();
        }
        return AccessDecision.denied(ACCESS_DENIED);
    }
}
