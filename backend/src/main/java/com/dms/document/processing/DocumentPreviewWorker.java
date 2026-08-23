package com.dms.document.processing;

import com.dms.document.entity.Document;
import com.dms.document.entity.DocumentStatus;
import com.dms.document.repository.DocumentRepository;
import com.dms.document.repository.DocumentVersionRepository;
import com.dms.document.service.DocumentVersionService;
import com.rabbitmq.client.Channel;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.support.AmqpHeaders;
import org.springframework.context.annotation.Profile;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;

@Component
@Profile("worker")
public class DocumentPreviewWorker {
    private final DocumentRepository documentRepository;
    private final DocumentVersionRepository versionRepository;
    private final DocumentPreviewConversionService conversionService;
    private final DocumentContentService contentService;
    private final DocumentProcessingRetryService retryService;
    private final DocumentVersionService versionService;

    public DocumentPreviewWorker(
            DocumentRepository documentRepository,
            DocumentVersionRepository versionRepository,
            DocumentPreviewConversionService conversionService,
            DocumentContentService contentService,
            DocumentProcessingRetryService retryService,
            DocumentVersionService versionService
    ) {
        this.documentRepository = documentRepository;
        this.versionRepository = versionRepository;
        this.conversionService = conversionService;
        this.contentService = contentService;
        this.retryService = retryService;
        this.versionService = versionService;
    }

    @RabbitListener(queues = DocumentProcessingRabbitConfig.PREVIEW_QUEUE, ackMode = "MANUAL")
    @Transactional
    public void handle(DocumentProcessingMessage message, Channel channel, @Header(AmqpHeaders.DELIVERY_TAG) long deliveryTag) throws IOException {
        try {
            Document document = documentRepository.findById(message.documentId()).orElse(null);
            if (shouldSkip(document, message)) {
                channel.basicAck(deliveryTag, false);
                return;
            }
            conversionService.convert(document, message);
            channel.basicAck(deliveryTag, false);
        } catch (RuntimeException exception) {
            if (message.versionId() == null) {
                contentService.saveFailure(message.documentId(), "PREVIEW_CONVERSION", exception.getMessage(), message.attempt());
            } else {
                versionService.markVersionFailed(message.documentId(), message.versionId());
            }
            retryService.handleFailure(message);
            channel.basicAck(deliveryTag, false);
        }
    }

    private boolean shouldSkip(Document document, DocumentProcessingMessage message) {
        if (document == null || document.getStatus() == DocumentStatus.DELETED) {
            return true;
        }
        if (document.getStatus() != DocumentStatus.PROCESSING && document.getStatus() != DocumentStatus.INDEXED) {
            return true;
        }
        if (message.versionId() == null) {
            return !message.objectKey().equals(document.getStoragePath());
        }
        return versionRepository.findByIdAndDocumentId(message.versionId(), document.getId())
                .filter(version -> version.getStatus() == DocumentStatus.PROCESSING)
                .filter(version -> message.objectKey().equals(version.getStoragePath()))
                .isEmpty();
    }
}
