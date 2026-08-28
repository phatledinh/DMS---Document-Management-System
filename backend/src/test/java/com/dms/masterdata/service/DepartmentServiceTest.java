package com.dms.masterdata.service;

import com.dms.audit.service.AuditLogService;
import com.dms.common.security.CurrentUserProvider;
import com.dms.masterdata.dto.DepartmentRequest;
import com.dms.masterdata.dto.DepartmentResponse;
import com.dms.masterdata.entity.Department;
import com.dms.masterdata.mapper.DepartmentMapper;
import com.dms.masterdata.repository.DepartmentRepository;
import com.dms.identity.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DepartmentServiceTest {
    @Mock DepartmentRepository repository;
    @Mock DepartmentMapper mapper;
    @Mock AuditLogService audit;
    @Mock CurrentUserProvider currentUser;
    private DepartmentService service;
    private final User actor = new User();

    @BeforeEach
    void setUp() {
        service = new DepartmentService(repository, mapper, audit, currentUser);
        when(currentUser.getRequiredUser()).thenReturn(actor);
        when(repository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void createDepartment_logsCreateSnapshot() {
        Department department = department(7L, "Phòng A", "A");
        DepartmentResponse response = new DepartmentResponse(7L, "Phòng A", "A", "desc", true, null);
        when(repository.save(any())).thenReturn(department);
        when(mapper.toResponse(department)).thenReturn(response);

        service.createDepartment(new DepartmentRequest("Phòng A", "A", "desc", true));

        verify(audit).log(actor, "DEPARTMENT_CREATE", "DEPARTMENT", 7L, null, response);
    }

    @Test
    void updateDepartment_logsOldAndNewSnapshots() {
        Department department = department(7L, "Cũ", "A");
        DepartmentResponse oldValue = new DepartmentResponse(7L, "Cũ", "A", null, true, null);
        DepartmentResponse newValue = new DepartmentResponse(7L, "Mới", "B", null, true, null);
        when(repository.findByIdAndDeletedAtIsNull(7L)).thenReturn(Optional.of(department));
        when(repository.existsByCodeAndIdNotAndDeletedAtIsNull("B", 7L)).thenReturn(false);
        when(mapper.toResponse(department)).thenReturn(oldValue, newValue);

        service.updateDepartment(7L, new DepartmentRequest("Mới", "B", null, true));

        verify(audit).log(actor, "DEPARTMENT_UPDATE", "DEPARTMENT", 7L, oldValue, newValue);
    }

    @Test
    void deleteDepartment_logsPreviousSnapshot() {
        Department department = department(7L, "Phòng A", "A");
        DepartmentResponse oldValue = new DepartmentResponse(7L, "Phòng A", "A", null, true, null);
        when(repository.findByIdAndDeletedAtIsNull(7L)).thenReturn(Optional.of(department));
        when(mapper.toResponse(department)).thenReturn(oldValue);

        service.deleteDepartment(7L);

        verify(audit).log(actor, "DEPARTMENT_DELETE", "DEPARTMENT", 7L, oldValue, null);
    }

    private Department department(Long id, String name, String code) {
        Department department = new Department();
        department.setId(id);
        department.setName(name);
        department.setCode(code);
        return department;
    }
}
