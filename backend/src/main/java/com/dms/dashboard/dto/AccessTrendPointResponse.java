package com.dms.dashboard.dto;

public record AccessTrendPointResponse(
        String date,
        long previews,
        long downloads,
        long views,
        long searches,
        long logins,
        long uniqueUsers
) {
}
