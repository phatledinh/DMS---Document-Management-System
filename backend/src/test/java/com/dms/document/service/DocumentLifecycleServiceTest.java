package com.dms.document.service;

import com.dms.common.exception.AppException;
import com.dms.common.security.CurrentUserProvider;
import com.dms.document.dto.BatchDocumentLifecycleResponse;
import com.dms.document.dto.DocumentLifecycleResponse;
import com.dms.document.entity.AccessLog;
import com.dms.document.entity.AccessLogAction;
import com.dms.document.entity.Document;
import com.dms.document.entity.DocumentStatus;
import com.dms.document.entity.DocumentVersion;
import com.dms.document.processing.DocumentProcessingPublisher;
import com.dms.document.processing.DocumentTrashProperties;
import com.dms.document.processing.PostgresSearchEngine;
import com.dms.document.repository.AccessLogRepository;
import com.dms.document.repository.DocumentContentRepository;
import com.dms.document.repository.DocumentRepository;
import com.dms.document.repository.DocumentVersionRepository;
import com.dms.identity.entity.Role;
import com.dms.identity.entity.User;
import com.dms.identity.entity.UserStatus;
import com.dms.storage.ObjectStorageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DocumentLifecycleServiceTest {
    @Mock
    private DocumentRepository documentRepository;
    @Mock
    private DocumentVersionRepository versionRepository;
    @Mock
    private DocumentContentRepository contentRepository;
    @Mock
    private AccessLogRepository accessLogRepository;
    @Mock
    private CurrentUserProvider currentUserProvider;
    @Mock
    private ObjectStorageService objectStorageService;
    @Mock
    private PostgresSearchEngine searchEngine;
    @Mock
    private DocumentProcessingPublisher processingPublisher;

    private DocumentLifecycleService service;

    @BeforeEach
    void setUp() {
        service = new DocumentLifecycleService(
                documentRepository,
                versionRepository,
                contentRepository,
                accessLogRepository,
                currentUserProvider,
                objectStorageService,
                searchEngine,
                new DocumentTrashProperties(30, "0 0 2 * * *"),
                processingPublisher
        );
    }

    @Test
    void archive_setsArchivedStatusAndRemovesSearchIndex() {
        User admin = admin();
        Document document = document(DocumentStatus.INDEXED);
        when(currentUserProvider.getRequiredUser()).thenReturn(admin);
        when(documentRepository.findById(1L)).thenReturn(Optional.of(document));
        when(documentRepository.save(any(Document.class))).thenAnswer(invocation -> invocation.getArgument(0));

        DocumentLifecycleResponse response = service.archive(1L);

        assertThat(response.status()).isEqualTo(DocumentStatus.ARCHIVED.name());
        assertThat(document.getArchivedAt()).isNotNull();
        verify(searchEngine).removeIndex(1L);
        ArgumentCaptor<AccessLog> logCaptor = ArgumentCaptor.forClass(AccessLog.class);
        verify(accessLogRepository).save(logCaptor.capture());
        assertThat(logCaptor.getValue().getAction()).isEqualTo(AccessLogAction.ARCHIVE);
    }

    @Test
    void softDelete_setsTrashFieldsWithoutDeletingObjectStorage() {
        User admin = admin();
        Document document = document(DocumentStatus.ARCHIVED);
        when(currentUserProvider.getRequiredUser()).thenReturn(admin);
        when(documentRepository.findById(1L)).thenReturn(Optional.of(document));
        when(documentRepository.save(any(Document.class))).thenAnswer(invocation -> invocation.getArgument(0));

        service.softDelete(1L);

        assertThat(document.getStatus()).isEqualTo(DocumentStatus.DELETED);
        assertThat(document.getPreviousStatus()).isEqualTo(DocumentStatus.ARCHIVED.name());
        assertThat(document.getDeletedBy()).isEqualTo(admin.getId());
        assertThat(document.getDeletedAt()).isNotNull();
        assertThat(document.getPurgeAfter()).isAfter(document.getDeletedAt().plusDays(29));
        verify(objectStorageService, never()).deleteObject(any());
        verify(searchEngine).removeIndex(1L);
    }

    @Test
    void restore_deletedDocumentRestoresPreviousStatusAndClearsTrashFields() {
        User admin = admin();
        Document document = document(DocumentStatus.DELETED);
        document.setPreviousStatus(DocumentStatus.ARCHIVED.name());
        document.setDeletedBy(admin.getId());
        document.setDeletedAt(OffsetDateTime.now().minusDays(1));
        document.setPurgeAfter(OffsetDateTime.now().plusDays(29));
        when(currentUserProvider.getRequiredUser()).thenReturn(admin);
        when(documentRepository.findById(1L)).thenReturn(Optional.of(document));
        when(documentRepository.save(any(Document.class))).thenAnswer(invocation -> invocation.getArgument(0));

        DocumentLifecycleResponse response = service.restore(1L);

        assertThat(response.status()).isEqualTo(DocumentStatus.ARCHIVED.name());
        assertThat(response.restoredAt()).isNotNull();
        assertThat(document.getDeletedAt()).isNull();
        assertThat(document.getDeletedBy()).isNull();
        assertThat(document.getPurgeAfter()).isNull();
        assertThat(document.getPreviousStatus()).isNull();
    }

    @Test
    void archive_rejectsDeletedDocument() {
        User admin = admin();
        Document document = document(DocumentStatus.DELETED);
        when(currentUserProvider.getRequiredUser()).thenReturn(admin);
        when(documentRepository.findById(1L)).thenReturn(Optional.of(document));

        assertThatThrownBy(() -> service.archive(1L))
                .isInstanceOf(AppException.class)
                .hasMessageContaining("cannot be archived");
    }

    @Test
    void purgeDocuments_deletesObjectsAndMarksTombstone() {
        Document document = document(DocumentStatus.DELETED);
        document.setPreviewObjectKey("preview/key.pdf");
        DocumentVersion version = new DocumentVersion();
        version.setDocumentId(1L);
        version.setStoragePath("versions/key");
        version.setPreviewObjectKey("preview/version.pdf");
        when(documentRepository.findById(1L)).thenReturn(Optional.of(document));
        when(versionRepository.findByDocumentId(1L)).thenReturn(List.of(version));
        when(documentRepository.save(any(Document.class))).thenAnswer(invocation -> invocation.getArgument(0));

        BatchDocumentLifecycleResponse response = service.purgeDocuments(List.of(1L));

        assertThat(response.successCount()).isEqualTo(1);
        assertThat(response.failureCount()).isZero();
        assertThat(document.getPermanentlyDeletedAt()).isNotNull();
        verify(objectStorageService).deleteObject("documents/key");
        verify(objectStorageService).deleteObject("preview/key.pdf");
        verify(objectStorageService).deleteObject("versions/key");
        verify(objectStorageService).deleteObject("preview/version.pdf");
        verify(contentRepository).deleteByDocumentId(1L);
        verify(searchEngine).removeIndex(1L);
    }

    private Document document(DocumentStatus status) {
        Document document = new Document();
        document.setId(1L);
        document.setTitle("Policy");
        document.setFileName("Policy.pdf");
        document.setFileType("PDF");
        document.setFileSize(1024L);
        document.setStoragePath("documents/key");
        document.setStatus(status);
        return document;
    }

    private User admin() {
        User user = new User();
        user.setId(99L);
        user.setEmail("admin@example.com");
        user.setName("Admin");
        user.setPassword("hash");
        user.setRole(Role.ADMIN);
        user.setStatus(UserStatus.ACTIVE);
        return user;
    }
}
