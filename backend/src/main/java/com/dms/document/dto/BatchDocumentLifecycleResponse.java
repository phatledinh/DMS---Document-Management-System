package com.dms.document.dto;

import java.util.List;

public record BatchDocumentLifecycleResponse(
        int successCount,
        int failureCount,
        List<DocumentLifecycleResponse> successes,
        List<BatchDocumentLifecycleFailure> failures
) {
}
