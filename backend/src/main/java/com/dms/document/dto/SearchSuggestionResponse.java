package com.dms.document.dto;

public record SearchSuggestionResponse(
        String text,
        String type,
        Long documentId
) {
}
