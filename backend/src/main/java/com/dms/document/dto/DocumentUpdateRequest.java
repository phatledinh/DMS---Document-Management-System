package com.dms.document.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.List;

public record DocumentUpdateRequest(
        @NotBlank @Size(max = 500) String title,
        @Size(max = 10000) String description,
        @NotNull Long categoryId,
        List<Long> tagIds,
        LocalDate effectiveDate,
        LocalDate expiryDate
) {
}
