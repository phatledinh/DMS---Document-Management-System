package com.dms.document.dto;

import jakarta.validation.constraints.NotEmpty;

import java.util.List;

public record DocumentIdsRequest(
        @NotEmpty List<Long> documentIds
) {
}
