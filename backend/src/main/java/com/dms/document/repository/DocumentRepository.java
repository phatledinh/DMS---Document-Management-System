package com.dms.document.repository;

import com.dms.document.entity.Document;
import com.dms.document.entity.DocumentStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.time.OffsetDateTime;
import java.util.List;

public interface DocumentRepository extends JpaRepository<Document, Long>, JpaSpecificationExecutor<Document> {
    List<Document> findByStatusAndUploadExpiresAtBefore(DocumentStatus status, OffsetDateTime uploadExpiresAt);
}
