package com.dms.storage;

import java.time.OffsetDateTime;
import java.util.Map;

public record PresignedPutUrl(
        String url,
        String method,
        Map<String, String> requiredHeaders,
        long expiresIn,
        OffsetDateTime expiresAt
) {
}
