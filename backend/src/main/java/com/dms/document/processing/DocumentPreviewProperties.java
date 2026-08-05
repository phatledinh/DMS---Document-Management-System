package com.dms.document.processing;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

@ConfigurationProperties(prefix = "app.preview")
public record DocumentPreviewProperties(
        boolean enabled,
        Duration timeout,
        String officeHome,
        int maxTasksPerProcess,
        String objectPrefix
) {
    public Duration timeout() {
        return timeout == null || timeout.isNegative() || timeout.isZero()
                ? Duration.ofMinutes(2)
                : timeout;
    }

    public int maxTasksPerProcess() {
        return maxTasksPerProcess <= 0 ? 20 : maxTasksPerProcess;
    }

    public String objectPrefix() {
        return objectPrefix == null || objectPrefix.isBlank() ? "preview" : objectPrefix.strip();
    }
}
