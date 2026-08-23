package com.dms.document.dto;

public record PresignedUrlResponse(
        String url,
        String fileName,
        long expiresIn
) {
}
