package com.dms.document.service;

import com.dms.document.processing.DocumentTrashProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.OffsetDateTime;
import java.util.List;

@Component
public class DocumentTrashPurgeJob {
    private static final Logger log = LoggerFactory.getLogger(DocumentTrashPurgeJob.class);

    private final DocumentLifecycleService lifecycleService;
    private final DocumentTrashProperties trashProperties;

    public DocumentTrashPurgeJob(DocumentLifecycleService lifecycleService, DocumentTrashProperties trashProperties) {
        this.lifecycleService = lifecycleService;
        this.trashProperties = trashProperties;
    }

    @Scheduled(cron = "${app.trash.purge-cron:0 0 2 * * *}")
    public void purgeDeletedDocuments() {
        List<Long> documentIds = lifecycleService.expiredTrashDocumentIds(OffsetDateTime.now());
        if (documentIds.isEmpty()) {
            return;
        }
        var result = lifecycleService.purgeDocuments(documentIds);
        if (result.failureCount() > 0) {
            log.warn("Trash purge completed with {} successes and {} failures", result.successCount(), result.failureCount());
        } else {
            log.info("Trash purge completed with {} documents", result.successCount());
        }
    }

    public DocumentTrashProperties getTrashProperties() {
        return trashProperties;
    }
}
