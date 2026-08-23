package com.dms.identity.dto;

public record RefreshResponse(
        String accessToken,
        String tokenType,
        long expiresIn
) {
}
