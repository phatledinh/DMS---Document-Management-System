package com.dms.masterdata.service;

import com.dms.masterdata.dto.DepartmentResponse;
import com.dms.masterdata.mapper.DepartmentMapper;
import com.dms.masterdata.repository.DepartmentRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class DepartmentService {
    private final DepartmentRepository departmentRepository;
    private final DepartmentMapper departmentMapper;

    public DepartmentService(DepartmentRepository departmentRepository, DepartmentMapper departmentMapper) {
        this.departmentRepository = departmentRepository;
        this.departmentMapper = departmentMapper;
    }

    @Transactional(readOnly = true)
    public List<DepartmentResponse> getAllActiveDepartments() {
        return departmentRepository.findByIsActiveTrueAndDeletedAtIsNull().stream()
                .map(departmentMapper::toResponse)
                .collect(Collectors.toList());
    }
}
