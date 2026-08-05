package com.dms.identity.service;

import com.dms.common.exception.AppException;
import com.dms.common.exception.ErrorCodes;
import com.dms.identity.dto.UserCreateRequest;
import com.dms.identity.dto.UserResponse;
import com.dms.identity.dto.UserUpdateRequest;
import com.dms.identity.entity.User;
import com.dms.identity.entity.UserStatus;
import com.dms.identity.mapper.UserMapper;
import com.dms.identity.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class UserService {
    private final UserRepository userRepository;
    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;

    public UserService(UserRepository userRepository, UserMapper userMapper, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.userMapper = userMapper;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional(readOnly = true)
    public UserResponse getCurrentUser() {
        String email = currentUserEmail();
        User user = userRepository.findByEmailAndDeletedAtIsNull(email)
                .orElseThrow(() -> new AppException(ErrorCodes.UNAUTHORIZED, "Authentication is required", HttpStatus.UNAUTHORIZED));
        if (!user.isEnabled()) {
            throw new AppException(ErrorCodes.USER_DISABLED, "User is disabled", HttpStatus.FORBIDDEN);
        }
        return userMapper.toResponse(user);
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
        return userRepository.findByDeletedAtIsNull().stream()
                .map(userMapper::toResponse)
                .collect(Collectors.toList());
    }
    
    @Transactional(readOnly = true)
    public UserResponse getUserById(Long id) {
        User user = getUserEntityById(id);
        return userMapper.toResponse(user);
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
        user.setDepartmentId(request.departmentId());
        user.setRole(request.role());
        user.setStatus(request.status());
        
        user = userRepository.save(user);
        return userMapper.toResponse(user);
    }
    
    @Transactional
    public UserResponse updateUser(Long id, UserUpdateRequest request) {
        User user = getUserEntityById(id);
        
        if (request.name() != null) user.setName(request.name());
        if (request.phone() != null) user.setPhone(request.phone());
        if (request.departmentId() != null) user.setDepartmentId(request.departmentId());
        if (request.role() != null) user.setRole(request.role());
        if (request.status() != null) user.setStatus(request.status());
        
        if (request.password() != null && !request.password().isBlank()) {
            user.setPassword(passwordEncoder.encode(request.password()));
        }
        
        user.setUpdatedAt(OffsetDateTime.now());
        user = userRepository.save(user);
        return userMapper.toResponse(user);
    }
    
    @Transactional
    public void deleteUser(Long id) {
        User user = getUserEntityById(id);
        user.setDeletedAt(OffsetDateTime.now());
        user.setStatus(UserStatus.INACTIVE);
        userRepository.save(user);
    }
    
    private User getUserEntityById(Long id) {
        return userRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new AppException(ErrorCodes.NOT_FOUND, "Người dùng không tồn tại", HttpStatus.NOT_FOUND));
    }
}
