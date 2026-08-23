package com.dms.document.dto;

public record VersionRestoreResponse(
        Long documentId,
        Long currentVersionId,
        String versionNumber,
        String status
) {
}
