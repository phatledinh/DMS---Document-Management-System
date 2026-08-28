package com.dms.document.policy;

import com.dms.category.entity.CategoryPermission;
import com.dms.category.policy.CategoryAccessPolicyService;
import com.dms.document.entity.Document;
import com.dms.document.entity.DocumentStatus;
import com.dms.document.entity.DocumentVersion;
import com.dms.identity.entity.Role;
import com.dms.identity.entity.User;
import com.dms.identity.entity.UserStatus;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DocumentAccessPolicyServiceTest {
    @Mock
    private CategoryAccessPolicyService categoryAccessPolicyService;

    @InjectMocks
    private DocumentAccessPolicyService policyService;

    @Test
    @DisplayName("INDEXED document is visible when category grants VIEW")
    void canViewMetadata_categoryViewGranted_granted() {
        User user = user(10L, Role.USER, UserStatus.ACTIVE);
        Document document = document(1L, 200L, DocumentStatus.INDEXED);
        when(categoryAccessPolicyService.hasPermission(user, 200L, CategoryPermission.VIEW)).thenReturn(true);

        AccessDecision decision = policyService.canViewMetadata(user, document);

        assertThat(decision.granted()).isTrue();
    }

    @Test
    @DisplayName("INDEXED document is denied when category lacks VIEW")
    void canViewMetadata_categoryViewMissing_denied() {
        User user = user(10L, Role.USER, UserStatus.ACTIVE);
        Document document = document(1L, 200L, DocumentStatus.INDEXED);

        AccessDecision decision = policyService.canViewMetadata(user, document);

        assertThat(decision.granted()).isFalse();
        assertThat(decision.denialReason()).isEqualTo("ACCESS_DENIED");
    }

    @Test
    @DisplayName("Document is denied to inactive user")
    void canViewMetadata_inactiveUser_denied() {
        User user = user(10L, Role.USER, UserStatus.INACTIVE);
        Document document = document(1L, 200L, DocumentStatus.INDEXED);

        AccessDecision decision = policyService.canViewMetadata(user, document);

        assertThat(decision.granted()).isFalse();
        assertThat(decision.denialReason()).isEqualTo("USER_NOT_ACTIVE");
    }

    @Test
    @DisplayName("ARCHIVED document preview is granted to admin")
    void canPreview_archivedAdmin_granted() {
        User admin = user(10L, Role.ADMIN, UserStatus.ACTIVE);
        Document document = document(1L, 200L, DocumentStatus.ARCHIVED);
        when(categoryAccessPolicyService.hasPermission(admin, 200L, CategoryPermission.VIEW)).thenReturn(true);

        AccessDecision decision = policyService.canPreview(admin, document);

        assertThat(decision.granted()).isTrue();
    }

    @Test
    @DisplayName("ARCHIVED document metadata is not in default user-facing view")
    void canViewMetadata_archivedAdmin_denied() {
        User admin = user(10L, Role.ADMIN, UserStatus.ACTIVE);
        Document document = document(1L, 200L, DocumentStatus.ARCHIVED);

        AccessDecision decision = policyService.canViewMetadata(admin, document);

        assertThat(decision.granted()).isFalse();
        assertThat(decision.denialReason()).isEqualTo("DOCUMENT_NOT_READY");
    }

    @Test
    @DisplayName("PROCESSING document download is denied to admin")
    void canDownload_processingAdmin_denied() {
        User admin = user(10L, Role.ADMIN, UserStatus.ACTIVE);
        Document document = document(1L, 200L, DocumentStatus.PROCESSING);

        AccessDecision decision = policyService.canDownload(admin, document);

        assertThat(decision.granted()).isFalse();
        assertThat(decision.denialReason()).isEqualTo("DOCUMENT_NOT_READY");
    }

    @Test
    @DisplayName("Download requires VIEW and DOWNLOAD on category")
    void canDownload_requiresViewAndDownload() {
        User user = user(10L, Role.USER, UserStatus.ACTIVE);
        Document document = document(1L, 200L, DocumentStatus.INDEXED);
        when(categoryAccessPolicyService.hasPermission(user, 200L, CategoryPermission.VIEW)).thenReturn(true);
        when(categoryAccessPolicyService.hasPermission(user, 200L, CategoryPermission.DOWNLOAD)).thenReturn(true);

        AccessDecision decision = policyService.canDownload(user, document);

        assertThat(decision.granted()).isTrue();
    }

    @Test
    @DisplayName("Download is denied when DOWNLOAD is missing")
    void canDownload_downloadMissing_denied() {
        User user = user(10L, Role.USER, UserStatus.ACTIVE);
        Document document = document(1L, 200L, DocumentStatus.INDEXED);
        when(categoryAccessPolicyService.hasPermission(user, 200L, CategoryPermission.VIEW)).thenReturn(true);

        AccessDecision decision = policyService.canDownload(user, document);

        assertThat(decision.granted()).isFalse();
        assertThat(decision.denialReason()).isEqualTo("ACCESS_DENIED");
    }

    @Test
    @DisplayName("Version download requires INDEXED version from same document")
    void canDownloadVersion_versionDifferentDocument_denied() {
        User admin = user(10L, Role.ADMIN, UserStatus.ACTIVE);
        Document document = document(1L, 200L, DocumentStatus.INDEXED);
        DocumentVersion version = version(2L, DocumentStatus.INDEXED);
        when(categoryAccessPolicyService.hasPermission(admin, 200L, CategoryPermission.VIEW)).thenReturn(true);
        when(categoryAccessPolicyService.hasPermission(admin, 200L, CategoryPermission.DOWNLOAD)).thenReturn(true);

        AccessDecision decision = policyService.canDownloadVersion(admin, document, version);

        assertThat(decision.granted()).isFalse();
        assertThat(decision.denialReason()).isEqualTo("VERSION_NOT_READY");
    }

    @Test
    @DisplayName("Edit requires VIEW and EDIT on category")
    void canEdit_requiresViewAndEdit() {
        User user = user(10L, Role.USER, UserStatus.ACTIVE);
        Document document = document(1L, 200L, DocumentStatus.INDEXED);
        when(categoryAccessPolicyService.hasPermission(user, 200L, CategoryPermission.VIEW)).thenReturn(true);
        when(categoryAccessPolicyService.hasPermission(user, 200L, CategoryPermission.EDIT)).thenReturn(true);

        assertThat(policyService.canEdit(user, document).granted()).isTrue();
    }

    @Test
    @DisplayName("Edit is denied when VIEW is missing even if EDIT is granted")
    void canEdit_viewMissing_denied() {
        User user = user(10L, Role.USER, UserStatus.ACTIVE);
        Document document = document(1L, 200L, DocumentStatus.INDEXED);
        when(categoryAccessPolicyService.hasPermission(user, 200L, CategoryPermission.EDIT)).thenReturn(true);

        AccessDecision decision = policyService.canEdit(user, document);

        assertThat(decision.granted()).isFalse();
        assertThat(decision.denialReason()).isEqualTo("ACCESS_DENIED");
    }

    @Test
    @DisplayName("Delete is denied when VIEW is missing even if DELETE is granted")
    void canDelete_viewMissing_denied() {
        User user = user(10L, Role.USER, UserStatus.ACTIVE);
        Document document = document(1L, 200L, DocumentStatus.INDEXED);
        when(categoryAccessPolicyService.hasPermission(user, 200L, CategoryPermission.DELETE)).thenReturn(true);

        AccessDecision decision = policyService.canDelete(user, document);

        assertThat(decision.granted()).isFalse();
        assertThat(decision.denialReason()).isEqualTo("ACCESS_DENIED");
    }

    @Test
    @DisplayName("Upload remains independent from VIEW")
    void canUpload_withoutView_grantedWhenUploadPermissionExists() {
        User user = user(10L, Role.USER, UserStatus.ACTIVE);
        when(categoryAccessPolicyService.hasPermission(user, 200L, CategoryPermission.UPLOAD)).thenReturn(true);

        assertThat(policyService.canUpload(user, 200L).granted()).isTrue();
    }
    private User user(Long id, Role role, UserStatus status) {
        User user = new User();
        user.setId(id);
        user.setName("User " + id);
        user.setEmail("user" + id + "@example.com");
        user.setPassword("password");
        user.setRole(role);
        user.setStatus(status);
        return user;
    }

    private Document document(Long id, Long categoryId, DocumentStatus status) {
        Document document = new Document();
        document.setId(id);
        document.setTitle("Document " + id);
        document.setSlug("document-" + id);
        document.setCategoryId(categoryId);
        document.setUploadedBy(20L);
        document.setOwnerId(20L);
        document.setFileName("document.pdf");
        document.setFileType("pdf");
        document.setMimeType("application/pdf");
        document.setFileSize(1024L);
        document.setStoragePath("documents/document.pdf");
        document.setStatus(status);
        return document;
    }

    private DocumentVersion version(Long documentId, DocumentStatus status) {
        DocumentVersion version = new DocumentVersion();
        version.setId(1L);
        version.setDocumentId(documentId);
        version.setVersionNumber("1.0");
        version.setFileName("document.pdf");
        version.setFileSize(1024L);
        version.setMimeType("application/pdf");
        version.setStoragePath("documents/version.pdf");
        version.setUploadedBy(10L);
        version.setStatus(status);
        return version;
    }
}
