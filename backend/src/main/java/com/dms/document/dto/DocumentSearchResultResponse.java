package com.dms.document.dto;

public record DocumentSearchResultResponse(
        DocumentListItemResponse document,
        double relevanceScore,
        int matchCount,
        DocumentSearchHighlightResponse highlight
) {
}
