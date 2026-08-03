package com.dms.document.service;

import com.dms.common.exception.AppException;
import com.dms.common.security.CurrentUserProvider;
import com.dms.document.dto.PresignedUrlResponse;
import com.dms.document.dto.UploadInitRequest;
import com.dms.document.dto.UploadInitResponse;
import com.dms.document.entity.AccessLog;
import com.dms.document.entity.AccessLogAction;
import com.dms.document.entity.Document;
import com.dms.document.entity.DocumentAccessLevel;
import com.dms.document.entity.DocumentStatus;
import com.dms.document.policy.AccessDecision;
import com.dms.document.policy.DocumentAccessPolicyService;
import com.dms.document.processing.DocumentExtractionRequestedEvent;
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
import com.dms.storage.ObjectMetadata;
import com.dms.storage.ObjectStorageService;
import com.dms.storage.PresignedGetUrl;
import com.dms.storage.PresignedPutUrl;
import com.dms.storage.ValidatedFile;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import java.io.ByteArrayInputStream;
import java.time.OffsetDateTime;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
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
    @Mock
    private HttpServletRequest servletRequest;

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
        verify(documentRepository).save(documentCaptor.capture());
        assertThat(documentCaptor.getValue().getStoragePath()).isEqualTo("documents/object-id");
        assertThat(documentCaptor.getValue().getUploadExpiresAt()).isEqualTo(expiresAt);
    }

    @Test
    void createPreviewUrl_allowedLogsAccessAndIncrementsViewCount() {
        User user = user();
        Document document = document();
        when(currentUserProvider.getRequiredUser()).thenReturn(user);
        when(documentRepository.findById(1L)).thenReturn(java.util.Optional.of(document));
        when(accessPolicyService.canPreview(user, document)).thenReturn(AccessDecision.allow());
        when(fileValidationService.canPreviewOriginal("PDF")).thenReturn(true);
        when(objectStorageService.presignGet("documents/object-id", "inline; filename=\"Policy.pdf\""))
                .thenReturn(new PresignedGetUrl("http://storage/preview", 300));
        when(servletRequest.getRemoteAddr()).thenReturn("127.0.0.1");
        when(servletRequest.getHeader("User-Agent")).thenReturn("JUnit");

        PresignedUrlResponse response = service.createPreviewUrl(1L, servletRequest);

        assertThat(response.url()).isEqualTo("http://storage/preview");
        assertThat(document.getViewCount()).isEqualTo(8);
        assertThat(document.getDownloadCount()).isEqualTo(3);
        ArgumentCaptor<AccessLog> logCaptor = ArgumentCaptor.forClass(AccessLog.class);
        verify(accessLogRepository).save(logCaptor.capture());
        assertThat(logCaptor.getValue().getAction()).isEqualTo(AccessLogAction.PREVIEW);
        assertThat(logCaptor.getValue().getAccessGranted()).isTrue();
        assertThat(logCaptor.getValue().getIpAddress()).isEqualTo("127.0.0.1");
        assertThat(logCaptor.getValue().getUserAgent()).isEqualTo("JUnit");
    }

    @Test
    void createPreviewUrl_deniedLogsAccessWithoutIncrementingViewCount() {
        User user = user();
        Document document = document();
        when(currentUserProvider.getRequiredUser()).thenReturn(user);
        when(documentRepository.findById(1L)).thenReturn(java.util.Optional.of(document));
        when(accessPolicyService.canPreview(user, document)).thenReturn(AccessDecision.denied("ACCESS_DENIED"));

        assertThatThrownBy(() -> service.createPreviewUrl(1L, servletRequest))
                .isInstanceOf(AppException.class)
                .hasMessage("Access denied");

        assertThat(document.getViewCount()).isEqualTo(7);
        ArgumentCaptor<AccessLog> logCaptor = ArgumentCaptor.forClass(AccessLog.class);
        verify(accessLogRepository).save(logCaptor.capture());
        assertThat(logCaptor.getValue().getAction()).isEqualTo(AccessLogAction.PREVIEW);
        assertThat(logCaptor.getValue().getAccessGranted()).isFalse();
        assertThat(logCaptor.getValue().getDenialReason()).isEqualTo("ACCESS_DENIED");
        verify(objectStorageService, never()).presignGet(any(), any());
    }

    @Test
    void createDownloadUrl_allowedLogsAccessAndIncrementsDownloadCount() {
        User user = user();
        Document document = document();
        when(currentUserProvider.getRequiredUser()).thenReturn(user);
        when(documentRepository.findById(1L)).thenReturn(java.util.Optional.of(document));
        when(accessPolicyService.canDownload(user, document)).thenReturn(AccessDecision.allow());
        when(objectStorageService.presignGet("documents/object-id", "attachment; filename=\"Policy.pdf\""))
                .thenReturn(new PresignedGetUrl("http://storage/download", 300));

        PresignedUrlResponse response = service.createDownloadUrl(1L, servletRequest);

        assertThat(response.url()).isEqualTo("http://storage/download");
        assertThat(document.getViewCount()).isEqualTo(7);
        assertThat(document.getDownloadCount()).isEqualTo(4);
        ArgumentCaptor<AccessLog> logCaptor = ArgumentCaptor.forClass(AccessLog.class);
        verify(accessLogRepository).save(logCaptor.capture());
        assertThat(logCaptor.getValue().getAction()).isEqualTo(AccessLogAction.DOWNLOAD);
        assertThat(logCaptor.getValue().getAccessGranted()).isTrue();
    }

    @Test
    void completeUpload_pdfValidatesObjectAndPublishesExtractionRequest() {
        User admin = admin();
        Document document = awaitingUploadDocument("Policy.pdf", "PDF", "application/pdf");
        when(currentUserProvider.getRequiredUser()).thenReturn(admin);
        when(documentRepository.findById(1L)).thenReturn(java.util.Optional.of(document));
        when(objectStorageService.headObject("documents/object-id"))
                .thenReturn(new ObjectMetadata(1024, "application/pdf", "etag"));
        when(objectStorageService.openStream("documents/object-id"))
                .thenReturn(new ByteArrayInputStream("pdf".getBytes()));
        when(mimeDetectionService.detect(any(), any())).thenReturn("application/pdf");
        when(documentRepository.save(any(Document.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var response = service.completeUpload(1L);

        assertThat(response.status()).isEqualTo(DocumentStatus.PROCESSING.name());
        assertThat(document.getStatus()).isEqualTo(DocumentStatus.PROCESSING);
        assertThat(document.getUploadExpiresAt()).isNull();
        assertThat(document.getDocumentCode()).isNotBlank();
        verify(fileValidationService).validateDetected("PDF", "application/pdf");
        ArgumentCaptor<DocumentExtractionRequestedEvent> eventCaptor = ArgumentCaptor.forClass(DocumentExtractionRequestedEvent.class);
        verify(eventPublisher).publishEvent(eventCaptor.capture());
        assertThat(eventCaptor.getValue().documentId()).isEqualTo(1L);
        assertThat(eventCaptor.getValue().objectKey()).isEqualTo("documents/object-id");
        assertThat(eventCaptor.getValue().mimeType()).isEqualTo("application/pdf");
    }

    @Test
    void completeUpload_docxValidatesObjectAndPublishesExtractionRequest() {
        User admin = admin();
        Document document = awaitingUploadDocument(
                "Policy.docx",
                "DOCX",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        );
        when(currentUserProvider.getRequiredUser()).thenReturn(admin);
        when(documentRepository.findById(1L)).thenReturn(java.util.Optional.of(document));
        when(objectStorageService.headObject("documents/object-id"))
                .thenReturn(new ObjectMetadata(1024, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "etag"));
        when(objectStorageService.openStream("documents/object-id"))
                .thenReturn(new ByteArrayInputStream("docx".getBytes()));
        when(mimeDetectionService.detect(any(), any()))
                .thenReturn("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
        when(documentRepository.save(any(Document.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var response = service.completeUpload(1L);

        assertThat(response.status()).isEqualTo(DocumentStatus.PROCESSING.name());
        assertThat(document.getStatus()).isEqualTo(DocumentStatus.PROCESSING);
        verify(fileValidationService).validateDetected("DOCX", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
        ArgumentCaptor<DocumentExtractionRequestedEvent> eventCaptor = ArgumentCaptor.forClass(DocumentExtractionRequestedEvent.class);
        verify(eventPublisher).publishEvent(eventCaptor.capture());
        assertThat(eventCaptor.getValue().mimeType()).isEqualTo("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    }

    @Test
    void completeUpload_mimeSpoofingDeletesObjectAndRejectsUpload() {
        User admin = admin();
        Document document = awaitingUploadDocument("Policy.pdf", "PDF", "application/pdf");
        when(currentUserProvider.getRequiredUser()).thenReturn(admin);
        when(documentRepository.findById(1L)).thenReturn(java.util.Optional.of(document));
        when(objectStorageService.headObject("documents/object-id"))
                .thenReturn(new ObjectMetadata(1024, "application/pdf", "etag"));
        when(objectStorageService.openStream("documents/object-id"))
                .thenReturn(new ByteArrayInputStream("spoof".getBytes()));
        when(mimeDetectionService.detect(any(), any())).thenReturn("text/plain");
        org.mockito.Mockito.doThrow(new AppException("INVALID_FILE_TYPE", "File MIME type does not match the extension", org.springframework.http.HttpStatus.BAD_REQUEST))
                .when(fileValidationService).validateDetected("PDF", "text/plain");

        assertThatThrownBy(() -> service.completeUpload(1L))
                .isInstanceOf(AppException.class)
                .hasMessage("File MIME type does not match the extension");

        assertThat(document.getStatus()).isEqualTo(DocumentStatus.AWAITING_UPLOAD);
        verify(objectStorageService).deleteObject("documents/object-id");
        verify(eventPublisher, never()).publishEvent(any());
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

    private User user() {
        User user = new User();
        user.setId(10L);
        user.setEmail("user@dms.com");
        user.setName("User");
        user.setPassword("hash");
        user.setRole(Role.USER);
        user.setStatus(UserStatus.ACTIVE);
        return user;
    }

    private Document awaitingUploadDocument(String fileName, String fileType, String mimeType) {
        Document document = document();
        document.setFileName(fileName);
        document.setFileType(fileType);
        document.setMimeType(mimeType);
        document.setStatus(DocumentStatus.AWAITING_UPLOAD);
        document.setUploadExpiresAt(OffsetDateTime.now().plusMinutes(5));
        document.setDocumentCode(null);
        return document;
    }

    private Document document() {
        Document document = new Document();
        document.setId(1L);
        document.setTitle("Policy");
        document.setSlug("policy");
        document.setCategoryId(10L);
        document.setUploadedBy(1L);
        document.setOwnerId(10L);
        document.setFileName("Policy.pdf");
        document.setFileType("PDF");
        document.setMimeType("application/pdf");
        document.setFileSize(1024L);
        document.setStoragePath("documents/object-id");
        document.setAccessLevel(DocumentAccessLevel.PUBLIC);
        document.setStatus(DocumentStatus.INDEXED);
        document.setViewCount(7);
        document.setDownloadCount(3);
        return document;
    }
}
