package com.dms.approval.dto;

public record ApprovalDecisionResponse(
        Long documentId,
        String status
) {
}
