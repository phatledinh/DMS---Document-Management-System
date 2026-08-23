package com.dms.dashboard.dto;

public record UserDashboardMetricResponse(
        String key,
        String label,
        long value,
        String detail
) {
}
