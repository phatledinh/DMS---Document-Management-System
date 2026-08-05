package com.dms.masterdata.service;

import com.dms.common.exception.AppException;
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

    @Transactional(readOnly = true)
    public DepartmentResponse getDepartmentById(Long id) {
        Department department = getDepartmentEntityById(id);
        return departmentMapper.toResponse(department);
    }

    @Transactional
    public DepartmentResponse createDepartment(DepartmentRequest request) {
        Department department = new Department();
        department.setName(request.name());
        department.setCode(request.code());
        department.setDescription(request.description());
        if (request.isActive() != null) {
            department.setActive(request.isActive());
        }
        
        department = departmentRepository.save(department);
        return departmentMapper.toResponse(department);
    }

    @Transactional
    public DepartmentResponse updateDepartment(Long id, DepartmentRequest request) {
        Department department = getDepartmentEntityById(id);
        
        department.setName(request.name());
        department.setCode(request.code());
        department.setDescription(request.description());
        if (request.isActive() != null) {
            department.setActive(request.isActive());
        }
        department.setUpdatedAt(OffsetDateTime.now());
        
        department = departmentRepository.save(department);
        return departmentMapper.toResponse(department);
    }

    @Transactional
    public void deleteDepartment(Long id) {
        Department department = getDepartmentEntityById(id);
        department.setDeletedAt(OffsetDateTime.now());
        department.setActive(false); // also set inactive
        departmentRepository.save(department);
    }
    
    private Department getDepartmentEntityById(Long id) {
        return departmentRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new AppException(ErrorCodes.NOT_FOUND, "Phòng ban không tồn tại", HttpStatus.NOT_FOUND));
    }
}
