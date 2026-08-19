package com.dms.dashboard.dto;

public record UserRecentDocumentResponse(
        Long id,
        String slug,
        String title,
        String documentCode,
        String categoryName,
        String status
) {
}
