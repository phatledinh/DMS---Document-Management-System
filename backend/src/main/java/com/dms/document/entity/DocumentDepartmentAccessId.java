package com.dms.document.entity;

import java.io.Serializable;
import java.util.Objects;

public class DocumentDepartmentAccessId implements Serializable {
    private Long documentId;
    private Long departmentId;

    public DocumentDepartmentAccessId() {
    }

    public DocumentDepartmentAccessId(Long documentId, Long departmentId) {
        this.documentId = documentId;
        this.departmentId = departmentId;
    }

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

    @Override
    public boolean equals(Object object) {
        if (this == object) {
            return true;
        }
        if (!(object instanceof DocumentDepartmentAccessId that)) {
            return false;
        }
        return Objects.equals(documentId, that.documentId) && Objects.equals(departmentId, that.departmentId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(documentId, departmentId);
    }
}
