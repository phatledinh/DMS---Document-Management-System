package com.dms.identity.mapper;

import com.dms.identity.dto.UserResponse;
import com.dms.identity.entity.User;
import org.springframework.stereotype.Component;

@Component
public class UserMapper {
    public UserResponse toResponse(User user) {
        return new UserResponse(
                user.getId(),
                user.getEmail(),
                user.getName(),
                user.getPhone(),
                user.getAvatar(),
                user.getRole(),
                user.getDepartmentId(),
                user.getStatus(),
                user.getLastLogin()
        );
    }
}
