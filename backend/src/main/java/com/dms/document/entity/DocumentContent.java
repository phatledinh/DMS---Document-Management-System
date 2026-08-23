package com.dms.document.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;

@Entity
@Table(name = "document_contents")
public class DocumentContent {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "document_id", nullable = false, unique = true)
    private Long documentId;

    @Column(name = "extracted_text")
    private String extractedText;

    @Column(name = "extraction_method", nullable = false, length = 50)
    private String extractionMethod;

    @Column(length = 10)
    private String language;

    @Enumerated(EnumType.STRING)
    @Column(name = "extraction_status", nullable = false, length = 30)
    private DocumentExtractionStatus extractionStatus;

    @Column(name = "error_message")
    private String errorMessage;

    @Column(name = "retry_count", nullable = false)
    private Integer retryCount = 0;

    @Column(name = "extracted_at")
    private OffsetDateTime extractedAt;

    public Long getId() {
        return id;
    }

    public Long getDocumentId() {
        return documentId;
    }

    public void setDocumentId(Long documentId) {
        this.documentId = documentId;
    }

    public String getExtractedText() {
        return extractedText;
    }

    public void setExtractedText(String extractedText) {
        this.extractedText = extractedText;
    }

    public String getExtractionMethod() {
        return extractionMethod;
    }

    public void setExtractionMethod(String extractionMethod) {
        this.extractionMethod = extractionMethod;
    }

    public String getLanguage() {
        return language;
    }

    public void setLanguage(String language) {
        this.language = language;
    }

    public DocumentExtractionStatus getExtractionStatus() {
        return extractionStatus;
    }

    public void setExtractionStatus(DocumentExtractionStatus extractionStatus) {
        this.extractionStatus = extractionStatus;
    }

    public String getErrorMessage() {
        return errorMessage;
    }

    public void setErrorMessage(String errorMessage) {
        this.errorMessage = errorMessage;
    }

    public Integer getRetryCount() {
        return retryCount;
    }

    public void setRetryCount(Integer retryCount) {
        this.retryCount = retryCount;
    }

    public OffsetDateTime getExtractedAt() {
        return extractedAt;
    }

    public void setExtractedAt(OffsetDateTime extractedAt) {
        this.extractedAt = extractedAt;
    }
}
