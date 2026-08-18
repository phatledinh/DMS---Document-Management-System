package com.dms.document.service;

import com.dms.document.entity.Document;
import com.dms.document.entity.DocumentStatus;
import com.dms.document.entity.DocumentVersion;
import com.dms.document.repository.DocumentRepository;
import com.dms.document.repository.DocumentVersionRepository;
import com.dms.storage.ObjectStorageService;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;

@Component
public class ExpiredUploadCleanupJob {
    private final DocumentRepository documentRepository;
    private final DocumentVersionRepository versionRepository;
    private final ObjectStorageService objectStorageService;

    public ExpiredUploadCleanupJob(DocumentRepository documentRepository, DocumentVersionRepository versionRepository, ObjectStorageService objectStorageService) {
        this.documentRepository = documentRepository;
        this.versionRepository = versionRepository;
        this.objectStorageService = objectStorageService;
    }

    @Scheduled(fixedDelayString = "${app.storage.cleanup-delay:PT15M}")
    @SchedulerLock(name = "expiredUploadCleanup", lockAtMostFor = "PT10M")
    @Transactional
    public void cleanupExpiredUploads() {
        OffsetDateTime now = OffsetDateTime.now();
        documentRepository.findByStatusAndUploadExpiresAtBefore(DocumentStatus.AWAITING_UPLOAD, now)
                .forEach(this::deleteExpiredUpload);
        
        versionRepository.findByStatusAndUploadExpiresAtBefore(DocumentStatus.AWAITING_UPLOAD, now)
                .forEach(this::deleteExpiredVersionUpload);
    }

    @Scheduled(fixedDelayString = "${app.storage.cleanup-delay:PT15M}")
    @SchedulerLock(name = "failedVersionCleanup", lockAtMostFor = "PT10M")
    @Transactional
    public void cleanupFailedVersions() {
        OffsetDateTime threshold = OffsetDateTime.now().minusDays(7);
        versionRepository.findByStatusAndCreatedAtBefore(DocumentStatus.EXTRACTION_FAILED, threshold)
                .forEach(this::deleteFailedVersion);
    }

    private void deleteExpiredUpload(Document document) {
        try {
            objectStorageService.deleteObject(document.getStoragePath());
        } catch (RuntimeException ignored) {
        }
        documentRepository.delete(document);
    }

    private void deleteExpiredVersionUpload(DocumentVersion version) {
        try {
            objectStorageService.deleteObject(version.getStoragePath());
        } catch (RuntimeException ignored) {
        }
        versionRepository.delete(version);
    }

    private void deleteFailedVersion(DocumentVersion version) {
        try {
            objectStorageService.deleteObject(version.getStoragePath());
            if (version.getPreviewObjectKey() != null) {
                objectStorageService.deleteObject(version.getPreviewObjectKey());
            }
        } catch (RuntimeException ignored) {
        }
        versionRepository.delete(version);
    }
}
