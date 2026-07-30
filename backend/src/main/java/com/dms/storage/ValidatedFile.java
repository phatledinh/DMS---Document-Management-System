package com.dms.storage;

public record ValidatedFile(
        String fileName,
        String fileType,
        String mimeType
) {
}
