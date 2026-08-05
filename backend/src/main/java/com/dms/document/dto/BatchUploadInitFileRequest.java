package com.dms.document.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;

public record BatchUploadInitFileRequest(
        @NotBlank String clientItemId,
        @NotBlank String fileName,
        @Positive long fileSize,
        @NotBlank String contentType,
        @NotBlank String title
) {
}
