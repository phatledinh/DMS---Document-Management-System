package com.dms.document.dto;

import com.dms.document.entity.DocumentAccessLevel;
import com.dms.document.entity.DocumentStatus;
import org.springframework.format.annotation.DateTimeFormat;

import java.time.LocalDate;

public record DocumentSearchRequest(
        String q,
        Long categoryId,
        Long departmentId,
        String fileType,
        DocumentStatus status,
        DocumentAccessLevel visibility,
        DocumentAccessLevel accessLevel,
        Long ownerId,
        Long uploadedBy,
        java.util.List<Long> tagIds,
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate effectiveDateFrom,
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate effectiveDateTo,
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateFrom,
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateTo,
        String sort,
        Integer page,
        Integer size
) {
    public DocumentAccessLevel resolvedAccessLevel() {
        return accessLevel != null ? accessLevel : visibility;
    }

    public LocalDate resolvedDateFrom() {
        return dateFrom != null ? dateFrom : effectiveDateFrom;
    }

    public LocalDate resolvedDateTo() {
        return dateTo != null ? dateTo : effectiveDateTo;
    }
}
