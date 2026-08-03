package com.dms.document.processing;

import com.dms.document.entity.Document;
import com.dms.document.entity.DocumentStatus;
import com.dms.document.repository.DocumentRepository;
import com.dms.storage.ObjectStorageService;
import org.springframework.stereotype.Service;

@Service
public class DocumentExtractionPipeline {
    private final ObjectStorageService objectStorageService;
    private final DocumentTextExtractionService textExtractionService;
    private final DocumentContentService contentService;
    private final PostgresSearchEngine searchEngine;
    private final DocumentRepository documentRepository;

    public DocumentExtractionPipeline(
            ObjectStorageService objectStorageService,
            DocumentTextExtractionService textExtractionService,
            DocumentContentService contentService,
            PostgresSearchEngine searchEngine,
            DocumentRepository documentRepository
    ) {
        this.objectStorageService = objectStorageService;
        this.textExtractionService = textExtractionService;
        this.contentService = contentService;
        this.searchEngine = searchEngine;
        this.documentRepository = documentRepository;
    }

    public void process(Document document, DocumentProcessingMessage message) {
        try {
            ExtractedDocumentText extractedText = textExtractionService.extract(document, objectStorageService.openStream(document.getStoragePath()));
            contentService.saveSuccess(document.getId(), extractedText, message.attempt());
            searchEngine.refreshIndex(document, extractedText.text());
            document.setStatus(DocumentStatus.INDEXED);
            documentRepository.save(document);
        } catch (RuntimeException exception) {
            contentService.saveFailure(document.getId(), "TEXT_EXTRACTION", exception.getMessage(), message.attempt());
            throw exception;
        }
    }
}
