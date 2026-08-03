package com.dms.document.dto;

public record SearchFacetValueResponse(
        String value,
        String label,
        long count
) {
}
