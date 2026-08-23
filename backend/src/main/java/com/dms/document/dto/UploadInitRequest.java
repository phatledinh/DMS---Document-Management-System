package com.dms.document.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.time.LocalDate;
import java.util.List;

public record UploadInitRequest(
        @NotBlank String fileName,
        @Positive long fileSize,
        @NotBlank String contentType,
        @NotBlank String title,
        String description,
        @NotNull Long categoryId,
        Long departmentId,
        List<Long> tagIds,
        Long ownerId,
        LocalDate effectiveDate,
        LocalDate expiryDate
) {
}
