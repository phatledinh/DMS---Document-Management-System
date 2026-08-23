package com.dms.masterdata.repository;

import com.dms.masterdata.entity.Department;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DepartmentRepository extends JpaRepository<Department, Long> {
    List<Department> findByIsActiveTrueAndDeletedAtIsNull();
    List<Department> findByIdInAndDeletedAtIsNull(List<Long> ids);
    Optional<Department> findByIdAndDeletedAtIsNull(Long id);
    boolean existsByCodeAndDeletedAtIsNull(String code);
    boolean existsByCodeAndIdNotAndDeletedAtIsNull(String code, Long id);
}
