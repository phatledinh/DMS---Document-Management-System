package com.dms.document.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;

import java.time.LocalDate;
import java.util.List;

public record BatchUploadInitRequest(
        @NotEmpty List<@Valid BatchUploadInitFileRequest> files,
        Long categoryId,
        Long departmentId,
        List<Long> tagIds,
        Long ownerId,
        LocalDate effectiveDate,
        LocalDate expiryDate
) {
}
