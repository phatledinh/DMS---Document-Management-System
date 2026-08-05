package com.dms.storage;

import com.dms.common.exception.AppException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class FileValidationServiceTest {
    private FileValidationService service;

    @BeforeEach
    void setUp() {
        StorageProperties properties = new StorageProperties(
                new StorageProperties.S3("http://localhost:9000", null, "dms-documents", "access", "secret", "auto", true),
                52_428_800,
                Duration.ofMinutes(5),
                Duration.ofMinutes(5),
                null
        );
        service = new FileValidationService(properties);
    }

    @Test
    void validateDeclared_pdfAcceptedAndSanitized() {
        ValidatedFile file = service.validateDeclared("../ISO_9001.pdf", 1024, "application/pdf; charset=binary");

        assertThat(file.fileName()).isEqualTo("ISO_9001.pdf");
        assertThat(file.fileType()).isEqualTo("PDF");
        assertThat(file.mimeType()).isEqualTo("application/pdf");
    }

    @Test
    void validateDeclared_acceptsMaxAllowedSize() {
        ValidatedFile file = service.validateDeclared("a.pdf", 52_428_800, "application/pdf");

        assertThat(file.fileType()).isEqualTo("PDF");
    }

    @Test
    void validateDeclared_rejectsOversizedFile() {
        assertThatThrownBy(() -> service.validateDeclared("a.pdf", 52_428_801, "application/pdf"))
                .isInstanceOf(AppException.class)
                .hasMessage("Invalid file size");
    }

    @ParameterizedTest
    @ValueSource(strings = {"exe", "sh", "bat", "cmd", "js", "html", "htm", "jar", "msi", "ps1", "vbs"})
    void validateDeclared_rejectsDangerousExtension(String extension) {
        assertThatThrownBy(() -> service.validateDeclared("payload." + extension, 1024, "application/octet-stream"))
                .isInstanceOf(AppException.class)
                .hasMessage("Dangerous file type is not allowed");
    }

    @Test
    void validateDetected_rejectsMimeMismatch() {
        assertThatThrownBy(() -> service.validateDetected("PDF", "image/png"))
                .isInstanceOf(AppException.class)
                .hasMessage("File MIME type does not match the extension");
    }
}
