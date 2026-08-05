package com.dms.storage;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

@ConfigurationProperties(prefix = "app.storage")
public record StorageProperties(
        S3 s3,
        long maxFileSize,
        Duration presignedUploadTtl,
        Duration presignedDownloadTtl,
        BatchUpload batchUpload
) {


    public int batchUploadMaxFiles() {
        return batchUpload == null || batchUpload.maxFiles() == null ? 20 : batchUpload.maxFiles();
    }

    public record S3(
            String endpoint,
            String bucket,
            String accessKey,
            String secretKey,
            String region,
            boolean pathStyleAccess
    ) {
    }

    public record BatchUpload(
            Integer maxFiles
    ) {
    }
}
