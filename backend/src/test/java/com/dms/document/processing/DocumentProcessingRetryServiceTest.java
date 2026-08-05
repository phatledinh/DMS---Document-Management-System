package com.dms.document.processing;

import com.dms.document.entity.Document;
import com.dms.document.entity.DocumentStatus;
import com.dms.document.repository.DocumentRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.OffsetDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DocumentProcessingRetryServiceTest {
    @Mock
    private DocumentProcessingPublisher publisher;
    @Mock
    private DocumentRepository documentRepository;

    private DocumentProcessingRetryService service;

    @BeforeEach
    void setUp() {
        service = new DocumentProcessingRetryService(publisher, documentRepository, new DocumentProcessingProperties(4, 3));
    }

    @Test
    void handleFailure_beforeMaxAttemptsPublishesRetryMessage() {
        DocumentProcessingMessage message = message(1);

        service.handleFailure(message);

        ArgumentCaptor<DocumentProcessingMessage> messageCaptor = ArgumentCaptor.forClass(DocumentProcessingMessage.class);
        verify(publisher).publish(org.mockito.ArgumentMatchers.eq(DocumentProcessingRabbitConfig.EXTRACT_RETRY_30S_ROUTING_KEY), messageCaptor.capture());
        assertThat(messageCaptor.getValue().attempt()).isEqualTo(2);
        verify(documentRepository, never()).save(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void handleFailure_previewBeforeMaxAttemptsPublishesPreviewRetryMessage() {
        DocumentProcessingMessage message = new DocumentProcessingMessage("task", DocumentProcessingTaskType.PREVIEW, 42L, null, "documents/object", "application/pdf", 1, OffsetDateTime.now());

        service.handleFailure(message);

        ArgumentCaptor<DocumentProcessingMessage> messageCaptor = ArgumentCaptor.forClass(DocumentProcessingMessage.class);
        verify(publisher).publish(org.mockito.ArgumentMatchers.eq(DocumentProcessingRabbitConfig.PREVIEW_RETRY_30S_ROUTING_KEY), messageCaptor.capture());
        assertThat(messageCaptor.getValue().attempt()).isEqualTo(2);
        verify(documentRepository, never()).save(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void handleFailure_atMaxAttemptsSetsExtractionFailedAndPublishesDlq() {
        Document document = new Document();
        document.setId(42L);
        document.setStatus(DocumentStatus.PROCESSING);
        DocumentProcessingMessage message = message(3);
        when(documentRepository.findById(42L)).thenReturn(Optional.of(document));

        service.handleFailure(message);

        assertThat(document.getStatus()).isEqualTo(DocumentStatus.EXTRACTION_FAILED);
        verify(documentRepository).save(document);
        verify(publisher).publish(DocumentProcessingRabbitConfig.DLQ_ROUTING_KEY, message);
    }

    private DocumentProcessingMessage message(int attempt) {
        return new DocumentProcessingMessage("task", DocumentProcessingTaskType.EXTRACT, 42L, null, "documents/object", "application/pdf", attempt, OffsetDateTime.now());
    }
}
