package com.dms.document.dto;

public record DocumentSearchResultResponse(
        DocumentListItemResponse document,
        double relevanceScore,
        DocumentSearchHighlightResponse highlight
) {
}
