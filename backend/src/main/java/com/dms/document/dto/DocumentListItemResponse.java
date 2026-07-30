package com.dms.document.dto;

import java.time.LocalDate;
import java.time.OffsetDateTime;

public record DocumentListItemResponse(
        Long id,
        String title,
        String documentCode,
        String fileType,
        Long fileSize,
        String status,
        String visibility,
        String versionNumber,
        Integer viewCount,
        Integer downloadCount,
        Long categoryId,
        Long departmentId,
        Long ownerId,
        Long uploadedBy,
        LocalDate effectiveDate,
        LocalDate expiryDate,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
}
