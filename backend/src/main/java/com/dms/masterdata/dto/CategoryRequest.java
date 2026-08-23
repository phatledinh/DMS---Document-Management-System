package com.dms.masterdata.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

public record CategoryRequest(
        Long parentId,

        @NotBlank(message = "Tên danh mục không được để trống")
        @Size(max = 255)
        String name,

        @Size(max = 255)
        String slug,

        String description,

        @Size(max = 100)
        String icon,

        Integer sortOrder,

        Boolean isActive,

        List<DepartmentPermissionRequest> departmentPermissions
) {
    public record DepartmentPermissionRequest(
            Long departmentId,
            List<String> permissions
    ) {
    }
}
