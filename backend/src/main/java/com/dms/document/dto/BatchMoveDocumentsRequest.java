package com.dms.document.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public record BatchMoveDocumentsRequest(
        @NotEmpty List<Long> documentIds,
        @NotNull Long targetCategoryId
) {
}
