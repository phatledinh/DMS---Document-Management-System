package com.dms.category.policy;

import com.dms.category.entity.CategoryPermission;
import com.dms.category.repository.CategoryDepartmentPermissionRepository;
import com.dms.identity.entity.Role;
import com.dms.identity.entity.User;
import org.springframework.stereotype.Service;

import java.util.Set;

@Service
public class CategoryAccessPolicyService {
    private final CategoryDepartmentPermissionRepository departmentPermissionRepository;

    public CategoryAccessPolicyService(CategoryDepartmentPermissionRepository departmentPermissionRepository) {
        this.departmentPermissionRepository = departmentPermissionRepository;
    }

    public boolean canAccessCategory(User user, Long categoryId) {
        return isActive(user);
    }

    public boolean hasPermission(User user, Long categoryId, CategoryPermission permission) {
        if (!isActive(user) || categoryId == null || permission == null) {
            return false;
        }
        if (user.getRole() == Role.ADMIN) {
            return true;
        }
        return departmentPermissionRepository.existsForUserDepartment(user.getId(), categoryId, permission);
    }

    public Set<CategoryPermission> getPermissions(User user, Long categoryId) {
        if (!isActive(user) || categoryId == null) {
            return Set.of();
        }
        if (user.getRole() == Role.ADMIN) {
            return Set.of(CategoryPermission.VIEW, CategoryPermission.UPLOAD, CategoryPermission.DOWNLOAD, CategoryPermission.EDIT, CategoryPermission.DELETE);
        }
        return departmentPermissionRepository.findPermissionsForUser(user.getId(), categoryId);
    }

    private boolean isActive(User user) {
        return user != null && user.isEnabled();
    }
}
