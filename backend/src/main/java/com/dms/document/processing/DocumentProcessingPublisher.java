package com.dms.document.processing;

import org.springframework.amqp.core.MessageDeliveryMode;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
public class DocumentProcessingPublisher {
    private final RabbitTemplate rabbitTemplate;
    private final ApplicationEventPublisher applicationEventPublisher;

    public DocumentProcessingPublisher(RabbitTemplate rabbitTemplate, ApplicationEventPublisher applicationEventPublisher) {
        this.rabbitTemplate = rabbitTemplate;
        this.applicationEventPublisher = applicationEventPublisher;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void publish(DocumentExtractionRequestedEvent event) {
        DocumentProcessingMessage message = DocumentProcessingMessage.extract(
                event.documentId(),
                event.versionId(),
                event.objectKey(),
                event.mimeType()
        );
        publish(DocumentProcessingRabbitConfig.EXTRACT_ROUTING_KEY, message);
    }

    public void publishPreview(Long documentId, Long versionId, String objectKey, String mimeType) {
        applicationEventPublisher.publishEvent(new DocumentPreviewRequestedEvent(documentId, versionId, objectKey, mimeType));
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handlePreviewRequest(DocumentPreviewRequestedEvent event) {
        publish(DocumentProcessingRabbitConfig.PREVIEW_ROUTING_KEY, DocumentProcessingMessage.preview(event.documentId(), event.versionId(), event.objectKey(), event.mimeType()));
    }

    public void publish(String routingKey, DocumentProcessingMessage message) {
        publish(DocumentProcessingRabbitConfig.TASKS_EXCHANGE, routingKey, message);
    }

    public void publishRetry(String routingKey, DocumentProcessingMessage message) {
        publish(DocumentProcessingRabbitConfig.RETRY_EXCHANGE, routingKey, message);
    }

    public void publishDeadLetter(DocumentProcessingMessage message) {
        publish(DocumentProcessingRabbitConfig.DEAD_LETTER_EXCHANGE, DocumentProcessingRabbitConfig.DLQ_ROUTING_KEY, message);
    }

    private void publish(String exchange, String routingKey, DocumentProcessingMessage message) {
        rabbitTemplate.convertAndSend(
                exchange,
                routingKey,
                message,
                rabbitMessage -> {
                    rabbitMessage.getMessageProperties().setDeliveryMode(MessageDeliveryMode.PERSISTENT);
                    return rabbitMessage;
                }
        );
    }
}
