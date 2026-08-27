package com.dms.document.processing;

import com.dms.document.entity.Document;
import com.dms.document.entity.DocumentStatus;
import com.dms.document.repository.DocumentRepository;
import com.dms.document.repository.DocumentVersionRepository;
import com.rabbitmq.client.Channel;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.amqp.support.AmqpHeaders;
import org.springframework.messaging.handler.annotation.Header;

import java.io.IOException;

@Component
@Profile("worker")
public class DocumentExtractWorker {
    private final DocumentRepository documentRepository;
    private final DocumentVersionRepository versionRepository;
    private final DocumentExtractionPipeline extractionPipeline;
    private final DocumentProcessingRetryService retryService;

    public DocumentExtractWorker(
            DocumentRepository documentRepository,
            DocumentVersionRepository versionRepository,
            DocumentExtractionPipeline extractionPipeline,
            DocumentProcessingRetryService retryService
    ) {
        this.documentRepository = documentRepository;
        this.versionRepository = versionRepository;
        this.extractionPipeline = extractionPipeline;
        this.retryService = retryService;
    }

    @RabbitListener(queues = DocumentProcessingRabbitConfig.EXTRACT_QUEUE, ackMode = "MANUAL")
    @Transactional
    public void handle(DocumentProcessingMessage message, Channel channel, @Header(AmqpHeaders.DELIVERY_TAG) long deliveryTag) throws IOException {
        try {
            Document document = documentRepository.findById(message.documentId()).orElse(null);
            if (shouldSkip(document, message)) {
                channel.basicAck(deliveryTag, false);
                return;
            }
            extractionPipeline.process(document, message);
            channel.basicAck(deliveryTag, false);
        } catch (RuntimeException exception) {
            retryService.handleFailure(message);
            channel.basicAck(deliveryTag, false);
        }
    }

    private boolean shouldSkip(Document document, DocumentProcessingMessage message) {
        if (document == null || document.getStatus() == DocumentStatus.DELETED) {
            return true;
        }
        if (message.versionId() == null) {
            // Initial document upload: document itself must be PROCESSING
            if (document.getStatus() != DocumentStatus.PROCESSING) {
                return true;
            }
            return !message.objectKey().equals(document.getStoragePath());
        }
        // Version upload: check the version status, not the document status
        return versionRepository.findByIdAndDocumentId(message.versionId(), document.getId())
                .filter(version -> version.getStatus() == DocumentStatus.PROCESSING)
                .filter(version -> message.objectKey().equals(version.getStoragePath()))
                .isEmpty();
    }
}
