package com.dms.identity.dto;

import com.dms.identity.entity.Role;
import com.dms.identity.entity.UserStatus;
import jakarta.validation.constraints.Size;

import java.util.List;

public record UserUpdateRequest(
        @Size(max = 100)
        String name,

        String phone,

        Long departmentId,

        List<Long> departmentIds,

        Role role,

        UserStatus status,

        @Size(min = 6, message = "Mật khẩu phải có ít nhất 6 ký tự")
        String password
) {
}
