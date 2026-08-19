package com.dms.document.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;

@Entity
@IdClass(DocumentTagId.class)
@Table(name = "document_tags")
public class DocumentTag {
    @Id
    @Column(name = "document_id", nullable = false)
    private Long documentId;

    @Id
    @Column(name = "tag_id", nullable = false)
    private Long tagId;

    public Long getDocumentId() {
        return documentId;
    }

    public void setDocumentId(Long documentId) {
        this.documentId = documentId;
    }

    public Long getTagId() {
        return tagId;
    }

    public void setTagId(Long tagId) {
        this.tagId = tagId;
    }
}
