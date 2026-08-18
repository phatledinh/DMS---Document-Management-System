package com.dms.document.processing;

import com.dms.document.entity.Document;
import com.dms.document.entity.DocumentStatus;
import com.dms.document.repository.DocumentRepository;
import com.dms.document.repository.DocumentVersionRepository;
import com.dms.document.service.DocumentVersionService;
import com.dms.storage.ObjectStorageService;
import org.jodconverter.core.DocumentConverter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.OffsetDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DocumentPreviewConversionServiceTest {
    @Mock
    private ObjectStorageService objectStorageService;
    @Mock
    private DocumentRepository documentRepository;
    @Mock
    private DocumentVersionRepository versionRepository;
    @Mock
    private DocumentVersionService versionService;
    @Mock
    private DocumentConverter documentConverter;
    @Mock
    private com.dms.identity.repository.UserRepository userRepository;

    private DocumentPreviewConversionService service;

    @BeforeEach
    void setUp() {
        service = new DocumentPreviewConversionService(objectStorageService, documentRepository, versionRepository, versionService, documentConverter, userRepository);
    }

    @Test
    void convert_existingPreviewArtifactMarksIndexedAndSkipsConversion() {
        Document document = document();
        document.setPreviewObjectKey("preview/documents/object.pdf");
        DocumentProcessingMessage message = message();
        when(objectStorageService.generatePreviewObjectKey("documents/object")).thenReturn("preview/documents/object.pdf");
        when(objectStorageService.objectExists("preview/documents/object.pdf")).thenReturn(true);

        service.convert(document, message);

        assertThat(document.getStatus()).isEqualTo(DocumentStatus.INDEXED);
        verify(documentRepository).save(document);
        verify(objectStorageService, never()).openStream("documents/object");
    }

    @Test
    void requiresConversion_onlyOfficeTypes() {
        assertThat(service.requiresConversion("DOCX")).isTrue();
        assertThat(service.requiresConversion("xlsx")).isTrue();
        assertThat(service.requiresConversion("PDF")).isFalse();
    }

    private Document document() {
        Document document = new Document();
        document.setId(42L);
        document.setFileType("DOCX");
        document.setStoragePath("documents/object");
        document.setStatus(DocumentStatus.PROCESSING);
        return document;
    }

    private DocumentProcessingMessage message() {
        return new DocumentProcessingMessage("task", DocumentProcessingTaskType.PREVIEW, 42L, null, "documents/object", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", 1, OffsetDateTime.now());
    }
}
