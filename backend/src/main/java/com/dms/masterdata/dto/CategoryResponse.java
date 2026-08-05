package com.dms.masterdata.dto;

import java.time.OffsetDateTime;

public record CategoryResponse(
        Long id,
        Long parentId,
        String name,
        String slug,
        String description,
        String icon,
        int sortOrder,
        boolean isActive,
        OffsetDateTime createdAt
) {
}
