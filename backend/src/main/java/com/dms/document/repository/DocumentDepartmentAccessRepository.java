package com.dms.document.repository;

import com.dms.document.entity.DocumentDepartmentAccess;
import com.dms.document.entity.DocumentDepartmentAccessId;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DocumentDepartmentAccessRepository extends JpaRepository<DocumentDepartmentAccess, DocumentDepartmentAccessId> {
    boolean existsByDocumentIdAndDepartmentId(Long documentId, Long departmentId);

    List<DocumentDepartmentAccess> findByDocumentId(Long documentId);
}
