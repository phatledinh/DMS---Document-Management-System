package com.dms.document.dto;

import java.time.OffsetDateTime;

public record DocumentVersionResponse(
        Long id,
        Long documentId,
        String versionNumber,
        String fileName,
        Long fileSize,
        String mimeType,
        String status,
        String changelog,
        boolean current,
        Long uploadedBy,
        OffsetDateTime createdAt
) {
}
