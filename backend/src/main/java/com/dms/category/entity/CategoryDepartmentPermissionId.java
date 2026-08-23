package com.dms.category.entity;

import java.io.Serializable;
import java.util.Objects;

public class CategoryDepartmentPermissionId implements Serializable {
    private Long categoryId;
    private Long departmentId;
    private CategoryPermission permission;

    public CategoryDepartmentPermissionId() {
    }

    public CategoryDepartmentPermissionId(Long categoryId, Long departmentId, CategoryPermission permission) {
        this.categoryId = categoryId;
        this.departmentId = departmentId;
        this.permission = permission;
    }

    @Override
    public boolean equals(Object object) {
        if (this == object) return true;
        if (!(object instanceof CategoryDepartmentPermissionId that)) return false;
        return Objects.equals(categoryId, that.categoryId)
                && Objects.equals(departmentId, that.departmentId)
                && permission == that.permission;
    }

    @Override
    public int hashCode() {
        return Objects.hash(categoryId, departmentId, permission);
    }
}
