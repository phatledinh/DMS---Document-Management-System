package com.dms.dashboard.dto;

public record TopSearchKeywordResponse(
        String keyword,
        long searchCount,
        double averageResultCount,
        double averageLatencyMs
) {
}
