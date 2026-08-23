package com.dms.audit.dto;

import java.time.OffsetDateTime;

public record AdminLogFilterRequest(
        String logType,
        Long actorId,
        String action,
        String targetType,
        Long targetId,
        Long documentId,
        String keyword,
        OffsetDateTime dateFrom,
        OffsetDateTime dateTo,
        Integer page,
        Integer size
) {
}
