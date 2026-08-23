package com.dms.document.dto;

import java.time.OffsetDateTime;

public record VersionUploadCompleteResponse(
        Long id,
        Long documentId,
        String versionNumber,
        String documentStatus,
        OffsetDateTime createdAt
) {
}
