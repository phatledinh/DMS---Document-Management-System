package com.dms.document.dto;

import java.util.Map;

public record BatchUploadItemResponse(
        String clientItemId,
        String fileName,
        boolean success,
        Long documentId,
        String documentCode,
        String status,
        String objectKey,
        String uploadUrl,
        String method,
        Map<String, String> requiredHeaders,
        Long expiresIn,
        String errorCode,
        String message
) {
    public static BatchUploadItemResponse success(String clientItemId, String fileName, UploadInitResponse response) {
        return new BatchUploadItemResponse(
                clientItemId,
                fileName,
                true,
                response.documentId(),
                null,
                response.status(),
                response.objectKey(),
                response.uploadUrl(),
                response.method(),
                response.requiredHeaders(),
                response.expiresIn(),
                null,
                null
        );
    }

    public static BatchUploadItemResponse completeSuccess(String clientItemId, UploadCompleteResponse response) {
        return new BatchUploadItemResponse(
                clientItemId,
                null,
                true,
                response.id(),
                response.documentCode(),
                response.status(),
                null,
                null,
                null,
                null,
                null,
                null,
                null
        );
    }

    public static BatchUploadItemResponse failure(String clientItemId, String fileName, String errorCode, String message) {
        return new BatchUploadItemResponse(clientItemId, fileName, false, null, null, null, null, null, null, null, null, errorCode, message);
    }

    public static BatchUploadItemResponse documentFailure(String clientItemId, Long documentId, String errorCode, String message) {
        return new BatchUploadItemResponse(clientItemId, null, false, documentId, null, null, null, null, null, null, null, errorCode, message);
    }
}
