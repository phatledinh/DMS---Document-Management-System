package com.dms.document.dto;

import java.time.LocalDate;
import java.time.OffsetDateTime;

public record DocumentDetailResponse(
        Long id,
        String title,
        String slug,
        String description,
        String documentCode,
        String fileName,
        String fileType,
        String mimeType,
        Long fileSize,
        Integer pageCount,
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
        String previewUrlEndpoint,
        String downloadUrlEndpoint,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
}
