package com.dms.approval.dto;

import java.time.OffsetDateTime;
import java.time.LocalDate;
import java.util.List;

public record ApprovalItemResponse(
        Long id,
        String documentCode,
        String title,
        String status,
        String submitter,
        OffsetDateTime submittedAt,
        String department,
        String category,
        String fileType,
        long fileSize,
        List<String> tags,
        String summary,
        LocalDate effectiveDate,
        LocalDate expiryDate,
        String slug
) {
}
