package com.dms.document.processing;

public record DocumentExtractionRequestedEvent(
        Long documentId,
        String objectKey
) {
}
