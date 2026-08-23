package com.dms.masterdata.dto;

import java.time.OffsetDateTime;

public record TagResponse(
        Long id,
        String name,
        String slug,
        OffsetDateTime createdAt,
        long documentCount
) {
}
