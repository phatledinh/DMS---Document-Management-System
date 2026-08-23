package com.dms.storage;

public record ObjectMetadata(
        long contentLength,
        String contentType,
        String eTag
) {
}
