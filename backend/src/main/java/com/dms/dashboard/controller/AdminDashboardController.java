package com.dms.dashboard.controller;

import com.dms.common.dto.ApiResponse;
import com.dms.dashboard.dto.AccessStatsResponse;
import com.dms.dashboard.dto.DashboardSummaryResponse;
import com.dms.dashboard.dto.ProcessingErrorResponse;
import com.dms.dashboard.dto.RecentUploadResponse;
import com.dms.dashboard.dto.StorageDashboardResponse;
import com.dms.dashboard.dto.SystemAccessResponse;
import com.dms.dashboard.dto.TopDocumentResponse;
import com.dms.dashboard.dto.TopSearchKeywordResponse;
import com.dms.dashboard.service.DashboardService;
import com.dms.document.dto.PageResponse;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.OffsetDateTime;
import java.util.List;

@RestController
@RequestMapping("/admin/dashboard")
@PreAuthorize("hasRole('ADMIN')")
public class AdminDashboardController {
    private final DashboardService dashboardService;

    public AdminDashboardController(DashboardService dashboardService) {
        this.dashboardService = dashboardService;
    }

    @GetMapping("/summary")
    public ApiResponse<DashboardSummaryResponse> summary(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime dateFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime dateTo
    ) {
        return ApiResponse.success(dashboardService.summary(dateFrom, dateTo));
    }

    @GetMapping("/storage")
    public ApiResponse<StorageDashboardResponse> storage() {
        return ApiResponse.success(dashboardService.storage());
    }

    @GetMapping("/access-stats")
    public ApiResponse<AccessStatsResponse> accessStats(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime dateFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime dateTo,
            @RequestParam(required = false) String granularity
    ) {
        return ApiResponse.success(dashboardService.accessStats(dateFrom, dateTo, granularity));
    }

    @GetMapping("/top-documents")
    public ApiResponse<List<TopDocumentResponse>> topDocuments(
            @RequestParam(required = false) String metric,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime dateFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime dateTo,
            @RequestParam(required = false) Integer limit
    ) {
        return ApiResponse.success(dashboardService.topDocuments(metric, dateFrom, dateTo, limit));
    }

    @GetMapping("/recent-uploads")
    public ApiResponse<PageResponse<RecentUploadResponse>> recentUploads(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size
    ) {
        return ApiResponse.success(dashboardService.recentUploads(page, size));
    }

    @GetMapping("/top-search-keywords")
    public ApiResponse<List<TopSearchKeywordResponse>> topSearchKeywords(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime dateFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime dateTo,
            @RequestParam(required = false) Integer limit
    ) {
        return ApiResponse.success(dashboardService.topSearchKeywords(dateFrom, dateTo, limit));
    }

    @GetMapping("/system-access")
    public ApiResponse<SystemAccessResponse> systemAccess(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime dateFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime dateTo,
            @RequestParam(required = false) String granularity,
            @RequestParam(required = false) Integer limit
    ) {
        return ApiResponse.success(dashboardService.systemAccess(dateFrom, dateTo, granularity, limit));
    }

    @GetMapping("/processing-errors")
    public ApiResponse<PageResponse<ProcessingErrorResponse>> processingErrors(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size
    ) {
        return ApiResponse.success(dashboardService.processingErrors(page, size));
    }
}
