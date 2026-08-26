package com.dms.document.entity;

public enum DocumentStatus {
    AWAITING_UPLOAD,
    PROCESSING,
    PENDING_APPROVAL,
    INDEXED,
    EXTRACTION_FAILED,
    REJECTED,
    ARCHIVED,
    DELETED
}
