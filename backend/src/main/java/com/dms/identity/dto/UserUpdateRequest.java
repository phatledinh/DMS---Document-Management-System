package com.dms.identity.dto;

import com.dms.identity.entity.Role;
import com.dms.identity.entity.UserStatus;
import jakarta.validation.constraints.Size;

public record UserUpdateRequest(
        @Size(max = 100)
        String name,

        String phone,
        
        Long departmentId,

        Role role,

        UserStatus status,
        
        @Size(min = 6, message = "Mật khẩu phải có ít nhất 6 ký tự")
        String password
) {
}
