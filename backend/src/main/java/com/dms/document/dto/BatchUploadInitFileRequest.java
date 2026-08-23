package com.dms.document.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;

import java.time.LocalDate;
import java.util.List;

public record BatchUploadInitFileRequest(
        @NotBlank String clientItemId,
        @NotBlank String fileName,
        @Positive long fileSize,
        @NotBlank String contentType,
        @NotBlank String title,
        Long categoryId,
        List<Long> tagIds,
        LocalDate effectiveDate,
        LocalDate expiryDate
) {
}
