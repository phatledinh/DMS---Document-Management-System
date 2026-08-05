package com.dms.masterdata.controller;

import com.dms.common.dto.ApiResponse;
import com.dms.masterdata.dto.DepartmentResponse;
import com.dms.masterdata.service.DepartmentService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/departments")
public class DepartmentController {
    private final DepartmentService departmentService;

    public DepartmentController(DepartmentService departmentService) {
        this.departmentService = departmentService;
    }

    @GetMapping
    public ApiResponse<List<DepartmentResponse>> getAllDepartments() {
        return ApiResponse.success(departmentService.getAllActiveDepartments());
    }
}
