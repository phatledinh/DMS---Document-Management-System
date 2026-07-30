package com.dms.document.service;

import com.dms.common.security.CurrentUserProvider;
import com.dms.document.dto.UploadInitRequest;
import com.dms.document.dto.UploadInitResponse;
import com.dms.document.entity.Document;
import com.dms.document.entity.DocumentAccessLevel;
import com.dms.document.entity.DocumentStatus;
import com.dms.document.policy.DocumentAccessPolicyService;
import com.dms.document.repository.AccessLogRepository;
import com.dms.document.repository.DocumentDepartmentAccessRepository;
import com.dms.document.repository.DocumentRepository;
import com.dms.document.repository.DocumentUserAccessRepository;
import com.dms.identity.entity.Role;
import com.dms.identity.entity.User;
import com.dms.identity.entity.UserStatus;
import com.dms.identity.repository.UserRepository;
import com.dms.storage.FileValidationService;
import com.dms.storage.MimeDetectionService;
import com.dms.storage.ObjectStorageService;
import com.dms.storage.PresignedPutUrl;
import com.dms.storage.ValidatedFile;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import java.time.OffsetDateTime;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DocumentPresignedUrlServiceTest {
    @Mock
    private DocumentRepository documentRepository;
    @Mock
    private DocumentDepartmentAccessRepository departmentAccessRepository;
    @Mock
    private DocumentUserAccessRepository userAccessRepository;
    @Mock
    private AccessLogRepository accessLogRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private CurrentUserProvider currentUserProvider;
    @Mock
    private DocumentAccessPolicyService accessPolicyService;
    @Mock
    private ObjectStorageService objectStorageService;
    @Mock
    private FileValidationService fileValidationService;
    @Mock
    private MimeDetectionService mimeDetectionService;
    @Mock
    private ApplicationEventPublisher eventPublisher;

    private DocumentPresignedUrlService service;

    @BeforeEach
    void setUp() {
        service = new DocumentPresignedUrlService(
                documentRepository,
                departmentAccessRepository,
                userAccessRepository,
                accessLogRepository,
                userRepository,
                currentUserProvider,
                accessPolicyService,
                objectStorageService,
                fileValidationService,
                mimeDetectionService,
                eventPublisher
        );
    }

    @Test
    void initiateUpload_createsAwaitingUploadDocumentAndReturnsPresignedUrl() {
        User admin = admin();
        UploadInitRequest request = new UploadInitRequest(
                "Policy.pdf",
                1024,
                "application/pdf",
                "QA Policy",
                "desc",
                10L,
                20L,
                null,
                DocumentAccessLevel.PUBLIC,
                null,
                30L,
                null,
                null,
                null
        );
        OffsetDateTime expiresAt = OffsetDateTime.now().plusMinutes(5);
        when(currentUserProvider.getRequiredUser()).thenReturn(admin);
        when(userRepository.existsById(30L)).thenReturn(true);
        when(fileValidationService.validateDeclared("Policy.pdf", 1024, "application/pdf"))
                .thenReturn(new ValidatedFile("Policy.pdf", "PDF", "application/pdf"));
        when(objectStorageService.generateDocumentObjectKey()).thenReturn("documents/object-id");
        when(objectStorageService.presignPut("documents/object-id", "application/pdf"))
                .thenReturn(new PresignedPutUrl("http://storage/upload", "PUT", Map.of("Content-Type", "application/pdf"), 300, expiresAt));
        when(documentRepository.save(any(Document.class))).thenAnswer(invocation -> {
            Document document = invocation.getArgument(0);
            document.setId(42L);
            return document;
        });

        UploadInitResponse response = service.initiateUpload(request);

        assertThat(response.documentId()).isEqualTo(42L);
        assertThat(response.status()).isEqualTo(DocumentStatus.AWAITING_UPLOAD.name());
        assertThat(response.uploadUrl()).isEqualTo("http://storage/upload");
        ArgumentCaptor<Document> documentCaptor = ArgumentCaptor.forClass(Document.class);
        org.mockito.Mockito.verify(documentRepository).save(documentCaptor.capture());
        assertThat(documentCaptor.getValue().getStoragePath()).isEqualTo("documents/object-id");
        assertThat(documentCaptor.getValue().getUploadExpiresAt()).isEqualTo(expiresAt);
    }

    private User admin() {
        User user = new User();
        user.setId(1L);
        user.setEmail("admin@dms.com");
        user.setName("Admin");
        user.setPassword("hash");
        user.setRole(Role.ADMIN);
        user.setStatus(UserStatus.ACTIVE);
        return user;
    }
}
