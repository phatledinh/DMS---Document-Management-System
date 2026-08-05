package com.dms.document.dto;

import com.dms.document.entity.DocumentAccessLevel;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.util.List;

public record BatchUploadInitRequest(
        @NotEmpty List<@Valid BatchUploadInitFileRequest> files,
        @NotNull Long categoryId,
        Long departmentId,
        List<Long> tagIds,
        DocumentAccessLevel visibility,
        DocumentAccessLevel accessLevel,
        List<Long> departmentIds,
        Long ownerId,
        List<Long> sharedUserIds,
        LocalDate effectiveDate,
        LocalDate expiryDate
) {
    public DocumentAccessLevel resolvedAccessLevel() {
        return visibility != null ? visibility : accessLevel;
    }
}
