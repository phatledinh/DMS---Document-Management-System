package com.dms.identity.entity;

import java.io.Serializable;
import java.util.Objects;

public class UserDepartmentId implements Serializable {
    private Long userId;
    private Long departmentId;

    public UserDepartmentId() {
    }

    public UserDepartmentId(Long userId, Long departmentId) {
        this.userId = userId;
        this.departmentId = departmentId;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public Long getDepartmentId() {
        return departmentId;
    }

    public void setDepartmentId(Long departmentId) {
        this.departmentId = departmentId;
    }

    @Override
    public boolean equals(Object object) {
        if (this == object) {
            return true;
        }
        if (!(object instanceof UserDepartmentId that)) {
            return false;
        }
        return Objects.equals(userId, that.userId) && Objects.equals(departmentId, that.departmentId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(userId, departmentId);
    }
}
