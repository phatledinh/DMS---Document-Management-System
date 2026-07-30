package com.dms.document.processing;

import org.springframework.amqp.core.Queue;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Configuration
class DocumentProcessingQueueConfig {
    static final String EXTRACT_QUEUE = "dms.extract";

    @Bean
    Queue extractQueue() {
        return new Queue(EXTRACT_QUEUE, true);
    }
}

@Component
public class DocumentProcessingPublisher {
    private final RabbitTemplate rabbitTemplate;

    public DocumentProcessingPublisher(RabbitTemplate rabbitTemplate) {
        this.rabbitTemplate = rabbitTemplate;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void publish(DocumentExtractionRequestedEvent event) {
        rabbitTemplate.convertAndSend(
                DocumentProcessingQueueConfig.EXTRACT_QUEUE,
                new DocumentExtractionMessage(event.documentId(), event.objectKey(), "EXTRACT")
        );
    }
}
