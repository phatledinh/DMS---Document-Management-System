package com.dms.document.processing;

public record DocumentExtractionRequestedEvent(
        Long documentId,
        Long versionId,
        String objectKey,
        String mimeType
) {
}
