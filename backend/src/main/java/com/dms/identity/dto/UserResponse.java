package com.dms.identity.dto;

import com.dms.identity.entity.Role;
import com.dms.identity.entity.UserStatus;

import java.time.OffsetDateTime;

public record UserResponse(
        Long id,
        String email,
        String name,
        String phone,
        String avatar,
        Role role,
        Long departmentId,
        UserStatus status,
        OffsetDateTime lastLogin
) {
}
