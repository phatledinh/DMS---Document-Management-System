package com.dms.storage;

public record PresignedGetUrl(
        String url,
        long expiresIn
) {
}
