package com.dms.dashboard.dto;

import java.time.OffsetDateTime;

public record RecentUploadResponse(
        Long id,
        String title,
        String documentCode,
        String fileType,
        Long fileSize,
        String status,
        Long uploadedBy,
        String uploaderName,
        OffsetDateTime createdAt
) {
}
