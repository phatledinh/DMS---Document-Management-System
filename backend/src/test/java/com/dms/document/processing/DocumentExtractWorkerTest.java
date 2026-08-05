package com.dms.document.processing;

import com.dms.document.entity.Document;
import com.dms.document.entity.DocumentStatus;
import com.dms.document.repository.DocumentRepository;
import com.dms.document.repository.DocumentVersionRepository;
import com.rabbitmq.client.Channel;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.IOException;
import java.time.OffsetDateTime;
import java.util.Optional;

import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DocumentExtractWorkerTest {
    @Mock
    private DocumentRepository documentRepository;
    @Mock
    private DocumentVersionRepository versionRepository;
    @Mock
    private DocumentExtractionPipeline extractionPipeline;
    @Mock
    private DocumentProcessingRetryService retryService;
    @Mock
    private Channel channel;

    private DocumentExtractWorker worker;

    @BeforeEach
    void setUp() {
        worker = new DocumentExtractWorker(documentRepository, versionRepository, extractionPipeline, retryService);
    }

    @Test
    void handle_missingDocumentAcksAndSkips() throws IOException {
        DocumentProcessingMessage message = message("documents/object");
        when(documentRepository.findById(42L)).thenReturn(Optional.empty());

        worker.handle(message, channel, 10L);

        verify(channel).basicAck(10L, false);
        verify(extractionPipeline, never()).process(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
        verify(retryService, never()).handleFailure(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void handle_objectKeyMismatchAcksAndSkips() throws IOException {
        Document document = document("documents/current", DocumentStatus.PROCESSING);
        DocumentProcessingMessage message = message("documents/stale");
        when(documentRepository.findById(42L)).thenReturn(Optional.of(document));

        worker.handle(message, channel, 10L);

        verify(channel).basicAck(10L, false);
        verify(extractionPipeline, never()).process(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
    }

    @Test
    void handle_pipelineFailureDelegatesRetryAndAcks() throws IOException {
        Document document = document("documents/object", DocumentStatus.PROCESSING);
        DocumentProcessingMessage message = message("documents/object");
        when(documentRepository.findById(42L)).thenReturn(Optional.of(document));
        doThrow(new IllegalStateException("temporary failure")).when(extractionPipeline).process(document, message);

        worker.handle(message, channel, 10L);

        verify(retryService).handleFailure(message);
        verify(channel).basicAck(10L, false);
    }

    private Document document(String storagePath, DocumentStatus status) {
        Document document = new Document();
        document.setId(42L);
        document.setStoragePath(storagePath);
        document.setStatus(status);
        return document;
    }

    private DocumentProcessingMessage message(String objectKey) {
        return new DocumentProcessingMessage("task", DocumentProcessingTaskType.EXTRACT, 42L, null, objectKey, "application/pdf", 1, OffsetDateTime.now());
    }
}
