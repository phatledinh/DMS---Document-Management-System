package com.dms.document.dto;

import com.dms.document.entity.DocumentAccessLevel;
import com.dms.document.entity.DocumentStatus;
import org.springframework.format.annotation.DateTimeFormat;

import java.time.LocalDate;

public record DocumentSearchRequest(
        Long categoryId,
        Long departmentId,
        String fileType,
        DocumentStatus status,
        DocumentAccessLevel visibility,
        Long ownerId,
        Long uploadedBy,
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate effectiveDateFrom,
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate effectiveDateTo,
        String sort,
        Integer page,
        Integer size
) {
}
