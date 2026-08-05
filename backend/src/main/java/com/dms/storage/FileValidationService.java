package com.dms.storage;

import com.dms.common.exception.AppException;
import com.dms.common.exception.ErrorCodes;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
public class FileValidationService {
    private static final Set<String> DANGEROUS_EXTENSIONS = Set.of("exe", "sh", "bat", "cmd", "js", "html", "htm", "jar", "msi", "ps1", "vbs");
    private static final Map<String, Set<String>> ALLOWED_MIME_TYPES = Map.of(
            "pdf", Set.of("application/pdf"),
            "doc", Set.of("application/msword", "application/x-tika-msoffice"),
            "docx", Set.of("application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/zip", "application/x-tika-ooxml"),
            "xls", Set.of("application/vnd.ms-excel", "application/x-tika-msoffice"),
            "xlsx", Set.of("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/zip", "application/x-tika-ooxml"),
            "jpg", Set.of("image/jpeg"),
            "jpeg", Set.of("image/jpeg"),
            "png", Set.of("image/png"),
            "tif", Set.of("image/tiff"),
            "tiff", Set.of("image/tiff")
    );

    private final StorageProperties properties;

    public FileValidationService(StorageProperties properties) {
        this.properties = properties;
    }

    public ValidatedFile validateDeclared(String fileName, long fileSize, String contentType) {
        String sanitizedFileName = sanitizeFileName(fileName);
        String extension = extensionOf(sanitizedFileName);
        validateSize(fileSize);
        validateExtension(extension);
        validateMime(extension, normalizeContentType(contentType));
        return new ValidatedFile(sanitizedFileName, extension.toUpperCase(Locale.ROOT), normalizeContentType(contentType));
    }

    public void validateDetected(String extensionOrFileType, String detectedMimeType) {
        String extension = extensionOrFileType.toLowerCase(Locale.ROOT);
        validateExtension(extension);
        validateMime(extension, normalizeContentType(detectedMimeType));
    }

    public boolean canPreviewOriginal(String fileType) {
        String extension = fileType.toLowerCase(Locale.ROOT);
        return Set.of("pdf", "jpg", "jpeg", "png", "tif", "tiff").contains(extension);
    }

    public boolean requiresPreviewConversion(String fileType) {
        String extension = fileType.toLowerCase(Locale.ROOT);
        return Set.of("doc", "docx", "xls", "xlsx").contains(extension);
    }

    private void validateSize(long fileSize) {
        if (fileSize <= 0 || fileSize > properties.maxFileSize()) {
            throw new AppException(ErrorCodes.VALIDATION_ERROR, "Invalid file size", HttpStatus.BAD_REQUEST);
        }
    }

    private void validateExtension(String extension) {
        if (DANGEROUS_EXTENSIONS.contains(extension)) {
            throw new AppException(ErrorCodes.DANGEROUS_FILE_TYPE, "Dangerous file type is not allowed", HttpStatus.UNSUPPORTED_MEDIA_TYPE);
        }
        if (!ALLOWED_MIME_TYPES.containsKey(extension)) {
            throw new AppException(ErrorCodes.VALIDATION_ERROR, "File type is not supported", HttpStatus.BAD_REQUEST);
        }
    }

    private void validateMime(String extension, String mimeType) {
        if (!ALLOWED_MIME_TYPES.get(extension).contains(mimeType)) {
            throw new AppException(ErrorCodes.MIME_TYPE_MISMATCH, "File MIME type does not match the extension", HttpStatus.UNSUPPORTED_MEDIA_TYPE);
        }
    }

    private String sanitizeFileName(String fileName) {
        if (fileName == null || fileName.isBlank()) {
            throw new AppException(ErrorCodes.VALIDATION_ERROR, "File name is required", HttpStatus.BAD_REQUEST);
        }
        String sanitized = fileName.replace('\\', '/');
        sanitized = sanitized.substring(sanitized.lastIndexOf('/') + 1).trim();
        if (sanitized.isBlank() || sanitized.length() > 255) {
            throw new AppException(ErrorCodes.VALIDATION_ERROR, "Invalid file name", HttpStatus.BAD_REQUEST);
        }
        return sanitized;
    }

    private String extensionOf(String fileName) {
        int index = fileName.lastIndexOf('.');
        if (index < 0 || index == fileName.length() - 1) {
            throw new AppException(ErrorCodes.VALIDATION_ERROR, "File extension is required", HttpStatus.BAD_REQUEST);
        }
        return fileName.substring(index + 1).toLowerCase(Locale.ROOT);
    }

    private String normalizeContentType(String contentType) {
        if (contentType == null || contentType.isBlank()) {
            throw new AppException(ErrorCodes.VALIDATION_ERROR, "Content type is required", HttpStatus.BAD_REQUEST);
        }
        int parameterIndex = contentType.indexOf(';');
        String normalized = parameterIndex >= 0 ? contentType.substring(0, parameterIndex) : contentType;
        return normalized.trim().toLowerCase(Locale.ROOT);
    }
}
