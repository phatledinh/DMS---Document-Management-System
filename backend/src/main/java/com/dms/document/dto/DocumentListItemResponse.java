package com.dms.document.dto;

import java.time.LocalDate;
import java.time.OffsetDateTime;

public record DocumentListItemResponse(
        Long id,
        String slug,
        String title,
        String documentCode,
        String fileType,
        Long fileSize,
        String status,
        String versionNumber,
        Integer viewCount,
        Integer downloadCount,
        Long categoryId,
        Long departmentId,
        Long ownerId,
        Long uploadedBy,
        String categoryName,
        String departmentName,
        String uploadedByName,
        LocalDate effectiveDate,
        LocalDate expiryDate,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
}
