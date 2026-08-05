package com.dms.dashboard.service;

import com.dms.dashboard.dto.AccessStatsResponse;
import com.dms.dashboard.dto.DashboardSummaryResponse;
import com.dms.dashboard.dto.ProcessingErrorResponse;
import com.dms.dashboard.dto.RecentUploadResponse;
import com.dms.dashboard.dto.StorageDashboardResponse;
import com.dms.dashboard.dto.SystemAccessResponse;
import com.dms.dashboard.dto.TopDocumentResponse;
import com.dms.dashboard.dto.TopSearchKeywordResponse;
import com.dms.dashboard.repository.DashboardQueryRepository;
import com.dms.document.dto.PageResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;

@Service
public class DashboardService {
    private static final int DEFAULT_LIMIT = 10;
    private static final int MAX_LIMIT = 100;
    private static final int DEFAULT_PAGE = 0;
    private static final int DEFAULT_SIZE = 20;
    private static final int MAX_SIZE = 100;

    private final DashboardQueryRepository repository;

    public DashboardService(DashboardQueryRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public DashboardSummaryResponse summary(OffsetDateTime dateFrom, OffsetDateTime dateTo) {
        StorageDashboardResponse storage = storage();
        return new DashboardSummaryResponse(
                repository.countDocuments(),
                repository.countUsers(),
                repository.countCategories(),
                repository.countDepartments(),
                repository.countDocumentsByStatus(),
                repository.countDocumentsByFileType(),
                storage.totalStorageMb(),
                repository.accessCount("PREVIEW", dateFrom, dateTo),
                repository.accessCount("DOWNLOAD", dateFrom, dateTo),
                repository.searchCount(dateFrom, dateTo),
                repository.loginCount(dateFrom, dateTo),
                repository.activeUserCount(dateFrom, dateTo),
                repository.processingErrorCount()
        );
    }

    @Transactional(readOnly = true)
    public StorageDashboardResponse storage() {
        long active = repository.activeStorageBytes();
        long trash = repository.trashStorageBytes();
        long version = repository.versionStorageBytes();
        long total = active + trash + version;
        return new StorageDashboardResponse(
                active,
                mb(active),
                trash,
                mb(trash),
                version,
                mb(version),
                total,
                mb(total),
                repository.countDocuments(),
                repository.trashDocumentCount()
        );
    }

    @Transactional(readOnly = true)
    public AccessStatsResponse accessStats(OffsetDateTime dateFrom, OffsetDateTime dateTo, String granularity) {
        String normalizedGranularity = granularity(granularity);
        return new AccessStatsResponse(normalizedGranularity, repository.accessTrend(dateFrom, dateTo, normalizedGranularity));
    }

    @Transactional(readOnly = true)
    public List<TopDocumentResponse> topDocuments(String metric, OffsetDateTime dateFrom, OffsetDateTime dateTo, Integer limit) {
        return repository.topDocuments(metric, dateFrom, dateTo, limit(limit));
    }

    @Transactional(readOnly = true)
    public PageResponse<RecentUploadResponse> recentUploads(Integer page, Integer size) {
        return repository.recentUploads(page(page), size(size));
    }

    @Transactional(readOnly = true)
    public List<TopSearchKeywordResponse> topSearchKeywords(OffsetDateTime dateFrom, OffsetDateTime dateTo, Integer limit) {
        return repository.topSearchKeywords(dateFrom, dateTo, limit(limit));
    }

    @Transactional(readOnly = true)
    public SystemAccessResponse systemAccess(OffsetDateTime dateFrom, OffsetDateTime dateTo, String granularity, Integer limit) {
        return new SystemAccessResponse(
                repository.loginCount(dateFrom, dateTo),
                repository.activeUserCount(dateFrom, dateTo),
                repository.activeUserCount(dateFrom, dateTo),
                repository.accessCount("VIEW", dateFrom, dateTo),
                repository.accessCount("PREVIEW", dateFrom, dateTo),
                repository.accessCount("DOWNLOAD", dateFrom, dateTo),
                repository.searchCount(dateFrom, dateTo),
                repository.deniedAccessCount(dateFrom, dateTo),
                repository.accessByAction(dateFrom, dateTo),
                repository.accessTrend(dateFrom, dateTo, granularity(granularity)),
                repository.topUsersByAccess(dateFrom, dateTo, limit(limit))
        );
    }

    @Transactional(readOnly = true)
    public PageResponse<ProcessingErrorResponse> processingErrors(Integer page, Integer size) {
        return repository.processingErrors(page(page), size(size));
    }

    private double mb(long bytes) {
        return Math.round((bytes / 1024.0 / 1024.0) * 100.0) / 100.0;
    }

    private int limit(Integer limit) {
        return limit == null || limit < 1 ? DEFAULT_LIMIT : Math.min(limit, MAX_LIMIT);
    }

    private int page(Integer page) {
        return page == null || page < 0 ? DEFAULT_PAGE : page;
    }

    private int size(Integer size) {
        return size == null || size < 1 ? DEFAULT_SIZE : Math.min(size, MAX_SIZE);
    }

    private String granularity(String granularity) {
        if (granularity == null || granularity.isBlank()) {
            return "day";
        }
        return switch (granularity.toLowerCase()) {
            case "week" -> "week";
            case "month" -> "month";
            default -> "day";
        };
    }
}
