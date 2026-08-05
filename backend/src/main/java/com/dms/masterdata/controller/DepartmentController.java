package com.dms.masterdata.controller;

import com.dms.common.dto.ApiResponse;
import com.dms.masterdata.dto.DepartmentRequest;
import com.dms.masterdata.dto.DepartmentResponse;
import com.dms.masterdata.service.DepartmentService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
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

    @GetMapping("/{id}")
    public ApiResponse<DepartmentResponse> getDepartmentById(@PathVariable Long id) {
        return ApiResponse.success(departmentService.getDepartmentById(id));
    }

    @PostMapping
    public ApiResponse<DepartmentResponse> createDepartment(@Valid @RequestBody DepartmentRequest request) {
        return ApiResponse.success(departmentService.createDepartment(request));
    }
    
    @PutMapping("/{id}")
    public ApiResponse<DepartmentResponse> updateDepartment(@PathVariable Long id, @Valid @RequestBody DepartmentRequest request) {
        return ApiResponse.success(departmentService.updateDepartment(id, request));
    }
    
    @DeleteMapping("/{id}")
    public ApiResponse<Void> deleteDepartment(@PathVariable Long id) {
        departmentService.deleteDepartment(id);
        return ApiResponse.success(null);
    }
}
