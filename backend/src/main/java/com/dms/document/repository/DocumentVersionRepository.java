package com.dms.document.repository;

import com.dms.document.entity.DocumentStatus;
import com.dms.document.entity.DocumentVersion;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DocumentVersionRepository extends JpaRepository<DocumentVersion, Long> {
    List<DocumentVersion> findByDocumentIdOrderByCreatedAtDesc(Long documentId);

    Optional<DocumentVersion> findByIdAndDocumentId(Long id, Long documentId);

    boolean existsByDocumentIdAndVersionNumber(Long documentId, String versionNumber);

    Optional<DocumentVersion> findFirstByDocumentIdAndVersionNumberAndStatus(Long documentId, String versionNumber, DocumentStatus status);

    List<DocumentVersion> findByDocumentId(Long documentId);

    List<DocumentVersion> findByStatusAndUploadExpiresAtBefore(DocumentStatus status, java.time.OffsetDateTime timestamp);

    List<DocumentVersion> findByStatusAndCreatedAtBefore(DocumentStatus status, java.time.OffsetDateTime timestamp);
}
