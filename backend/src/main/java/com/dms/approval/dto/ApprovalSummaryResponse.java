package com.dms.approval.dto;

public record ApprovalSummaryResponse(
        long pending,
        long approved,
        long rejected
) {
}
