package com.dms.storage;

import com.dms.common.exception.AppException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class FileValidationServiceTest {
    private FileValidationService service;

    @BeforeEach
    void setUp() {
        StorageProperties properties = new StorageProperties(
                new StorageProperties.S3("http://localhost:9000", "dms-documents", "access", "secret", "auto", true),
                52_428_800,
                Duration.ofMinutes(5),
                Duration.ofMinutes(5)
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
    void validateDeclared_rejectsOversizedFile() {
        assertThatThrownBy(() -> service.validateDeclared("a.pdf", 52_428_801, "application/pdf"))
                .isInstanceOf(AppException.class)
                .hasMessage("Invalid file size");
    }

    @Test
    void validateDeclared_rejectsDangerousExtension() {
        assertThatThrownBy(() -> service.validateDeclared("payload.exe", 1024, "application/octet-stream"))
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
