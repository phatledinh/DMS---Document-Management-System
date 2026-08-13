package com.dms.document.processing;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

@ConfigurationProperties(prefix = "app.ocr")
public record DocumentOcrProperties(
        String serviceUrl,
        int dpi,
        int maxPages,
        Duration timeoutPerPage,
        int minPdfTextLength
) {
    public String serviceUrl() {
        return serviceUrl == null || serviceUrl.isBlank() ? "http://localhost:8000/ocr" : serviceUrl;
    }

    public int dpi() {
        return dpi <= 0 ? 200 : dpi;
    }

    public int maxPages() {
        return maxPages <= 0 ? 20 : maxPages;
    }

    public Duration timeoutPerPage() {
        return timeoutPerPage == null || timeoutPerPage.isNegative() || timeoutPerPage.isZero()
                ? Duration.ofSeconds(30)
                : timeoutPerPage;
    }

    public int minPdfTextLength() {
        return minPdfTextLength <= 0 ? 20 : minPdfTextLength;
    }
}
