package com.dms.common.security;

import com.dms.common.exception.AppException;
import com.dms.common.exception.ErrorCodes;
import com.dms.identity.entity.User;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

@Component
public class CurrentUserProvider {
    public User getRequiredUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated() || !(authentication.getPrincipal() instanceof User user)) {
            throw new AppException(ErrorCodes.UNAUTHORIZED, "Authentication is required", HttpStatus.UNAUTHORIZED);
        }
        return user;
    }
}
