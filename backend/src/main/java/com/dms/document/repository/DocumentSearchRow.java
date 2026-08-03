package com.dms.document.repository;

import java.time.LocalDate;
import java.time.OffsetDateTime;

public record DocumentSearchRow(
        Long id,
        String title,
        String documentCode,
        String fileType,
        Long fileSize,
        String status,
        String accessLevel,
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
        OffsetDateTime updatedAt,
        double relevanceScore,
        String titleHighlight,
        String descriptionHighlight,
        String contentHighlight
) {
}
