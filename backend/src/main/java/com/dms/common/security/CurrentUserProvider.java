package com.dms.common.security;

import com.dms.common.exception.AppException;
import com.dms.common.exception.ErrorCodes;
import com.dms.identity.entity.User;
import com.dms.identity.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

@Component
public class CurrentUserProvider {

    private final UserRepository userRepository;

    public CurrentUserProvider(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public User getRequiredUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new AppException(ErrorCodes.UNAUTHORIZED, "Authentication is required", HttpStatus.UNAUTHORIZED);
        }
        
        String email;
        Object principal = authentication.getPrincipal();
        if (principal instanceof User user) {
            return user;
        } else if (principal instanceof Jwt jwt) {
            email = jwt.getSubject();
        } else {
            email = authentication.getName();
        }

        System.out.println("DEBUG: Extracted email from authentication: " + email);

        User user = userRepository.findByEmailAndDeletedAtIsNull(email)
                .orElseThrow(() -> {
                    System.out.println("DEBUG: User not found in DB for email: " + email);
                    return new AppException(ErrorCodes.UNAUTHORIZED, "Authentication is required", HttpStatus.UNAUTHORIZED);
                });
                
        if (!user.isEnabled()) {
            throw new AppException(ErrorCodes.USER_DISABLED, "User is disabled", HttpStatus.FORBIDDEN);
        }
        
        return user;
    }
}

