package com.dms.document.entity;

import java.io.Serializable;
import java.util.Objects;

public class DocumentTagId implements Serializable {
    private Long documentId;
    private Long tagId;

    public DocumentTagId() {
    }

    public DocumentTagId(Long documentId, Long tagId) {
        this.documentId = documentId;
        this.tagId = tagId;
    }

    @Override
    public boolean equals(Object object) {
        if (this == object) return true;
        if (!(object instanceof DocumentTagId that)) return false;
        return Objects.equals(documentId, that.documentId) && Objects.equals(tagId, that.tagId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(documentId, tagId);
    }
}
