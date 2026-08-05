package com.dms.document.dto;

import java.util.List;

public record BatchUploadResponse(
        int total,
        int succeeded,
        int failed,
        List<BatchUploadItemResponse> items
) {
    public static BatchUploadResponse from(List<BatchUploadItemResponse> items) {
        int succeeded = (int) items.stream().filter(BatchUploadItemResponse::success).count();
        return new BatchUploadResponse(items.size(), succeeded, items.size() - succeeded, items);
    }
}
