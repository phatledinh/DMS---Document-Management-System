package com.dms.masterdata.repository;

import com.dms.masterdata.entity.Category;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CategoryRepository extends JpaRepository<Category, Long> {
    List<Category> findByDeletedAtIsNullOrderBySortOrderAscNameAsc();
    List<Category> findByIsActiveTrueAndDeletedAtIsNullOrderBySortOrderAscNameAsc();
    Optional<Category> findByIdAndDeletedAtIsNull(Long id);
    boolean existsBySlugAndDeletedAtIsNull(String slug);
    boolean existsBySlugAndIdNotAndDeletedAtIsNull(String slug, Long id);
}
