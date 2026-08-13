package com.dms.dashboard.dto;

import java.util.List;

public record UserPermissionGroupResponse(
        Long categoryId,
        String categoryName,
        List<String> permissions
) {
}
