package com.dms.dashboard.dto;

public record UserRecentDocumentResponse(
        Long id,
        String title,
        String documentCode,
        String categoryName,
        String status
) {
}
