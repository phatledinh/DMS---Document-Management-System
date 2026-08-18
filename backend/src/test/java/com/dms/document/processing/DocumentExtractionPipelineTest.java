package com.dms.document.processing;

import com.dms.document.entity.Document;
import com.dms.document.entity.DocumentStatus;
import com.dms.document.repository.DocumentRepository;
import com.dms.document.repository.DocumentVersionRepository;
import com.dms.document.service.DocumentVersionService;
import com.dms.storage.FileValidationService;
import com.dms.storage.ObjectStorageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.ByteArrayInputStream;
import java.time.OffsetDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DocumentExtractionPipelineTest {
    @Mock
    private ObjectStorageService objectStorageService;
    @Mock
    private DocumentTextExtractionService textExtractionService;
    @Mock
    private DocumentContentService contentService;
    @Mock
    private PostgresSearchEngine searchEngine;
    @Mock
    private DocumentRepository documentRepository;
    @Mock
    private DocumentVersionRepository versionRepository;
    @Mock
    private DocumentVersionService versionService;
    @Mock
    private DocumentProcessingPublisher publisher;
    @Mock
    private FileValidationService fileValidationService;
    @Mock
    private com.dms.identity.repository.UserRepository userRepository;

    private DocumentExtractionPipeline pipeline;

    @BeforeEach
    void setUp() {
        pipeline = new DocumentExtractionPipeline(objectStorageService, textExtractionService, contentService, searchEngine, documentRepository, versionRepository, versionService, publisher, fileValidationService, userRepository);
    }

    @Test
    void process_successStoresContentRefreshesIndexAndSetsIndexed() {
        Document document = document();
        DocumentProcessingMessage message = message(1);
        ByteArrayInputStream stream = new ByteArrayInputStream(new byte[]{1});
        ExtractedDocumentText text = new ExtractedDocumentText("hello", "PDFBOX", "vi");
        when(objectStorageService.openStream("documents/object")).thenReturn(stream);
        when(textExtractionService.extract(document.getFileType(), document, stream)).thenReturn(text);

        pipeline.process(document, message);

        verify(contentService).saveSuccess(42L, text, 1);
        verify(searchEngine).refreshIndex(document, "hello");
        assertThat(document.getStatus()).isEqualTo(DocumentStatus.INDEXED);
        verify(documentRepository).save(document);
    }

    @Test
    void process_officeDocumentStoresContentRefreshesIndexAndPublishesPreview() {
        Document document = document();
        document.setFileType("DOCX");
        document.setMimeType("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
        DocumentProcessingMessage message = message(1);
        ByteArrayInputStream stream = new ByteArrayInputStream(new byte[]{1});
        ExtractedDocumentText text = new ExtractedDocumentText("hello", "POI_DOCX", "vi");
        when(objectStorageService.openStream("documents/object")).thenReturn(stream);
        when(textExtractionService.extract(document.getFileType(), document, stream)).thenReturn(text);
        when(fileValidationService.requiresPreviewConversion("DOCX")).thenReturn(true);

        pipeline.process(document, message);

        verify(contentService).saveSuccess(42L, text, 1);
        verify(searchEngine).refreshIndex(document, "hello");
        assertThat(document.getStatus()).isEqualTo(DocumentStatus.INDEXED);
        verify(documentRepository).save(document);
        verify(publisher).publishPreview(42L, null, "documents/object", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    }

    @Test
    void process_failureStoresFailedContentAndPropagates() {
        Document document = document();
        DocumentProcessingMessage message = message(2);
        ByteArrayInputStream stream = new ByteArrayInputStream(new byte[]{1});
        when(objectStorageService.openStream("documents/object")).thenReturn(stream);
        when(textExtractionService.extract(document.getFileType(), document, stream)).thenThrow(new IllegalStateException("parse failed"));

        assertThatThrownBy(() -> pipeline.process(document, message))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("parse failed");

        verify(contentService).saveFailure(42L, "TEXT_EXTRACTION", "parse failed", 2);
    }

    private Document document() {
        Document document = new Document();
        document.setId(42L);
        document.setStoragePath("documents/object");
        document.setFileType("PDF");
        document.setMimeType("application/pdf");
        document.setStatus(DocumentStatus.PROCESSING);
        return document;
    }

    private DocumentProcessingMessage message(int attempt) {
        return new DocumentProcessingMessage("task", DocumentProcessingTaskType.EXTRACT, 42L, null, "documents/object", "application/pdf", attempt, OffsetDateTime.now());
    }
}
