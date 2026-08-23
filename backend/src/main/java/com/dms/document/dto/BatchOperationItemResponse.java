package com.dms.document.dto;

public record BatchOperationItemResponse(
        Long documentId,
        boolean success,
        String status,
        Long previousCategoryId,
        Long categoryId,
        String errorCode,
        String message
) {
    public static BatchOperationItemResponse success(Long documentId, String status) {
        return new BatchOperationItemResponse(documentId, true, status, null, null, null, null);
    }

    public static BatchOperationItemResponse moved(Long documentId, Long previousCategoryId, Long categoryId) {
        return new BatchOperationItemResponse(documentId, true, null, previousCategoryId, categoryId, null, null);
    }

    public static BatchOperationItemResponse failure(Long documentId, String errorCode, String message) {
        return new BatchOperationItemResponse(documentId, false, null, null, null, errorCode, message);
    }
}
