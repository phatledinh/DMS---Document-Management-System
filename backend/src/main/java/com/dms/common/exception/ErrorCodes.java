package com.dms.common.exception;

public final class ErrorCodes {
    public static final String ACCESS_DENIED = "ACCESS_DENIED";
    public static final String CONFLICT = "CONFLICT";
    public static final String NOT_FOUND = "NOT_FOUND";
    public static final String BATCH_OPERATION_PARTIAL_FAILED = "BATCH_OPERATION_PARTIAL_FAILED";
    public static final String DOCUMENT_NOT_FOUND = "DOCUMENT_NOT_FOUND";
    public static final String DOCUMENT_NOT_READY = "DOCUMENT_NOT_READY";
    public static final String DANGEROUS_FILE_TYPE = "DANGEROUS_FILE_TYPE";
    public static final String INTERNAL_ERROR = "INTERNAL_ERROR";
    public static final String METHOD_NOT_ALLOWED = "METHOD_NOT_ALLOWED";
    public static final String INVALID_ACCESS_LEVEL = "INVALID_ACCESS_LEVEL";
    public static final String INVALID_ACL_RULE = "INVALID_ACL_RULE";
    public static final String INVALID_CREDENTIALS = "INVALID_CREDENTIALS";
    public static final String INVALID_DOCUMENT_STATUS = "INVALID_DOCUMENT_STATUS";
    public static final String MIME_TYPE_MISMATCH = "MIME_TYPE_MISMATCH";
    public static final String PRESIGN_FAILED = "PRESIGN_FAILED";
    public static final String REFRESH_TOKEN_INVALID = "REFRESH_TOKEN_INVALID";
    public static final String UNAUTHORIZED = "UNAUTHORIZED";
    public static final String UPLOAD_NOT_COMPLETED = "UPLOAD_NOT_COMPLETED";
    public static final String UPLOAD_SIZE_MISMATCH = "UPLOAD_SIZE_MISMATCH";
    public static final String USER_DISABLED = "USER_DISABLED";
    public static final String VALIDATION_ERROR = "VALIDATION_ERROR";
    public static final String VERSION_DUPLICATE = "VERSION_DUPLICATE";
    public static final String VERSION_NOT_FOUND = "VERSION_NOT_FOUND";

    private ErrorCodes() {
    }
}
