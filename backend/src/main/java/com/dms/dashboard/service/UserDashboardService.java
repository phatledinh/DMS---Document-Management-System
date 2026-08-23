package com.dms.dashboard.service;

import com.dms.dashboard.dto.MyDocumentVersionResponse;
import com.dms.dashboard.dto.UserActivityResponse;
import com.dms.dashboard.dto.UserDashboardResponse;
import com.dms.dashboard.repository.UserDashboardQueryRepository;
import com.dms.document.dto.PageResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;

@Service
public class UserDashboardService {
    private static final int DEFAULT_PAGE = 0;
    private static final int DEFAULT_SIZE = 20;
    private static final int MAX_SIZE = 100;

    private final UserDashboardQueryRepository repository;

    public UserDashboardService(UserDashboardQueryRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public UserDashboardResponse dashboard(Long userId) {
        OffsetDateTime dateTo = OffsetDateTime.now();
        OffsetDateTime dateFrom = dateTo.minusDays(30);
        return new UserDashboardResponse(
                repository.metrics(userId, dateFrom, dateTo),
                repository.recentDocuments(userId, 5),
                repository.permissionGroups(userId),
                repository.recentActivities(userId, 5)
        );
    }

    @Transactional(readOnly = true)
    public PageResponse<UserActivityResponse> activityHistory(
            Long userId,
            String action,
            String category,
            String permission,
            String result,
            OffsetDateTime dateFrom,
            OffsetDateTime dateTo,
            Integer page,
            Integer size
    ) {
        return repository.activityHistory(userId, action, category, permission, result, dateFrom, dateTo, page(page), size(size));
    }

    @Transactional(readOnly = true)
    public PageResponse<MyDocumentVersionResponse> myDocumentVersions(
            Long userId,
            String keyword,
            String category,
            String status,
            OffsetDateTime dateFrom,
            OffsetDateTime dateTo,
            Integer page,
            Integer size
    ) {
        return repository.myDocumentVersions(userId, keyword, category, status, dateFrom, dateTo, page(page), size(size));
    }

    private int page(Integer page) {
        return page == null || page < 0 ? DEFAULT_PAGE : page;
    }

    private int size(Integer size) {
        return size == null || size < 1 ? DEFAULT_SIZE : Math.min(size, MAX_SIZE);
    }
}
