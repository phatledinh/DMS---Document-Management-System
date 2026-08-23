package com.dms.identity.dto;

import com.dms.identity.entity.Role;
import com.dms.identity.entity.UserStatus;

import java.time.OffsetDateTime;
import java.util.List;

public record UserResponse(
        Long id,
        String email,
        String name,
        String phone,
        String avatar,
        Role role,
        Long departmentId,
        List<Long> departmentIds,
        UserStatus status,
        OffsetDateTime lastLogin
) {
}
