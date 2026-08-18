package com.dms.masterdata.dto;

import java.time.OffsetDateTime;
import java.util.List;

public record CategoryResponse(
        Long id,
        Long parentId,
        String name,
        String slug,
        String description,
        String icon,
        int sortOrder,
        boolean isActive,
        OffsetDateTime createdAt,
        List<DepartmentPermissionResponse> departmentPermissions,
        long documentCount
) {
    public record DepartmentPermissionResponse(
            Long departmentId,
            List<String> permissions
    ) {
    }
}
