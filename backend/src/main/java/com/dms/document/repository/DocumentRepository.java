package com.dms.document.repository;

import com.dms.document.entity.Document;
import com.dms.document.entity.DocumentStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

public interface DocumentRepository extends JpaRepository<Document, Long>, JpaSpecificationExecutor<Document> {
    Optional<Document> findBySlug(String slug);

    List<Document> findByStatusAndUploadExpiresAtBefore(DocumentStatus status, OffsetDateTime uploadExpiresAt);

    Page<Document> findByStatus(DocumentStatus status, Pageable pageable);

    List<Document> findByStatusAndPurgeAfterLessThanEqual(DocumentStatus status, OffsetDateTime purgeAfter);
}
