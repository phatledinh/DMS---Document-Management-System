package com.dms.category.policy;

import com.dms.identity.entity.Role;
import com.dms.identity.entity.User;
import org.springframework.stereotype.Service;

@Service
public class CategoryAccessPolicyService {
    public boolean canAccessCategory(User user, Long categoryId) {
        return isActive(user);
    }

    public boolean hasCategoryAudience(User user, Long categoryId) {
        return isActive(user) && user.getRole() == Role.ADMIN;
    }

    private boolean isActive(User user) {
        return user != null && user.isEnabled();
    }
}
