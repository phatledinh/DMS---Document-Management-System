package com.dms.document.processing;

import java.time.OffsetDateTime;
import java.util.UUID;

public record DocumentProcessingMessage(
        String taskId,
        DocumentProcessingTaskType type,
        Long documentId,
        Long versionId,
        String objectKey,
        String mimeType,
        int attempt,
        OffsetDateTime issuedAt
) {
    public static DocumentProcessingMessage extract(Long documentId, Long versionId, String objectKey, String mimeType) {
        return new DocumentProcessingMessage(
                UUID.randomUUID().toString(),
                DocumentProcessingTaskType.EXTRACT,
                documentId,
                versionId,
                objectKey,
                mimeType,
                1,
                OffsetDateTime.now()
        );
    }

    public DocumentProcessingMessage nextAttempt() {
        return new DocumentProcessingMessage(taskId, type, documentId, versionId, objectKey, mimeType, attempt + 1, OffsetDateTime.now());
    }
}
