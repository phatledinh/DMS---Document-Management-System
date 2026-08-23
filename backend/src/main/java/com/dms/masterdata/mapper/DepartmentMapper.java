package com.dms.masterdata.mapper;

import com.dms.masterdata.dto.DepartmentResponse;
import com.dms.masterdata.entity.Department;
import org.springframework.stereotype.Component;

@Component
public class DepartmentMapper {
    public DepartmentResponse toResponse(Department department) {
        return new DepartmentResponse(
                department.getId(),
                department.getName(),
                department.getCode(),
                department.getDescription(),
                department.isActive(),
                department.getCreatedAt()
        );
    }
}
