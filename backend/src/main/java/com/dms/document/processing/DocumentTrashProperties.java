package com.dms.document.processing;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

@ConfigurationProperties(prefix = "app.trash")
public record DocumentTrashProperties(
        int retentionDays,
        String purgeCron
) {
    public DocumentTrashProperties {
        if (retentionDays < 1) {
            retentionDays = 30;
        }
        if (purgeCron == null || purgeCron.isBlank()) {
            purgeCron = "0 0 2 * * *";
        }
    }

    public Duration retentionDuration() {
        return Duration.ofDays(retentionDays);
    }
}
