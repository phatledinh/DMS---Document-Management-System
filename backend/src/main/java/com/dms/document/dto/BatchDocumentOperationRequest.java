package com.dms.document.dto;

import jakarta.validation.constraints.NotEmpty;

import java.util.List;

public record BatchDocumentOperationRequest(
        @NotEmpty List<Long> documentIds
) {
}
