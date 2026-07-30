package com.dms.document.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;

@Entity
@IdClass(DocumentDepartmentAccessId.class)
@Table(name = "document_department_accesses")
public class DocumentDepartmentAccess {
    @Id
    @Column(name = "document_id", nullable = false)
    private Long documentId;

    @Id
    @Column(name = "department_id", nullable = false)
    private Long departmentId;

    @Column(name = "granted_by", nullable = false)
    private Long grantedBy;

    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private OffsetDateTime createdAt;

    public Long getDocumentId() {
        return documentId;
    }

    public void setDocumentId(Long documentId) {
        this.documentId = documentId;
    }

    public Long getDepartmentId() {
        return departmentId;
    }

    public void setDepartmentId(Long departmentId) {
        this.departmentId = departmentId;
    }

    public Long getGrantedBy() {
        return grantedBy;
    }

    public void setGrantedBy(Long grantedBy) {
        this.grantedBy = grantedBy;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }
}
