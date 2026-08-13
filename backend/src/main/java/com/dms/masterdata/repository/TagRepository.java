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

    @org.springframework.data.jpa.repository.Query(value = """
        SELECT t.id, t.name, t.slug, t.created_at,
               (SELECT COUNT(dt.document_id) FROM document_tags dt
                JOIN documents d ON d.id = dt.document_id
                WHERE dt.tag_id = t.id AND d.deleted_at IS NULL)
        FROM tags t
        WHERE t.deleted_at IS NULL
        ORDER BY t.name ASC
        """, nativeQuery = true)
    List<Object[]> findAllWithDocumentCount();
}
