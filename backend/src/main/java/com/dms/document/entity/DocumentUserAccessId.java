package com.dms.document.entity;

import java.io.Serializable;
import java.util.Objects;

public class DocumentUserAccessId implements Serializable {
    private Long documentId;
    private Long userId;

    public DocumentUserAccessId() {
    }

    public DocumentUserAccessId(Long documentId, Long userId) {
        this.documentId = documentId;
        this.userId = userId;
    }

    public Long getDocumentId() {
        return documentId;
    }

    public void setDocumentId(Long documentId) {
        this.documentId = documentId;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    @Override
    public boolean equals(Object object) {
        if (this == object) {
            return true;
        }
        if (!(object instanceof DocumentUserAccessId that)) {
            return false;
        }
        return Objects.equals(documentId, that.documentId) && Objects.equals(userId, that.userId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(documentId, userId);
    }
}
