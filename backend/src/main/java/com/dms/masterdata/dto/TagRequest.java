package com.dms.masterdata.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record TagRequest(
        @NotBlank(message = "Tên tag không được để trống")
        @Size(max = 100)
        String name,

        @Size(max = 100)
        String slug
) {
}
