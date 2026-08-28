package com.dms.masterdata.service;

import com.dms.audit.service.AuditLogService;
import com.dms.common.exception.AppException;
import com.dms.common.security.CurrentUserProvider;
import com.dms.common.exception.ErrorCodes;
import com.dms.masterdata.dto.DepartmentRequest;
import com.dms.masterdata.dto.DepartmentResponse;
import com.dms.masterdata.entity.Department;
import com.dms.masterdata.mapper.DepartmentMapper;
import com.dms.masterdata.repository.DepartmentRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class DepartmentService {
    private final DepartmentRepository departmentRepository;
    private final DepartmentMapper departmentMapper;
    private final AuditLogService auditLogService;
    private final CurrentUserProvider currentUserProvider;

    public DepartmentService(DepartmentRepository departmentRepository, DepartmentMapper departmentMapper, AuditLogService auditLogService, CurrentUserProvider currentUserProvider) {
        this.departmentRepository = departmentRepository;
        this.departmentMapper = departmentMapper;
        this.auditLogService = auditLogService;
        this.currentUserProvider = currentUserProvider;
    }

    @Transactional(readOnly = true)
    public List<DepartmentResponse> getAllActiveDepartments() {
        return departmentRepository.findByIsActiveTrueAndDeletedAtIsNull().stream()
                .map(departmentMapper::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public DepartmentResponse getDepartmentById(Long id) {
        Department department = getDepartmentEntityById(id);
        return departmentMapper.toResponse(department);
    }

    @Transactional
    public DepartmentResponse createDepartment(DepartmentRequest request) {
        if (departmentRepository.existsByCodeAndDeletedAtIsNull(request.code())) {
            throw new AppException(ErrorCodes.CONFLICT, "Mã phòng ban đã được sử dụng", HttpStatus.CONFLICT);
        }

        Department department = new Department();
        department.setName(request.name());
        department.setCode(request.code());
        department.setDescription(request.description());
        if (request.isActive() != null) {
            department.setActive(request.isActive());
        }

        department = departmentRepository.save(department);
        DepartmentResponse response = departmentMapper.toResponse(department);
        auditLogService.log(currentUserProvider.getRequiredUser(), "DEPARTMENT_CREATE", "DEPARTMENT", department.getId(), null, response);
        return response;
    }

    @Transactional
    public DepartmentResponse updateDepartment(Long id, DepartmentRequest request) {
        Department department = getDepartmentEntityById(id);
        DepartmentResponse oldValue = departmentMapper.toResponse(department);
        if (departmentRepository.existsByCodeAndIdNotAndDeletedAtIsNull(request.code(), id)) {
            throw new AppException(ErrorCodes.CONFLICT, "Mã phòng ban đã được sử dụng", HttpStatus.CONFLICT);
        }

        department.setName(request.name());
        department.setCode(request.code());
        department.setDescription(request.description());
        if (request.isActive() != null) {
            department.setActive(request.isActive());
        }
        department.setUpdatedAt(OffsetDateTime.now());

        department = departmentRepository.save(department);
        DepartmentResponse response = departmentMapper.toResponse(department);
        auditLogService.log(currentUserProvider.getRequiredUser(), "DEPARTMENT_UPDATE", "DEPARTMENT", id, oldValue, response);
        return response;
    }

    @Transactional
    public void deleteDepartment(Long id) {
        Department department = getDepartmentEntityById(id);
        DepartmentResponse oldValue = departmentMapper.toResponse(department);
        department.setDeletedAt(OffsetDateTime.now());
        department.setActive(false); // also set inactive
        departmentRepository.save(department);
        auditLogService.log(currentUserProvider.getRequiredUser(), "DEPARTMENT_DELETE", "DEPARTMENT", id, oldValue, null);
    }
    
    private Department getDepartmentEntityById(Long id) {
        return departmentRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new AppException(ErrorCodes.NOT_FOUND, "Phòng ban không tồn tại", HttpStatus.NOT_FOUND));
    }
}
