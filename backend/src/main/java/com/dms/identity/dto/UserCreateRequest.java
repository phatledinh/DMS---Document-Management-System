package com.dms.identity.dto;

import com.dms.identity.entity.Role;
import com.dms.identity.entity.UserStatus;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public record UserCreateRequest(
        @NotBlank(message = "Tên không được để trống")
        @Size(max = 100)
        String name,

        @NotBlank(message = "Email không được để trống")
        @Email(message = "Định dạng email không hợp lệ")
        String email,

        @NotBlank(message = "Mật khẩu không được để trống")
        @Size(min = 6, message = "Mật khẩu phải có ít nhất 6 ký tự")
        String password,

        @NotBlank(message = "Số điện thoại không được để trống")
        String phone,

        Long departmentId,

        @NotEmpty(message = "Vui lòng chọn ít nhất một phòng ban")
        List<Long> departmentIds,

        @NotNull(message = "Role không được để trống")
        Role role,

        @NotNull(message = "Status không được để trống")
        UserStatus status
) {
}
