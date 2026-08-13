package com.dms.dashboard.dto;

import java.time.OffsetDateTime;

public record UserActivityResponse(
        String id,
        String action,
        String category,
        String requiredPermission,
        String result,
        String resultType,
        String detail,
        OffsetDateTime createdAt
) {
}
