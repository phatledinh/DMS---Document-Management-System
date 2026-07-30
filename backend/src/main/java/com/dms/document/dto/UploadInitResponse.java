package com.dms.document.dto;

import java.util.Map;

public record UploadInitResponse(
        Long documentId,
        String status,
        String objectKey,
        String uploadUrl,
        String method,
        Map<String, String> requiredHeaders,
        long expiresIn
) {
}
