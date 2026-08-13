package com.dms.dashboard.dto;

import java.util.List;

public record UserDashboardResponse(
        List<UserDashboardMetricResponse> metrics,
        List<UserRecentDocumentResponse> recentDocuments,
        List<UserPermissionGroupResponse> permissionGroups,
        List<UserActivityResponse> recentActivities
) {
}
