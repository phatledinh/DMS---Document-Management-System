package com.dms.document.repository;

import com.dms.document.entity.DocumentUserAccess;
import com.dms.document.entity.DocumentUserAccessId;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DocumentUserAccessRepository extends JpaRepository<DocumentUserAccess, DocumentUserAccessId> {
    boolean existsByDocumentIdAndUserId(Long documentId, Long userId);
}
