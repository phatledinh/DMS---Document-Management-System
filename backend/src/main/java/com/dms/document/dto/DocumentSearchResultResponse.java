package com.dms.document.dto;

public record DocumentSearchResultResponse(
        DocumentListItemResponse document,
        double relevanceScore,
        boolean exactCodeMatch,
        int matchCount,
        DocumentSearchHighlightResponse highlight
) {
}
