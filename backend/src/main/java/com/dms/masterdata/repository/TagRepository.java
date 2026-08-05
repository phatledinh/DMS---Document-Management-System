package com.dms.masterdata.repository;

import com.dms.masterdata.entity.Tag;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TagRepository extends JpaRepository<Tag, Long> {
    List<Tag> findByDeletedAtIsNullOrderByNameAsc();
    Optional<Tag> findByIdAndDeletedAtIsNull(Long id);
    boolean existsByNameAndDeletedAtIsNull(String name);
    boolean existsByNameAndIdNotAndDeletedAtIsNull(String name, Long id);
    boolean existsBySlugAndDeletedAtIsNull(String slug);
    boolean existsBySlugAndIdNotAndDeletedAtIsNull(String slug, Long id);
}
