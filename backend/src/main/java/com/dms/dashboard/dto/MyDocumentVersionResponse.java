package com.dms.dashboard.dto;

import java.time.OffsetDateTime;

public record MyDocumentVersionResponse(
        Long documentId,
        String documentTitle,
        String documentCode,
        Long versionId,
        String versionNumber,
        boolean current,
        String note,
        long fileSize,
        OffsetDateTime uploadedAt,
        String categoryName,
        String status,
        boolean canView
) {
}
