package com.dms.approval.controller;

import com.dms.approval.dto.ApprovalDecisionRequest;
import com.dms.approval.dto.ApprovalDecisionResponse;
import com.dms.approval.dto.ApprovalItemResponse;
import com.dms.approval.dto.ApprovalSummaryResponse;
import com.dms.approval.service.AdminApprovalService;
import com.dms.common.dto.ApiResponse;
import com.dms.common.security.CurrentUserProvider;
import com.dms.document.dto.PageResponse;
import com.dms.identity.entity.User;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/admin/approvals")
@PreAuthorize("hasRole('ADMIN')")
public class AdminApprovalController {
    private final AdminApprovalService approvalService;
    private final CurrentUserProvider currentUserProvider;

    public AdminApprovalController(AdminApprovalService approvalService, CurrentUserProvider currentUserProvider) {
        this.approvalService = approvalService;
        this.currentUserProvider = currentUserProvider;
    }

    @GetMapping
    public ApiResponse<PageResponse<ApprovalItemResponse>> search(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String department,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size
    ) {
        return ApiResponse.success(approvalService.search(status, keyword, department, category, page, size));
    }

    @GetMapping("/summary")
    public ApiResponse<ApprovalSummaryResponse> summary() {
        return ApiResponse.success(approvalService.summary());
    }

    @PostMapping("/{documentId}/approve")
    public ApiResponse<ApprovalDecisionResponse> approve(@PathVariable Long documentId) {
        User admin = currentUserProvider.getRequiredUser();
        return ApiResponse.success("Document approved", approvalService.approve(documentId, admin));
    }

    @PostMapping("/{documentId}/reject")
    public ApiResponse<ApprovalDecisionResponse> reject(@PathVariable Long documentId, @RequestBody(required = false) ApprovalDecisionRequest request) {
        User admin = currentUserProvider.getRequiredUser();
        return ApiResponse.success("Document rejected", approvalService.reject(documentId, request == null ? null : request.reason(), admin));
    }
}
