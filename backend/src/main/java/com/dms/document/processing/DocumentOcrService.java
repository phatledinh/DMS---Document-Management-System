package com.dms.document.processing;

import com.dms.document.entity.Document;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.ImageType;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.springframework.stereotype.Service;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Locale;
import java.util.UUID;

@Service
public class DocumentOcrService {
    private final DocumentOcrProperties properties;
    private final HttpClient httpClient;

    public DocumentOcrService(DocumentOcrProperties properties) {
        this.properties = properties;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }

    public ExtractedDocumentText extractImage(Document document, InputStream inputStream) {
        try (inputStream) {
            return new ExtractedDocumentText(normalize(runVietOcr(inputStream.readAllBytes(), extension(document))), "VIETOCR_IMAGE", "vi");
        } catch (IOException exception) {
            throw new IllegalStateException("Could not OCR image: " + exception.getMessage(), exception);
        }
    }

    public ExtractedDocumentText extractPdf(InputStream inputStream) {
        try (inputStream; PDDocument pdf = Loader.loadPDF(inputStream.readAllBytes())) {
            PDFRenderer renderer = new PDFRenderer(pdf);
            int pageCount = Math.min(pdf.getNumberOfPages(), properties.maxPages());
            StringBuilder text = new StringBuilder();
            for (int pageIndex = 0; pageIndex < pageCount; pageIndex++) {
                BufferedImage image = renderer.renderImageWithDPI(pageIndex, properties.dpi(), ImageType.RGB);
                String pageText = runVietOcr(toPng(image), "png");
                if (!pageText.isBlank()) {
                    if (!text.isEmpty()) {
                        text.append(System.lineSeparator()).append(System.lineSeparator());
                    }
                    text.append(pageText);
                }
            }
            return new ExtractedDocumentText(normalize(text.toString()), "VIETOCR_PDF", "vi");
        } catch (IOException exception) {
            throw new IllegalStateException("Could not OCR PDF: " + exception.getMessage(), exception);
        }
    }

    private String runVietOcr(byte[] input, String extension) throws IOException {
        String boundary = "dms-ocr-" + UUID.randomUUID();
        byte[] body = multipartBody(input, extension, boundary);
        HttpRequest request = HttpRequest.newBuilder(URI.create(properties.serviceUrl()))
                .version(HttpClient.Version.HTTP_1_1)
                .timeout(properties.timeoutPerPage())
                .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                .POST(HttpRequest.BodyPublishers.ofByteArray(body))
                .build();
        try {
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new IllegalStateException("VietOCR service failed: HTTP " + response.statusCode() + " " + response.body());
            }
            return extractJsonString(response.body(), "text");
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("VietOCR service was interrupted", exception);
        }
    }

    private byte[] multipartBody(byte[] input, String extension, String boundary) throws IOException {
        ByteArrayOutputStream body = new ByteArrayOutputStream();
        body.write(("--" + boundary + "\r\n").getBytes(StandardCharsets.UTF_8));
        body.write(("Content-Disposition: form-data; name=\"file\"; filename=\"ocr." + extension + "\"\r\n").getBytes(StandardCharsets.UTF_8));
        body.write(("Content-Type: image/" + extension + "\r\n\r\n").getBytes(StandardCharsets.UTF_8));
        body.write(input);
        body.write(("\r\n--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));
        return body.toByteArray();
    }

    private String extractJsonString(String json, String field) {
        String marker = "\"" + field + "\":\"";
        int start = json.indexOf(marker);
        if (start < 0) {
            return "";
        }
        start += marker.length();
        StringBuilder value = new StringBuilder();
        boolean escaping = false;
        for (int index = start; index < json.length(); index++) {
            char character = json.charAt(index);
            if (escaping) {
                value.append(switch (character) {
                    case 'n' -> '\n';
                    case 'r' -> '\r';
                    case 't' -> '\t';
                    default -> character;
                });
                escaping = false;
            } else if (character == '\\') {
                escaping = true;
            } else if (character == '"') {
                return value.toString();
            } else {
                value.append(character);
            }
        }
        return value.toString();
    }

    private byte[] toPng(BufferedImage image) throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        ImageIO.write(image, "png", output);
        return output.toByteArray();
    }

    private String extension(Document document) {
        String fileType = document.getFileType();
        if (fileType == null || fileType.isBlank()) {
            return "png";
        }
        String normalized = fileType.toLowerCase(Locale.ROOT);
        return normalized.equals("jpg") ? "jpeg" : normalized;
    }

    private String normalize(String text) {
        if (text == null) {
            return "";
        }
        return text.trim();
    }
}
