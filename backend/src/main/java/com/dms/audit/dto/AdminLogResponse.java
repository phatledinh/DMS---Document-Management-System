package com.dms.audit.dto;

import java.time.OffsetDateTime;

public record AdminLogResponse(
        Long id,
        String logType,
        Long actorId,
        String actorName,
        String action,
        String targetType,
        Long targetId,
        Long documentId,
        String documentTitle,
        String keyword,
        Long resultCount,
        Long latencyMs,
        Boolean accessGranted,
        String denialReason,
        String ipAddress,
        String userAgent,
        String oldValue,
        String newValue,
        String filters,
        OffsetDateTime createdAt
) {
}
