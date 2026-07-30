package com.dms.document.dto;

import java.time.OffsetDateTime;

public record UploadCompleteResponse(
        Long id,
        String status,
        String documentCode,
        String versionNumber,
        OffsetDateTime createdAt
) {
}
