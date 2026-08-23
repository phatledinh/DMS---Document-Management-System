package com.dms.document.dto;

public record PopularSearchKeywordResponse(
        String keyword,
        long searchCount
) {
}
