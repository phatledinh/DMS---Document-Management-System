package com.dms.dashboard.dto;

public record StorageDashboardResponse(
        long activeStorageBytes,
        double activeStorageMb,
        long trashStorageBytes,
        double trashStorageMb,
        long versionStorageBytes,
        double versionStorageMb,
        long totalStorageBytes,
        double totalStorageMb,
        long documentCount,
        long trashDocumentCount
) {
}
