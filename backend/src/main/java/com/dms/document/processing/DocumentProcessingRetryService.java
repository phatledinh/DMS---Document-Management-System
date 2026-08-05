package com.dms.document.processing;

import com.dms.document.entity.DocumentStatus;
import com.dms.document.repository.DocumentRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DocumentProcessingRetryService {
    private final DocumentProcessingPublisher publisher;
    private final DocumentRepository documentRepository;
    private final DocumentProcessingProperties properties;

    public DocumentProcessingRetryService(DocumentProcessingPublisher publisher, DocumentRepository documentRepository, DocumentProcessingProperties properties) {
        this.publisher = publisher;
        this.documentRepository = documentRepository;
        this.properties = properties;
    }

    @Transactional
    public void handleFailure(DocumentProcessingMessage message) {
        if (message.attempt() < properties.maxRetryCount()) {
            publisher.publish(retryRoutingKey(message), message.nextAttempt());
            return;
        }
        documentRepository.findById(message.documentId()).ifPresent(document -> {
            document.setStatus(DocumentStatus.EXTRACTION_FAILED);
            documentRepository.save(document);
        });
        publisher.publish(DocumentProcessingRabbitConfig.DLQ_ROUTING_KEY, message);
    }

    private String retryRoutingKey(DocumentProcessingMessage message) {
        if (message.type() == DocumentProcessingTaskType.PREVIEW) {
            return previewRetryRoutingKey(message.attempt());
        }
        return extractRetryRoutingKey(message.attempt());
    }

    private String extractRetryRoutingKey(int attempt) {
        if (attempt <= 1) {
            return DocumentProcessingRabbitConfig.EXTRACT_RETRY_30S_ROUTING_KEY;
        }
        if (attempt == 2) {
            return DocumentProcessingRabbitConfig.EXTRACT_RETRY_5M_ROUTING_KEY;
        }
        return DocumentProcessingRabbitConfig.EXTRACT_RETRY_30M_ROUTING_KEY;
    }

    private String previewRetryRoutingKey(int attempt) {
        if (attempt <= 1) {
            return DocumentProcessingRabbitConfig.PREVIEW_RETRY_30S_ROUTING_KEY;
        }
        if (attempt == 2) {
            return DocumentProcessingRabbitConfig.PREVIEW_RETRY_5M_ROUTING_KEY;
        }
        return DocumentProcessingRabbitConfig.PREVIEW_RETRY_30M_ROUTING_KEY;
    }
}
