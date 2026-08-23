package com.dms.document.dto;

public record DocumentSearchHighlightResponse(
        String title,
        String description,
        String content
) {
}
