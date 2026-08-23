package com.dms.dashboard.dto;

import java.util.Map;

public record DashboardSummaryResponse(
        long totalDocuments,
        long totalUsers,
        long totalCategories,
        long totalDepartments,
        Map<String, Long> documentsByStatus,
        Map<String, Long> documentsByFileType,
        double totalStorageMb,
        long totalPreviewCount,
        long totalDownloadCount,
        long totalSearchCount,
        long totalLoginCount,
        long activeUserCount,
        long processingErrorCount
) {
}
