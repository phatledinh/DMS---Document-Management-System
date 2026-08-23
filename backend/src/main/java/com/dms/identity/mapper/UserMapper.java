package com.dms.identity.mapper;

import com.dms.identity.dto.UserResponse;
import com.dms.identity.entity.User;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class UserMapper {
    public UserResponse toResponse(User user) {
        return toResponse(user, user.getDepartmentId() == null ? List.of() : List.of(user.getDepartmentId()));
    }

    public UserResponse toResponse(User user, List<Long> departmentIds) {
        return new UserResponse(
                user.getId(),
                user.getEmail(),
                user.getName(),
                user.getPhone(),
                user.getAvatar(),
                user.getRole(),
                user.getDepartmentId(),
                departmentIds,
                user.getStatus(),
                user.getLastLogin()
        );
    }
}
