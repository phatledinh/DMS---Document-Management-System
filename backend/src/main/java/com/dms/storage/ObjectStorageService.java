package com.dms.storage;

import com.dms.common.exception.AppException;
import com.dms.common.exception.ErrorCodes;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.HeadBucketRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectResponse;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.S3Exception;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PresignedGetObjectRequest;
import software.amazon.awssdk.services.s3.presigner.model.PresignedPutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

import java.io.InputStream;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

@Service
public class ObjectStorageService {
    private final S3Client s3Client;
    private final S3Presigner s3Presigner;
    private final StorageProperties properties;

    public ObjectStorageService(S3Client s3Client, S3Presigner s3Presigner, StorageProperties properties) {
        this.s3Client = s3Client;
        this.s3Presigner = s3Presigner;
        this.properties = properties;
    }

    public String generateDocumentObjectKey() {
        return "documents/" + UUID.randomUUID();
    }

    public PresignedPutUrl presignPut(String objectKey, String contentType) {
        try {
            PutObjectPresignRequest presignRequest = PutObjectPresignRequest.builder()
                    .signatureDuration(properties.presignedUploadTtl())
                    .putObjectRequest(builder -> builder
                            .bucket(properties.s3().bucket())
                            .key(objectKey)
                            .contentType(contentType))
                    .build();
            PresignedPutObjectRequest request = s3Presigner.presignPutObject(presignRequest);
            return new PresignedPutUrl(
                    request.url().toString(),
                    "PUT",
                    Map.of("Content-Type", contentType),
                    properties.presignedUploadTtl().toSeconds(),
                    OffsetDateTime.now().plus(properties.presignedUploadTtl())
            );
        } catch (RuntimeException exception) {
            throw new AppException(ErrorCodes.PRESIGN_FAILED, "Could not create upload URL", HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    public PresignedGetUrl presignGet(String objectKey, String contentDisposition) {
        try {
            GetObjectPresignRequest presignRequest = GetObjectPresignRequest.builder()
                    .signatureDuration(properties.presignedDownloadTtl())
                    .getObjectRequest(builder -> builder
                            .bucket(properties.s3().bucket())
                            .key(objectKey)
                            .responseContentDisposition(contentDisposition))
                    .build();
            PresignedGetObjectRequest request = s3Presigner.presignGetObject(presignRequest);
            return new PresignedGetUrl(request.url().toString(), properties.presignedDownloadTtl().toSeconds());
        } catch (RuntimeException exception) {
            throw new AppException(ErrorCodes.PRESIGN_FAILED, "Could not create download URL", HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    public ObjectMetadata headObject(String objectKey) {
        try {
            HeadObjectResponse response = s3Client.headObject(HeadObjectRequest.builder()
                    .bucket(properties.s3().bucket())
                    .key(objectKey)
                    .build());
            return new ObjectMetadata(response.contentLength(), response.contentType(), response.eTag());
        } catch (NoSuchKeyException exception) {
            throw new AppException(ErrorCodes.UPLOAD_NOT_COMPLETED, "Upload has not completed", HttpStatus.BAD_REQUEST);
        } catch (S3Exception exception) {
            if (exception.statusCode() == 404) {
                throw new AppException(ErrorCodes.UPLOAD_NOT_COMPLETED, "Upload has not completed", HttpStatus.BAD_REQUEST);
            }
            throw exception;
        }
    }

    public InputStream openStream(String objectKey) {
        ResponseInputStream<GetObjectResponse> stream = s3Client.getObject(GetObjectRequest.builder()
                .bucket(properties.s3().bucket())
                .key(objectKey)
                .build());
        return stream;
    }

    public void deleteObject(String objectKey) {
        s3Client.deleteObject(DeleteObjectRequest.builder()
                .bucket(properties.s3().bucket())
                .key(objectKey)
                .build());
    }

    public void verifyBucketAccessible() {
        s3Client.headBucket(HeadBucketRequest.builder()
                .bucket(properties.s3().bucket())
                .build());
    }
}
