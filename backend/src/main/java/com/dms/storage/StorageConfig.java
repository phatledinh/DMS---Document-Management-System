package com.dms.storage;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

import java.net.URI;

@Configuration
@EnableConfigurationProperties(StorageProperties.class)
public class StorageConfig {
    @Bean
    public S3Client s3Client(StorageProperties properties) {
        StorageProperties.S3 s3 = properties.s3();
        return S3Client.builder()
                .endpointOverride(URI.create(s3.endpoint()))
                .region(Region.of(s3.region()))
                .credentialsProvider(credentialsProvider(s3))
                .serviceConfiguration(serviceConfiguration(s3))
                .build();
    }

    @Bean
    public S3Presigner s3Presigner(StorageProperties properties) {
        StorageProperties.S3 s3 = properties.s3();
        return S3Presigner.builder()
                .endpointOverride(URI.create(s3.endpoint()))
                .region(Region.of(s3.region()))
                .credentialsProvider(credentialsProvider(s3))
                .serviceConfiguration(serviceConfiguration(s3))
                .build();
    }

    private StaticCredentialsProvider credentialsProvider(StorageProperties.S3 s3) {
        return StaticCredentialsProvider.create(AwsBasicCredentials.create(s3.accessKey(), s3.secretKey()));
    }

    private S3Configuration serviceConfiguration(StorageProperties.S3 s3) {
        return S3Configuration.builder()
                .pathStyleAccessEnabled(s3.pathStyleAccess())
                .build();
    }
}
