package com.dms.document.processing;

public record DocumentPreviewRequestedEvent(
        Long documentId,
        Long versionId,
        String objectKey,
        String mimeType
) {
}
