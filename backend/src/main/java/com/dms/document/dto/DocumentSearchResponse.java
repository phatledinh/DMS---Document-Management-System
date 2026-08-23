package com.dms.document.dto;

import java.util.List;
import java.util.Map;

public record DocumentSearchResponse(
        List<DocumentSearchResultResponse> content,
        int page,
        int size,
        long totalElements,
        int totalPages,
        Map<String, List<SearchFacetValueResponse>> facets,
        String query,
        long searchTimeMs
) {
}
