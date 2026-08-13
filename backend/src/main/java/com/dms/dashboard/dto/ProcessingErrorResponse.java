package com.dms.dashboard.dto;

import java.time.OffsetDateTime;

public record ProcessingErrorResponse(
        Long documentId,
        String slug,
        String title,
        String fileType,
        String status,
        Integer retryCount,
        String errorMessage,
        OffsetDateTime updatedAt
) {
}
