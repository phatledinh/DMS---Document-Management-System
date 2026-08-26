package com.dms.document.repository;

import com.dms.document.entity.DocumentTag;
import com.dms.document.entity.DocumentTagId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface DocumentTagRepository extends JpaRepository<DocumentTag, DocumentTagId> {
    List<DocumentTag> findByDocumentId(Long documentId);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("delete from DocumentTag tag where tag.documentId = :documentId")
    void deleteByDocumentId(@Param("documentId") Long documentId);
}
