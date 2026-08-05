package com.dms.dashboard.dto;

import java.time.OffsetDateTime;

public record TopDocumentResponse(
        Long id,
        String title,
        String documentCode,
        long viewCount,
        long downloadCount,
        OffsetDateTime lastAccessedAt
) {
}
