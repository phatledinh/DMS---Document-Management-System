package com.dms.document.dto;

public record BatchDocumentLifecycleFailure(
        Long documentId,
        String code,
        String message
) {
}
