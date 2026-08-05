package com.dms.document.dto;

import java.time.OffsetDateTime;

public record TrashDocumentResponse(
        Long id,
        String title,
        String documentCode,
        String fileName,
        String fileType,
        Long fileSize,
        String status,
        String previousStatus,
        Long categoryId,
        Long deletedBy,
        OffsetDateTime deletedAt,
        OffsetDateTime purgeAfter,
        long daysUntilPurge
) {
}
