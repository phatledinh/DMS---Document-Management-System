package com.dms.audit.controller;

import com.dms.audit.dto.AdminLogFilterRequest;
import com.dms.audit.dto.AdminLogResponse;
import com.dms.audit.service.AdminLogQueryService;
import com.dms.common.dto.ApiResponse;
import com.dms.document.dto.PageResponse;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.OffsetDateTime;

@RestController
@RequestMapping("/admin/audit-logs")
@PreAuthorize("hasRole('ADMIN')")
public class AdminLogController {
    private final AdminLogQueryService logQueryService;

    public AdminLogController(AdminLogQueryService logQueryService) {
        this.logQueryService = logQueryService;
    }

    @GetMapping
    public ApiResponse<PageResponse<AdminLogResponse>> search(
            @RequestParam(required = false) String logType,
            @RequestParam(required = false) Long actorId,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String targetType,
            @RequestParam(required = false) Long targetId,
            @RequestParam(required = false) Long documentId,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime dateFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime dateTo,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size
    ) {
        AdminLogFilterRequest filter = new AdminLogFilterRequest(logType, actorId, action, targetType, targetId, documentId, keyword, dateFrom, dateTo, page, size);
        return ApiResponse.success(logQueryService.search(filter));
    }
}
