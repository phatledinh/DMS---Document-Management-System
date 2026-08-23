package com.dms.document.dto;

import java.util.List;

public record BatchOperationResponse(
        int total,
        int succeeded,
        int failed,
        List<BatchOperationItemResponse> items
) {
    public static BatchOperationResponse from(List<BatchOperationItemResponse> items) {
        int succeeded = (int) items.stream().filter(BatchOperationItemResponse::success).count();
        return new BatchOperationResponse(items.size(), succeeded, items.size() - succeeded, items);
    }
}
