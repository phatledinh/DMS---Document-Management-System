package com.dms.document.dto;

import jakarta.validation.constraints.NotNull;

public record BatchUploadCompleteItemRequest(
        String clientItemId,
        @NotNull Long documentId
) {
}
