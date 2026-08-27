package com.dms.approval.dto;

public record ApprovalDecisionResponse(
        Long documentId,
        Long versionId,
        String status
) {
}
