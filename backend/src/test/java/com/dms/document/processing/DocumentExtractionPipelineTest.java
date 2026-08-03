package com.dms.document.processing;

import com.dms.document.entity.Document;
import com.dms.document.entity.DocumentStatus;
import com.dms.document.repository.DocumentRepository;
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

    private DocumentExtractionPipeline pipeline;

    @BeforeEach
    void setUp() {
        pipeline = new DocumentExtractionPipeline(objectStorageService, textExtractionService, contentService, searchEngine, documentRepository);
    }

    @Test
    void process_successStoresContentRefreshesIndexAndSetsIndexed() {
        Document document = document();
        DocumentProcessingMessage message = message(1);
        ByteArrayInputStream stream = new ByteArrayInputStream(new byte[]{1});
        ExtractedDocumentText text = new ExtractedDocumentText("hello", "PDFBOX", "vi");
        when(objectStorageService.openStream("documents/object")).thenReturn(stream);
        when(textExtractionService.extract(document, stream)).thenReturn(text);

        pipeline.process(document, message);

        verify(contentService).saveSuccess(42L, text, 1);
        verify(searchEngine).refreshIndex(document, "hello");
        assertThat(document.getStatus()).isEqualTo(DocumentStatus.INDEXED);
        verify(documentRepository).save(document);
    }

    @Test
    void process_failureStoresFailedContentAndPropagates() {
        Document document = document();
        DocumentProcessingMessage message = message(2);
        ByteArrayInputStream stream = new ByteArrayInputStream(new byte[]{1});
        when(objectStorageService.openStream("documents/object")).thenReturn(stream);
        when(textExtractionService.extract(document, stream)).thenThrow(new IllegalStateException("parse failed"));

        assertThatThrownBy(() -> pipeline.process(document, message))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("parse failed");

        verify(contentService).saveFailure(42L, "TEXT_EXTRACTION", "parse failed", 2);
    }

    private Document document() {
        Document document = new Document();
        document.setId(42L);
        document.setStoragePath("documents/object");
        document.setStatus(DocumentStatus.PROCESSING);
        return document;
    }

    private DocumentProcessingMessage message(int attempt) {
        return new DocumentProcessingMessage("task", DocumentProcessingTaskType.EXTRACT, 42L, null, "documents/object", "application/pdf", attempt, OffsetDateTime.now());
    }
}
