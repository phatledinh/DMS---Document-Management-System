package com.dms.document.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;

public record VersionUploadInitRequest(
        @NotBlank String fileName,
        @Positive long fileSize,
        @NotBlank String contentType,
        @NotBlank String versionNumber,
        @NotBlank String changelog
) {
}
