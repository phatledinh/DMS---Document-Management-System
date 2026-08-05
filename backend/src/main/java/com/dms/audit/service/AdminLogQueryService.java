package com.dms.audit.service;

import com.dms.audit.dto.AdminLogFilterRequest;
import com.dms.audit.dto.AdminLogResponse;
import com.dms.audit.repository.AdminLogQueryRepository;
import com.dms.document.dto.PageResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminLogQueryService {
    private static final int DEFAULT_PAGE = 0;
    private static final int DEFAULT_SIZE = 20;
    private static final int MAX_SIZE = 100;

    private final AdminLogQueryRepository repository;

    public AdminLogQueryService(AdminLogQueryRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public PageResponse<AdminLogResponse> search(AdminLogFilterRequest filter) {
        return repository.search(filter, page(filter.page()), size(filter.size()));
    }

    private int page(Integer page) {
        return page == null || page < 0 ? DEFAULT_PAGE : page;
    }

    private int size(Integer size) {
        return size == null || size < 1 ? DEFAULT_SIZE : Math.min(size, MAX_SIZE);
    }
}
