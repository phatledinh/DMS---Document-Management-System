package com.dms.document.dto;

import java.time.OffsetDateTime;

public record DocumentLifecycleResponse(
        Long id,
        String status,
        OffsetDateTime archivedAt,
        OffsetDateTime deletedAt,
        OffsetDateTime purgeAfter,
        OffsetDateTime restoredAt
) {
}
