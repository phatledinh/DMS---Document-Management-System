package com.dms.identity.service;

import com.dms.audit.service.AuditLogService;
import com.dms.common.exception.AppException;
import com.dms.common.security.CurrentUserProvider;
import com.dms.common.exception.ErrorCodes;
import com.dms.identity.dto.UserCreateRequest;
import com.dms.identity.dto.UserResponse;
import com.dms.identity.dto.UserUpdateRequest;
import com.dms.identity.entity.User;
import com.dms.identity.entity.UserDepartment;
import com.dms.identity.entity.UserStatus;
import com.dms.identity.mapper.UserMapper;
import com.dms.identity.repository.UserDepartmentRepository;
import com.dms.identity.repository.UserRepository;
import com.dms.masterdata.entity.Department;
import com.dms.masterdata.repository.DepartmentRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class UserService {
    private final UserRepository userRepository;
    private final UserDepartmentRepository userDepartmentRepository;
    private final DepartmentRepository departmentRepository;
    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;
    private final AuditLogService auditLogService;
    private final CurrentUserProvider currentUserProvider;

    public UserService(UserRepository userRepository, UserDepartmentRepository userDepartmentRepository, DepartmentRepository departmentRepository, UserMapper userMapper, PasswordEncoder passwordEncoder, AuditLogService auditLogService, CurrentUserProvider currentUserProvider) {
        this.userRepository = userRepository;
        this.userDepartmentRepository = userDepartmentRepository;
        this.departmentRepository = departmentRepository;
        this.userMapper = userMapper;
        this.passwordEncoder = passwordEncoder;
        this.auditLogService = auditLogService;
        this.currentUserProvider = currentUserProvider;
    }

    @Transactional(readOnly = true)
    public UserResponse getCurrentUser() {
        String email = currentUserEmail();
        User user = userRepository.findByEmailAndDeletedAtIsNull(email)
                .orElseThrow(() -> new AppException(ErrorCodes.UNAUTHORIZED, "Authentication is required", HttpStatus.UNAUTHORIZED));
        if (!user.isEnabled()) {
            throw new AppException(ErrorCodes.USER_DISABLED, "User is disabled", HttpStatus.FORBIDDEN);
        }
        return toResponse(user);
    }

    private String currentUserEmail() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new AppException(ErrorCodes.UNAUTHORIZED, "Authentication is required", HttpStatus.UNAUTHORIZED);
        }
        Object principal = authentication.getPrincipal();
        if (principal instanceof Jwt jwt) {
            return jwt.getSubject();
        }
        return authentication.getName();
    }

    @Transactional(readOnly = true)
    public List<UserResponse> getAllUsers() {
        List<User> users = userRepository.findByDeletedAtIsNull();
        Map<Long, List<Long>> departmentIdsByUserId = departmentIdsByUserId(users);
        return users.stream()
                .map(user -> userMapper.toResponse(user, departmentIdsByUserId.getOrDefault(user.getId(), fallbackDepartmentIds(user))))
                .collect(Collectors.toList());
    }
    
    @Transactional(readOnly = true)
    public UserResponse getUserById(Long id) {
        User user = getUserEntityById(id);
        return toResponse(user);
    }
    
    @Transactional
    public UserResponse createUser(UserCreateRequest request) {
        if (userRepository.existsByEmailAndDeletedAtIsNull(request.email())) {
            throw new AppException(ErrorCodes.CONFLICT, "Email đã được sử dụng", HttpStatus.CONFLICT);
        }
        
        User user = new User();
        user.setName(request.name());
        user.setEmail(request.email());
        user.setPassword(passwordEncoder.encode(request.password()));
        user.setPhone(request.phone());
        List<Long> departmentIds = new ArrayList<>();
        if (request.departmentIds() != null && !request.departmentIds().isEmpty()) {
            departmentIds = normalizeDepartmentIds(request.departmentIds());
        } else if (request.departmentId() != null) {
            departmentIds = List.of(request.departmentId());
        }
        user.setDepartmentId(primaryDepartmentId(departmentIds));
        user.setRole(request.role());
        user.setStatus(request.status());

        user = userRepository.save(user);
        syncDepartmentMemberships(user.getId(), departmentIds);
        UserResponse response = userMapper.toResponse(user, departmentIds);
        auditLogService.log(currentUserProvider.getRequiredUser(), "USER_CREATE", "USER", user.getId(), null, response);
        return response;
    }
    
    @Transactional
    public UserResponse updateUser(Long id, UserUpdateRequest request) {
        User user = getUserEntityById(id);
        UserResponse oldValue = auditUserSnapshot(user);
        List<Long> previousDepartmentIds = currentDepartmentIds(user.getId());
        if (request.phone() != null) user.setPhone(request.phone());
        List<Long> departmentIds = null;
        if (request.departmentIds() != null) {
            departmentIds = normalizeDepartmentIds(request.departmentIds());
            user.setDepartmentId(primaryDepartmentId(departmentIds));
        } else if (request.departmentId() != null) {
            departmentIds = List.of(request.departmentId());
            user.setDepartmentId(request.departmentId());
        }
        if (request.role() != null) user.setRole(request.role());
        if (request.status() != null) user.setStatus(request.status());
        
        if (request.password() != null && !request.password().isBlank()) {
            user.setPassword(passwordEncoder.encode(request.password()));
        }
        
        user.setUpdatedAt(OffsetDateTime.now());
        user = userRepository.save(user);
        if (departmentIds != null) {
            syncDepartmentMemberships(user.getId(), departmentIds);
            UserResponse response = userMapper.toResponse(user, departmentIds);
            auditLogService.log(currentUserProvider.getRequiredUser(), "USER_UPDATE", "USER", id, oldValue, response);
            if (!new LinkedHashSet<>(previousDepartmentIds).equals(new LinkedHashSet<>(departmentIds))) {
                auditLogService.log(currentUserProvider.getRequiredUser(), "USER_DEPARTMENT_CHANGE", "USER", id,
                        departmentSnapshot(id, previousDepartmentIds),
                        departmentSnapshot(id, departmentIds));
            }
            return response;
        }
        UserResponse response = toResponse(user);
        auditLogService.log(currentUserProvider.getRequiredUser(), "USER_UPDATE", "USER", id, oldValue, response);
        return response;
    }
    
    @Transactional
    public void deleteUser(Long id) {
        User user = getUserEntityById(id);
        UserResponse oldValue = auditUserSnapshot(user);
        user.setDeletedAt(OffsetDateTime.now());
        user.setStatus(UserStatus.INACTIVE);
        userRepository.save(user);
        auditLogService.log(currentUserProvider.getRequiredUser(), "USER_DELETE", "USER", id, oldValue, null);
    }
    
    private UserResponse toResponse(User user) {
        List<Long> departmentIds = userDepartmentRepository.findByUserId(user.getId()).stream()
                .map(UserDepartment::getDepartmentId)
                .collect(Collectors.toList());
        return userMapper.toResponse(user, departmentIds.isEmpty() ? fallbackDepartmentIds(user) : departmentIds);
    }

    private Map<Long, List<Long>> departmentIdsByUserId(Collection<User> users) {
        List<Long> userIds = users.stream().map(User::getId).toList();
        return userDepartmentRepository.findByUserIdIn(userIds).stream()
                .collect(Collectors.groupingBy(UserDepartment::getUserId, Collectors.mapping(UserDepartment::getDepartmentId, Collectors.toList())));
    }

    private List<Long> fallbackDepartmentIds(User user) {
        return user.getDepartmentId() == null ? List.of() : List.of(user.getDepartmentId());
    }

    private List<Long> normalizeDepartmentIds(List<Long> departmentIds) {
        if (departmentIds == null) return List.of();
        return new ArrayList<>(new LinkedHashSet<>(departmentIds.stream()
                .filter(departmentId -> departmentId != null)
                .toList()));
    }

    private Long primaryDepartmentId(List<Long> departmentIds) {
        return departmentIds.isEmpty() ? null : departmentIds.get(0);
    }

    private void syncDepartmentMemberships(Long userId, List<Long> departmentIds) {
        userDepartmentRepository.deleteByUserId(userId);
        List<UserDepartment> rows = departmentIds.stream()
                .map(departmentId -> {
                    UserDepartment row = new UserDepartment();
                    row.setUserId(userId);
                    row.setDepartmentId(departmentId);
                    return row;
                })
                .toList();
        userDepartmentRepository.saveAll(rows);
    }

    private UserResponse auditUserSnapshot(User user) {
        return userMapper.toResponse(user, currentDepartmentIds(user.getId()));
    }

    private List<Long> currentDepartmentIds(Long userId) {
        return userDepartmentRepository.findByUserId(userId).stream()
                .map(UserDepartment::getDepartmentId)
                .toList();
    }

    private Map<String, Object> departmentSnapshot(Long userId, List<Long> departmentIds) {
        List<Map<String, Object>> departmentsSnapshot = departmentIds.isEmpty() ? List.of() : departmentRepository.findByIdInAndDeletedAtIsNull(departmentIds).stream()
                .collect(Collectors.toMap(Department::getId, department -> department)).entrySet().stream()
                .sorted(java.util.Map.Entry.comparingByKey())
                .map(entry -> {
                    Department department = entry.getValue();
                    Map<String, Object> snapshot = new LinkedHashMap<>();
                    snapshot.put("id", department.getId());
                    snapshot.put("name", department.getName());
                    snapshot.put("code", department.getCode());
                    return snapshot;
                }).toList();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("userId", userId);
        result.put("departments", departmentsSnapshot);
        return result;
    }

    private User getUserEntityById(Long id) {
        return userRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new AppException(ErrorCodes.NOT_FOUND, "Người dùng không tồn tại", HttpStatus.NOT_FOUND));
    }
}
