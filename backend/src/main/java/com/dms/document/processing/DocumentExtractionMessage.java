package com.dms.document.processing;

public record DocumentExtractionMessage(
        Long documentId,
        String objectKey,
        String action
) {
}
