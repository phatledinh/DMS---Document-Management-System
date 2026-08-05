package com.dms.dashboard.dto;

public record TopUserAccessResponse(
        Long userId,
        String name,
        String department,
        long accessCount
) {
}
