package com.dms.category.repository;

import com.dms.category.entity.CategoryDepartmentPermission;
import com.dms.category.entity.CategoryDepartmentPermissionId;
import com.dms.category.entity.CategoryPermission;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Set;

public interface CategoryDepartmentPermissionRepository extends JpaRepository<CategoryDepartmentPermission, CategoryDepartmentPermissionId> {
    List<CategoryDepartmentPermission> findByCategoryId(Long categoryId);
    List<CategoryDepartmentPermission> findByCategoryIdIn(Collection<Long> categoryIds);
    void deleteByCategoryId(Long categoryId);

    @Query("""
            SELECT CASE WHEN count(cdp) > 0 THEN true ELSE false END
            FROM CategoryDepartmentPermission cdp
            JOIN UserDepartment ud ON ud.departmentId = cdp.departmentId
            WHERE ud.userId = :userId
              AND cdp.categoryId = :categoryId
              AND cdp.permission = :permission
            """)
    boolean existsForUserDepartment(@Param("userId") Long userId, @Param("categoryId") Long categoryId, @Param("permission") CategoryPermission permission);

    @Query("""
            SELECT DISTINCT cdp.permission
            FROM CategoryDepartmentPermission cdp
            JOIN UserDepartment ud ON ud.departmentId = cdp.departmentId
            WHERE ud.userId = :userId
              AND cdp.categoryId = :categoryId
            """)
    Set<CategoryPermission> findPermissionsForUser(@Param("userId") Long userId, @Param("categoryId") Long categoryId);
}
