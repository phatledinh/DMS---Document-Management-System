package com.dms.document.dto;

import java.util.Map;

public record VersionUploadInitResponse(
        Long documentId,
        Long versionId,
        String objectKey,
        String uploadUrl,
        String method,
        Map<String, String> requiredHeaders,
        long expiresIn
) {
}
