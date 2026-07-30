package com.dms.document.repository;

import com.dms.document.entity.DocumentVersion;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DocumentVersionRepository extends JpaRepository<DocumentVersion, Long> {
}
