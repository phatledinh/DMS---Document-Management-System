package com.dms.document.policy;

import com.dms.category.entity.CategoryPermission;
import com.dms.category.policy.CategoryAccessPolicyService;
import com.dms.document.entity.Document;
import com.dms.document.entity.DocumentStatus;
import com.dms.document.entity.DocumentVersion;
import com.dms.identity.entity.Role;
import com.dms.identity.entity.User;
import org.springframework.stereotype.Service;

@Service
public class DocumentAccessPolicyService {
    private static final String USER_NOT_ACTIVE = "USER_NOT_ACTIVE";
    private static final String DOCUMENT_NOT_READY = "DOCUMENT_NOT_READY";
    private static final String ACCESS_DENIED = "ACCESS_DENIED";
    private static final String VERSION_NOT_READY = "VERSION_NOT_READY";

    private final CategoryAccessPolicyService categoryAccessPolicyService;

    public DocumentAccessPolicyService(CategoryAccessPolicyService categoryAccessPolicyService) {
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
        return evaluateCategoryPermission(user, document, CategoryPermission.VIEW);
    }

    public AccessDecision canPreview(User user, Document document) {
        AccessDecision userDecision = ensureActiveUser(user);
        if (!userDecision.granted()) {
            return userDecision;
        }
        if (!canUseDocumentStatus(user, document, true)) {
            return AccessDecision.denied(DOCUMENT_NOT_READY);
        }
        return evaluateCategoryPermission(user, document, CategoryPermission.VIEW);
    }

    public AccessDecision canDownload(User user, Document document) {
        AccessDecision userDecision = ensureActiveUser(user);
        if (!userDecision.granted()) {
            return userDecision;
        }
        if (!canUseDocumentStatus(user, document, true)) {
            return AccessDecision.denied(DOCUMENT_NOT_READY);
        }
        AccessDecision viewDecision = evaluateCategoryPermission(user, document, CategoryPermission.VIEW);
        if (!viewDecision.granted()) {
            return viewDecision;
        }
        return evaluateCategoryPermission(user, document, CategoryPermission.DOWNLOAD);
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

    public AccessDecision canUpload(User user, Long categoryId) {
        AccessDecision userDecision = ensureActiveUser(user);
        if (!userDecision.granted()) {
            return userDecision;
        }
        return evaluateCategoryPermission(user, categoryId, CategoryPermission.UPLOAD);
    }

    public AccessDecision canEdit(User user, Document document) {
        AccessDecision userDecision = ensureActiveUser(user);
        if (!userDecision.granted()) {
            return userDecision;
        }
        return evaluateCategoryPermission(user, document, CategoryPermission.EDIT);
    }

    public AccessDecision canDelete(User user, Document document) {
        AccessDecision userDecision = ensureActiveUser(user);
        if (!userDecision.granted()) {
            return userDecision;
        }
        return evaluateCategoryPermission(user, document, CategoryPermission.DELETE);
    }

    public AccessDecision canUseAudience(User user, Document document) {
        return canViewMetadata(user, document);
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
        if (document.getStatus() == DocumentStatus.PENDING_APPROVAL) {
            return user.getRole() == Role.ADMIN || (document.getUploadedBy() != null && document.getUploadedBy().equals(user.getId()));
        }
        return allowArchivedAdmin && user.getRole() == Role.ADMIN && document.getStatus() == DocumentStatus.ARCHIVED;
    }

    private AccessDecision evaluateCategoryPermission(User user, Document document, CategoryPermission permission) {
        if (document == null) {
            return AccessDecision.denied(ACCESS_DENIED);
        }
        return evaluateCategoryPermission(user, document.getCategoryId(), permission);
    }

    private AccessDecision evaluateCategoryPermission(User user, Long categoryId, CategoryPermission permission) {
        if (categoryId == null) {
            return AccessDecision.denied(ACCESS_DENIED);
        }
        if (categoryAccessPolicyService.hasPermission(user, categoryId, permission)) {
            return AccessDecision.allow();
        }
        return AccessDecision.denied(ACCESS_DENIED);
    }
}
