package com.dms.category.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;

@Entity
@IdClass(CategoryDepartmentPermissionId.class)
@Table(name = "category_department_permissions")
public class CategoryDepartmentPermission {
    @Id
    @Column(name = "category_id")
    private Long categoryId;

    @Id
    @Column(name = "department_id")
    private Long departmentId;

    @Id
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private CategoryPermission permission;

    @Column(name = "granted_by", nullable = false)
    private Long grantedBy;

    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private OffsetDateTime createdAt;

    public Long getCategoryId() {
        return categoryId;
    }

    public void setCategoryId(Long categoryId) {
        this.categoryId = categoryId;
    }

    public Long getDepartmentId() {
        return departmentId;
    }

    public void setDepartmentId(Long departmentId) {
        this.departmentId = departmentId;
    }

    public CategoryPermission getPermission() {
        return permission;
    }

    public void setPermission(CategoryPermission permission) {
        this.permission = permission;
    }

    public Long getGrantedBy() {
        return grantedBy;
    }

    public void setGrantedBy(Long grantedBy) {
        this.grantedBy = grantedBy;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }
}
