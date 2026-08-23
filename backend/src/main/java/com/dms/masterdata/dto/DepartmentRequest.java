package com.dms.masterdata.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record DepartmentRequest(
        @NotBlank(message = "Tên phòng ban không được để trống")
        @Size(max = 255)
        String name,

        @NotBlank(message = "Mã phòng ban không được để trống")
        @Size(max = 50)
        String code,

        String description,

        Boolean isActive
) {
}
