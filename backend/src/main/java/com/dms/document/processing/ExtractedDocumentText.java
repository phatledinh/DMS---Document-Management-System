package com.dms.document.processing;

public record ExtractedDocumentText(
        String text,
        String method,
        String language
) {
}
