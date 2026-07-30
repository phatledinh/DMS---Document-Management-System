package com.dms.document.service;

import com.dms.document.entity.Document;
import com.dms.document.entity.DocumentStatus;
import com.dms.document.repository.DocumentRepository;
import com.dms.storage.ObjectStorageService;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;

@Component
public class ExpiredUploadCleanupJob {
    private final DocumentRepository documentRepository;
    private final ObjectStorageService objectStorageService;

    public ExpiredUploadCleanupJob(DocumentRepository documentRepository, ObjectStorageService objectStorageService) {
        this.documentRepository = documentRepository;
        this.objectStorageService = objectStorageService;
    }

    @Scheduled(fixedDelayString = "${app.storage.cleanup-delay:PT15M}")
    @SchedulerLock(name = "expiredUploadCleanup", lockAtMostFor = "PT10M")
    @Transactional
    public void cleanupExpiredUploads() {
        documentRepository.findByStatusAndUploadExpiresAtBefore(DocumentStatus.AWAITING_UPLOAD, OffsetDateTime.now())
                .forEach(this::deleteExpiredUpload);
    }

    private void deleteExpiredUpload(Document document) {
        try {
            objectStorageService.deleteObject(document.getStoragePath());
        } catch (RuntimeException ignored) {
        }
        documentRepository.delete(document);
    }
}
