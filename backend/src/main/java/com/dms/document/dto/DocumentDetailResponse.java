package com.dms.document.dto;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

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
        String previewUrlEndpoint,
        String downloadUrlEndpoint,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt,
        List<TagResponse> tags,
        List<AuthorizedDepartmentResponse> authorizedDepartments
) {
    public record TagResponse(
            Long id,
            String name
    ) {
    }

    public record AuthorizedDepartmentResponse(
            Long id,
            String name,
            String code
    ) {
    }
}
