package com.dms.identity.service;

import com.dms.audit.service.AuditLogService;
import com.dms.common.security.CurrentUserProvider;
import com.dms.identity.dto.UserResponse;
import com.dms.identity.dto.UserUpdateRequest;
import com.dms.identity.entity.Role;
import com.dms.identity.entity.User;
import com.dms.identity.entity.UserDepartment;
import com.dms.identity.entity.UserDepartmentId;
import com.dms.identity.entity.UserStatus;
import com.dms.identity.mapper.UserMapper;
import com.dms.identity.repository.UserDepartmentRepository;
import com.dms.identity.repository.UserRepository;
import com.dms.masterdata.entity.Department;
import com.dms.masterdata.repository.DepartmentRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {
    @Mock UserRepository userRepository;
    @Mock UserDepartmentRepository userDepartmentRepository;
    @Mock DepartmentRepository departmentRepository;
    @Mock UserMapper userMapper;
    @Mock PasswordEncoder passwordEncoder;
    @Mock AuditLogService audit;
    @Mock CurrentUserProvider currentUser;
    private UserService service;
    private final User actor = user(99L, "admin@dms.com");

    @BeforeEach
    void setUp() {
        service = new UserService(userRepository, userDepartmentRepository, departmentRepository, userMapper, passwordEncoder, audit, currentUser);
        when(currentUser.getRequiredUser()).thenReturn(actor);
        when(userRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void updateUser_departmentChange_logsNamesAndCodes() {
        User target = user(10L, "user@dms.com");
        when(userRepository.findByIdAndDeletedAtIsNull(10L)).thenReturn(Optional.of(target));
        when(userDepartmentRepository.findByUserId(10L)).thenReturn(List.of(member(10L, 1L)));
        when(userMapper.toResponse(any(User.class), anyList())).thenReturn(response(target, List.of(1L)), response(target, List.of(2L)));
        when(departmentRepository.findByIdInAndDeletedAtIsNull(anyList())).thenAnswer(invocation -> {
            List<Long> ids = invocation.getArgument(0);
            return List.of(department(1L, "Phòng A", "A"), department(2L, "Phòng B", "B")).stream().filter(department -> ids.contains(department.getId())).toList();
        });

        service.updateUser(10L, new UserUpdateRequest(null, null, null, List.of(2L), null, null, null));

        ArgumentCaptor<Object> oldCaptor = ArgumentCaptor.forClass(Object.class);
        ArgumentCaptor<Object> newCaptor = ArgumentCaptor.forClass(Object.class);
        verify(audit).log(eq(actor), eq("USER_DEPARTMENT_CHANGE"), eq("USER"), eq(10L), oldCaptor.capture(), newCaptor.capture());
        assertThat(oldCaptor.getValue()).isEqualTo(Map.of("userId", 10L, "departments", List.of(Map.of("id", 1L, "name", "Phòng A", "code", "A"))));
        assertThat(newCaptor.getValue()).isEqualTo(Map.of("userId", 10L, "departments", List.of(Map.of("id", 2L, "name", "Phòng B", "code", "B"))));
    }

    @Test
    void updateUser_sameDepartments_doesNotLogDepartmentChange() {
        User target = user(10L, "user@dms.com");
        when(userRepository.findByIdAndDeletedAtIsNull(10L)).thenReturn(Optional.of(target));
        when(userDepartmentRepository.findByUserId(10L)).thenReturn(List.of(member(10L, 1L)));
        when(userMapper.toResponse(any(User.class), anyList())).thenReturn(response(target, List.of(1L)));

        service.updateUser(10L, new UserUpdateRequest(null, null, null, List.of(1L), null, null, null));

        verify(audit, never()).log(eq(actor), eq("USER_DEPARTMENT_CHANGE"), any(), any(), any(), any());
    }

    @Test
    void createUser_logsResponseWithoutPassword() {
        User created = user(10L, "new@dms.com");
        UserResponse response = response(created, List.of(1L));
        when(passwordEncoder.encode("secret123")).thenReturn("encoded-secret");
        when(userRepository.save(any())).thenReturn(created);
        when(userMapper.toResponse(created, List.of(1L))).thenReturn(response);

        service.createUser(new com.dms.identity.dto.UserCreateRequest("New", "new@dms.com", "secret123", "090", 1L, null, Role.USER, UserStatus.ACTIVE));

        verify(audit).log(actor, "USER_CREATE", "USER", 10L, null, response);
        assertThat(response.toString()).doesNotContain("secret123", "encoded-secret");
    }

    private static User user(Long id, String email) {
        User user = new User(); user.setId(id); user.setEmail(email); user.setName("User"); user.setPassword("hash"); user.setRole(Role.USER); user.setStatus(UserStatus.ACTIVE); return user;
    }
    private static UserResponse response(User user, List<Long> departments) {
        return new UserResponse(user.getId(), user.getEmail(), user.getName(), null, null, user.getRole(), user.getDepartmentId(), departments, user.getStatus(), null);
    }
    private static UserDepartment member(Long userId, Long departmentId) {
        UserDepartment member = new UserDepartment(); member.setUserId(userId); member.setDepartmentId(departmentId); return member;
    }
    private static Department department(Long id, String name, String code) {
        Department department = new Department(); department.setId(id); department.setName(name); department.setCode(code); return department;
    }
}
