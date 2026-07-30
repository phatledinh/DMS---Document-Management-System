package com.dms.identity.dto;

public record AuthResult<T>(
        T response,
        String refreshToken,
        long refreshMaxAgeSeconds
) {
}
