package com.dms.document.service;

import com.dms.category.repository.CategoryDepartmentPermissionRepository;
import com.dms.common.exception.AppException;
import com.dms.common.security.CurrentUserProvider;
import com.dms.document.dto.DocumentDetailResponse;
import com.dms.document.dto.DocumentSearchRequest;
import com.dms.document.dto.PageResponse;
import com.dms.document.entity.Document;
import com.dms.document.entity.DocumentStatus;
import com.dms.document.policy.AccessDecision;
import com.dms.document.policy.DocumentAccessPolicyService;
import com.dms.document.repository.DocumentRepository;
import com.dms.document.repository.DocumentTagRepository;
import com.dms.identity.entity.Role;
import com.dms.identity.entity.User;
import com.dms.identity.entity.UserStatus;
import com.dms.identity.repository.UserRepository;
import com.dms.masterdata.repository.CategoryRepository;
import com.dms.masterdata.repository.DepartmentRepository;
import com.dms.masterdata.repository.TagRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DocumentMetadataServiceTest {
    @Mock
    private DocumentRepository documentRepository;
    @Mock
    private CategoryDepartmentPermissionRepository categoryPermissionRepository;
    @Mock
    private DepartmentRepository departmentRepository;
    @Mock
    private CurrentUserProvider currentUserProvider;
    @Mock
    private DocumentAccessPolicyService accessPolicyService;
    @Mock
    private CategoryRepository categoryRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private DocumentTagRepository documentTagRepository;
    @Mock
    private TagRepository tagRepository;

    private DocumentMetadataService service;

    @BeforeEach
    void setUp() {
        service = new DocumentMetadataService(documentRepository, categoryPermissionRepository, departmentRepository, categoryRepository, userRepository, documentTagRepository, tagRepository, currentUserProvider, accessPolicyService);
    }

    @Test
    void listDocuments_returnsAclFilteredPageFromRepository() {
        User user = user(Role.USER);
        Document document = document(DocumentStatus.INDEXED);
        when(currentUserProvider.getRequiredUser()).thenReturn(user);
        when(documentRepository.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(document)));

        PageResponse<?> response = service.listDocuments(new DocumentSearchRequest(null, null, null, null, null, null, null, null, null, null, null, null, null, null, null));

        assertThat(response.content()).hasSize(1);
        assertThat(response.totalElements()).isEqualTo(1);
        verify(documentRepository).findAll(any(Specification.class), any(Pageable.class));
    }

    @Test
    void getDocumentDetail_allowed_returnsDetailWithoutIncrementingViewCount() {
        User user = user(Role.USER);
        Document document = document(DocumentStatus.INDEXED);
        when(currentUserProvider.getRequiredUser()).thenReturn(user);
        when(documentRepository.findById(1L)).thenReturn(Optional.of(document));
        when(accessPolicyService.canViewMetadata(user, document)).thenReturn(AccessDecision.allow());

        DocumentDetailResponse response = service.getDocumentDetail(1L);

        assertThat(response.id()).isEqualTo(1L);
        assertThat(response.viewCount()).isEqualTo(7);
        assertThat(response.previewUrlEndpoint()).isEqualTo("/documents/1/preview-url");
        assertThat(response.downloadUrlEndpoint()).isEqualTo("/documents/1/download-url");
        verify(documentRepository, never()).save(any());
    }

    @Test
    void getDocumentDetail_deniedAccessDoesNotLeakDocument() {
        User user = user(Role.USER);
        Document document = document(DocumentStatus.INDEXED);
        when(currentUserProvider.getRequiredUser()).thenReturn(user);
        when(documentRepository.findById(1L)).thenReturn(Optional.of(document));
        when(accessPolicyService.canViewMetadata(user, document)).thenReturn(AccessDecision.denied("ACCESS_DENIED"));

        assertThatThrownBy(() -> service.getDocumentDetail(1L))
                .isInstanceOf(AppException.class)
                .hasMessage("Document not found");
    }

    private User user(Role role) {
        User user = new User();
        user.setId(10L);
        user.setEmail("user@example.com");
        user.setName("User");
        user.setPassword("hash");
        user.setRole(role);
        user.setDepartmentId(20L);
        user.setStatus(UserStatus.ACTIVE);
        return user;
    }

    private Document document(DocumentStatus status) {
        Document document = new Document();
        document.setId(1L);
        document.setTitle("Document");
        document.setSlug("document");
        document.setDescription("desc");
        document.setDocumentCode("DMS-202607-000001");
        document.setCategoryId(100L);
        document.setDepartmentId(20L);
        document.setUploadedBy(1L);
        document.setOwnerId(2L);
        document.setFileName("document.pdf");
        document.setFileType("PDF");
        document.setMimeType("application/pdf");
        document.setFileSize(1024L);
        document.setStoragePath("documents/object");
        document.setVersionNumber("1.0");
        document.setViewCount(7);
        document.setDownloadCount(3);
        document.setStatus(status);
        return document;
    }
}
