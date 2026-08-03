package com.dms.document.processing;

import com.dms.document.entity.DocumentContent;
import com.dms.document.entity.DocumentExtractionStatus;
import com.dms.document.repository.DocumentContentRepository;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;

@Service
public class DocumentContentService {
    private final DocumentContentRepository repository;

    public DocumentContentService(DocumentContentRepository repository) {
        this.repository = repository;
    }

    public void saveSuccess(Long documentId, ExtractedDocumentText extractedText, int attempt) {
        DocumentContent content = repository.findByDocumentId(documentId).orElseGet(DocumentContent::new);
        content.setDocumentId(documentId);
        content.setExtractedText(extractedText.text());
        content.setExtractionMethod(extractedText.method());
        content.setLanguage(extractedText.language());
        content.setExtractionStatus(DocumentExtractionStatus.SUCCESS);
        content.setErrorMessage(null);
        content.setRetryCount(Math.max(0, attempt - 1));
        content.setExtractedAt(OffsetDateTime.now());
        repository.save(content);
    }

    public void saveFailure(Long documentId, String extractionMethod, String errorMessage, int attempt) {
        DocumentContent content = repository.findByDocumentId(documentId).orElseGet(DocumentContent::new);
        content.setDocumentId(documentId);
        content.setExtractedText(null);
        content.setExtractionMethod(extractionMethod);
        content.setLanguage("vi");
        content.setExtractionStatus(DocumentExtractionStatus.FAILED);
        content.setErrorMessage(truncate(errorMessage));
        content.setRetryCount(attempt);
        content.setExtractedAt(OffsetDateTime.now());
        repository.save(content);
    }

    private String truncate(String value) {
        if (value == null || value.length() <= 1000) {
            return value;
        }
        return value.substring(0, 1000);
    }
}
