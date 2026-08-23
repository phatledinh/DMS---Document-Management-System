package com.dms.identity.repository;

import com.dms.identity.entity.UserDepartment;
import com.dms.identity.entity.UserDepartmentId;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface UserDepartmentRepository extends JpaRepository<UserDepartment, UserDepartmentId> {
    List<UserDepartment> findByUserId(Long userId);
    List<UserDepartment> findByUserIdIn(Collection<Long> userIds);
    void deleteByUserId(Long userId);
}
