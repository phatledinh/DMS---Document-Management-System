package com.dms.dashboard.dto;

import java.util.List;

public record AccessStatsResponse(
        String granularity,
        List<AccessTrendPointResponse> trend
) {
}
