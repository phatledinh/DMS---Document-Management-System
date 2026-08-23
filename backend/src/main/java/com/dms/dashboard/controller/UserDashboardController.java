package com.dms.dashboard.controller;

import com.dms.common.dto.ApiResponse;
import com.dms.common.security.CurrentUserProvider;
import com.dms.dashboard.dto.MyDocumentVersionResponse;
import com.dms.dashboard.dto.UserActivityResponse;
import com.dms.dashboard.dto.UserDashboardResponse;
import com.dms.dashboard.service.UserDashboardService;
import com.dms.document.dto.PageResponse;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.OffsetDateTime;

@RestController
@RequestMapping("/me")
public class UserDashboardController {
    private final CurrentUserProvider currentUserProvider;
    private final UserDashboardService userDashboardService;

    public UserDashboardController(CurrentUserProvider currentUserProvider, UserDashboardService userDashboardService) {
        this.currentUserProvider = currentUserProvider;
        this.userDashboardService = userDashboardService;
    }

    @GetMapping("/dashboard")
    public ApiResponse<UserDashboardResponse> dashboard() {
        Long userId = currentUserProvider.getRequiredUser().getId();
        return ApiResponse.success(userDashboardService.dashboard(userId));
    }

    @GetMapping("/activity-history")
    public ApiResponse<PageResponse<UserActivityResponse>> activityHistory(
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String permission,
            @RequestParam(required = false) String result,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime dateFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime dateTo,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size
    ) {
        Long userId = currentUserProvider.getRequiredUser().getId();
        return ApiResponse.success(userDashboardService.activityHistory(userId, action, category, permission, result, dateFrom, dateTo, page, size));
    }

    @GetMapping("/document-versions")
    public ApiResponse<PageResponse<MyDocumentVersionResponse>> documentVersions(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime dateFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime dateTo,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size
    ) {
        Long userId = currentUserProvider.getRequiredUser().getId();
        return ApiResponse.success(userDashboardService.myDocumentVersions(userId, keyword, category, status, dateFrom, dateTo, page, size));
    }
}
