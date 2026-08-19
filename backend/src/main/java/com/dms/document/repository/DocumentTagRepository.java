package com.dms.document.repository;

import com.dms.document.entity.DocumentTag;
import com.dms.document.entity.DocumentTagId;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DocumentTagRepository extends JpaRepository<DocumentTag, DocumentTagId> {
    void deleteByDocumentId(Long documentId);
}
