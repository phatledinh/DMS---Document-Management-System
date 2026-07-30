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
import com.dms.identity.entity.UserStatus;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DocumentAccessPolicyServiceTest {
    @Mock
    private DocumentDepartmentAccessRepository departmentAccessRepository;

    @Mock
    private DocumentUserAccessRepository userAccessRepository;

    @Mock
    private CategoryAccessPolicyService categoryAccessPolicyService;

    @InjectMocks
    private DocumentAccessPolicyService policyService;

    @Test
    @DisplayName("PUBLIC INDEXED document is visible to active user")
    void canViewMetadata_publicIndexedActiveUser_granted() {
        User user = user(10L, Role.USER, 100L, UserStatus.ACTIVE);
        Document document = document(1L, 20L, 200L, DocumentAccessLevel.PUBLIC, DocumentStatus.INDEXED);

        AccessDecision decision = policyService.canViewMetadata(user, document);

        assertThat(decision.granted()).isTrue();
    }

    @Test
    @DisplayName("PUBLIC document is denied to inactive user")
    void canViewMetadata_publicInactiveUser_denied() {
        User user = user(10L, Role.USER, 100L, UserStatus.INACTIVE);
        Document document = document(1L, 20L, 200L, DocumentAccessLevel.PUBLIC, DocumentStatus.INDEXED);

        AccessDecision decision = policyService.canViewMetadata(user, document);

        assertThat(decision.granted()).isFalse();
        assertThat(decision.denialReason()).isEqualTo("USER_NOT_ACTIVE");
    }

    @Test
    @DisplayName("RESTRICTED document is visible to owner")
    void canViewMetadata_restrictedOwner_granted() {
        User user = user(20L, Role.USER, 100L, UserStatus.ACTIVE);
        Document document = document(1L, 20L, 200L, DocumentAccessLevel.RESTRICTED, DocumentStatus.INDEXED);

        AccessDecision decision = policyService.canViewMetadata(user, document);

        assertThat(decision.granted()).isTrue();
    }

    @Test
    @DisplayName("RESTRICTED document is visible to directly shared user")
    void canViewMetadata_restrictedDirectSharedUser_granted() {
        User user = user(10L, Role.USER, 100L, UserStatus.ACTIVE);
        Document document = document(1L, 20L, 200L, DocumentAccessLevel.RESTRICTED, DocumentStatus.INDEXED);
        when(userAccessRepository.existsByDocumentIdAndUserId(1L, 10L)).thenReturn(true);

        AccessDecision decision = policyService.canViewMetadata(user, document);

        assertThat(decision.granted()).isTrue();
    }

    @Test
    @DisplayName("RESTRICTED document is visible to user in shared department")
    void canViewMetadata_restrictedDepartmentAudience_granted() {
        User user = user(10L, Role.USER, 100L, UserStatus.ACTIVE);
        Document document = document(1L, 20L, 200L, DocumentAccessLevel.RESTRICTED, DocumentStatus.INDEXED);
        when(departmentAccessRepository.existsByDocumentIdAndDepartmentId(1L, 100L)).thenReturn(true);

        AccessDecision decision = policyService.canViewMetadata(user, document);

        assertThat(decision.granted()).isTrue();
    }

    @Test
    @DisplayName("RESTRICTED document is hidden from unrelated user")
    void canViewMetadata_restrictedUnsharedUser_denied() {
        User user = user(10L, Role.USER, 100L, UserStatus.ACTIVE);
        Document document = document(1L, 20L, 200L, DocumentAccessLevel.RESTRICTED, DocumentStatus.INDEXED);

        AccessDecision decision = policyService.canViewMetadata(user, document);

        assertThat(decision.granted()).isFalse();
        assertThat(decision.denialReason()).isEqualTo("ACCESS_DENIED");
    }

    @Test
    @DisplayName("ARCHIVED document preview is granted to admin")
    void canPreview_archivedAdmin_granted() {
        User admin = user(10L, Role.ADMIN, null, UserStatus.ACTIVE);
        Document document = document(1L, 20L, 200L, DocumentAccessLevel.RESTRICTED, DocumentStatus.ARCHIVED);

        AccessDecision decision = policyService.canPreview(admin, document);

        assertThat(decision.granted()).isTrue();
    }

    @Test
    @DisplayName("ARCHIVED document metadata is not in default user-facing view")
    void canViewMetadata_archivedAdmin_denied() {
        User admin = user(10L, Role.ADMIN, null, UserStatus.ACTIVE);
        Document document = document(1L, 20L, 200L, DocumentAccessLevel.PUBLIC, DocumentStatus.ARCHIVED);

        AccessDecision decision = policyService.canViewMetadata(admin, document);

        assertThat(decision.granted()).isFalse();
        assertThat(decision.denialReason()).isEqualTo("DOCUMENT_NOT_READY");
    }

    @Test
    @DisplayName("PROCESSING document download is denied to admin")
    void canDownload_processingAdmin_denied() {
        User admin = user(10L, Role.ADMIN, null, UserStatus.ACTIVE);
        Document document = document(1L, 20L, 200L, DocumentAccessLevel.PUBLIC, DocumentStatus.PROCESSING);

        AccessDecision decision = policyService.canDownload(admin, document);

        assertThat(decision.granted()).isFalse();
        assertThat(decision.denialReason()).isEqualTo("DOCUMENT_NOT_READY");
    }

    @Test
    @DisplayName("Version download requires INDEXED version from same document")
    void canDownloadVersion_versionDifferentDocument_denied() {
        User admin = user(10L, Role.ADMIN, null, UserStatus.ACTIVE);
        Document document = document(1L, 20L, 200L, DocumentAccessLevel.PUBLIC, DocumentStatus.INDEXED);
        DocumentVersion version = version(2L, DocumentStatus.INDEXED);

        AccessDecision decision = policyService.canDownloadVersion(admin, document, version);

        assertThat(decision.granted()).isFalse();
        assertThat(decision.denialReason()).isEqualTo("VERSION_NOT_READY");
    }

    @Test
    @DisplayName("PUBLIC document does not query ACL repositories")
    void canViewMetadata_publicIndexedActiveUser_skipsAclRepositories() {
        User user = user(10L, Role.USER, 100L, UserStatus.ACTIVE);
        Document document = document(1L, 20L, 200L, DocumentAccessLevel.PUBLIC, DocumentStatus.INDEXED);

        AccessDecision decision = policyService.canViewMetadata(user, document);

        assertThat(decision.granted()).isTrue();
        verify(userAccessRepository, never()).existsByDocumentIdAndUserId(1L, 10L);
        verify(departmentAccessRepository, never()).existsByDocumentIdAndDepartmentId(1L, 100L);
    }

    private User user(Long id, Role role, Long departmentId, UserStatus status) {
        User user = new User();
        user.setId(id);
        user.setName("User " + id);
        user.setEmail("user" + id + "@example.com");
        user.setPassword("password");
        user.setRole(role);
        user.setDepartmentId(departmentId);
        user.setStatus(status);
        return user;
    }

    private Document document(Long id, Long ownerId, Long categoryId, DocumentAccessLevel accessLevel, DocumentStatus status) {
        Document document = new Document();
        document.setId(id);
        document.setTitle("Document " + id);
        document.setSlug("document-" + id);
        document.setCategoryId(categoryId);
        document.setUploadedBy(ownerId);
        document.setOwnerId(ownerId);
        document.setFileName("document.pdf");
        document.setFileType("pdf");
        document.setMimeType("application/pdf");
        document.setFileSize(1024L);
        document.setStoragePath("documents/document.pdf");
        document.setAccessLevel(accessLevel);
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
