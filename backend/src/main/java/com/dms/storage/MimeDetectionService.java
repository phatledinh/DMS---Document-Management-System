package com.dms.storage;

import org.apache.tika.Tika;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;

@Service
public class MimeDetectionService {
    private final Tika tika = new Tika();

    public String detect(InputStream inputStream, String fileName) {
        try (inputStream) {
            return tika.detect(inputStream, fileName);
        } catch (IOException exception) {
            throw new IllegalStateException("Could not detect MIME type", exception);
        }
    }
}
