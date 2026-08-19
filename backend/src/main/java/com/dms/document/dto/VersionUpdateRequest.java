package com.dms.document.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record VersionUpdateRequest(
        @NotBlank
        @Pattern(regexp = "^\\d+(\\.\\d+){1,2}$", message = "Version number phải theo định dạng X.Y hoặc X.Y.Z (vd: 1.0, 1.0.1)")
        String versionNumber,
        @NotBlank String changelog
) {
}
