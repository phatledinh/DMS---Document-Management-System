package com.dms.storage;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

@ConfigurationProperties(prefix = "app.storage")
public record StorageProperties(
        S3 s3,
        long maxFileSize,
        Duration presignedUploadTtl,
        Duration presignedDownloadTtl
) {
    public record S3(
            String endpoint,
            String bucket,
            String accessKey,
            String secretKey,
            String region,
            boolean pathStyleAccess
    ) {
    }
}
