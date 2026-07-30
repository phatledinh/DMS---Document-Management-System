package com.dms.document.processing;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.processing")
public record DocumentProcessingProperties(
        int threadPoolSize,
        int maxRetryCount
) {
    public int maxRetryCount() {
        return maxRetryCount <= 0 ? 3 : maxRetryCount;
    }
}
