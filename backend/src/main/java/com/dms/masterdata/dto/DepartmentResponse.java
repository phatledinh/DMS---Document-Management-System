package com.dms.masterdata.dto;

import java.time.OffsetDateTime;

public record DepartmentResponse(
        Long id,
        String name,
        String code,
        String description,
        boolean isActive,
        OffsetDateTime createdAt
) {
}
