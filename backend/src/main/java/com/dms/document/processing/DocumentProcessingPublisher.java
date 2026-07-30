package com.dms.document.processing;

import org.springframework.amqp.core.MessageDeliveryMode;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
public class DocumentProcessingPublisher {
    private final RabbitTemplate rabbitTemplate;

    public DocumentProcessingPublisher(RabbitTemplate rabbitTemplate) {
        this.rabbitTemplate = rabbitTemplate;
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

    public void publish(String routingKey, DocumentProcessingMessage message) {
        rabbitTemplate.convertAndSend(
                DocumentProcessingRabbitConfig.TASKS_EXCHANGE,
                routingKey,
                message,
                rabbitMessage -> {
                    rabbitMessage.getMessageProperties().setDeliveryMode(MessageDeliveryMode.PERSISTENT);
                    return rabbitMessage;
                }
        );
    }
}
