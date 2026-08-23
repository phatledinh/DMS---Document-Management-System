package com.dms.dashboard.dto;

import java.util.List;
import java.util.Map;

public record SystemAccessResponse(
        long totalLogins,
        long activeUsers,
        long uniqueAccessUsers,
        long viewCount,
        long previewCount,
        long downloadCount,
        long searchCount,
        long deniedAccessCount,
        Map<String, Long> accessByAction,
        List<AccessTrendPointResponse> accessTrend,
        List<TopUserAccessResponse> topUsersByAccess
) {
}
