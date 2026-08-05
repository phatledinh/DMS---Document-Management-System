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
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.TimeUnit;

@Service
public class DocumentOcrService {
    private final DocumentOcrProperties properties;

    public DocumentOcrService(DocumentOcrProperties properties) {
        this.properties = properties;
    }

    public ExtractedDocumentText extractImage(Document document, InputStream inputStream) {
        try (inputStream) {
            return new ExtractedDocumentText(normalize(runTesseract(inputStream.readAllBytes(), extension(document))), "TESSERACT_IMAGE", properties.languages());
        } catch (IOException exception) {
            throw new IllegalStateException("Could not OCR image", exception);
        }
    }

    public ExtractedDocumentText extractPdf(InputStream inputStream) {
        try (inputStream; PDDocument pdf = Loader.loadPDF(inputStream.readAllBytes())) {
            PDFRenderer renderer = new PDFRenderer(pdf);
            int pageCount = Math.min(pdf.getNumberOfPages(), properties.maxPages());
            StringBuilder text = new StringBuilder();
            for (int pageIndex = 0; pageIndex < pageCount; pageIndex++) {
                BufferedImage image = renderer.renderImageWithDPI(pageIndex, properties.dpi(), ImageType.RGB);
                String pageText = runTesseract(toPng(image), "png");
                if (!pageText.isBlank()) {
                    if (!text.isEmpty()) {
                        text.append(System.lineSeparator()).append(System.lineSeparator());
                    }
                    text.append(pageText);
                }
            }
            return new ExtractedDocumentText(normalize(text.toString()), "TESSERACT_PDF", properties.languages());
        } catch (IOException exception) {
            throw new IllegalStateException("Could not OCR PDF", exception);
        }
    }

    private String runTesseract(byte[] input, String extension) throws IOException {
        Path inputFile = Files.createTempFile("dms-ocr-", "." + extension);
        Path outputBase = Files.createTempFile("dms-ocr-output-", "");
        Path outputFile = Path.of(outputBase.toString() + ".txt");
        Files.deleteIfExists(outputBase);
        try {
            Files.write(inputFile, input);
            Process process = new ProcessBuilder(List.of(
                    "tesseract",
                    inputFile.toString(),
                    outputBase.toString(),
                    "-l",
                    properties.languages()
            )).redirectErrorStream(true).start();
            boolean finished = process.waitFor(properties.timeoutPerPage().toMillis(), TimeUnit.MILLISECONDS);
            String output = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
            if (!finished) {
                process.destroyForcibly();
                throw new IllegalStateException("Tesseract timed out");
            }
            if (process.exitValue() != 0) {
                throw new IllegalStateException("Tesseract failed: " + output.strip());
            }
            return Files.exists(outputFile) ? Files.readString(outputFile, StandardCharsets.UTF_8) : "";
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Tesseract was interrupted", exception);
        } finally {
            Files.deleteIfExists(inputFile);
            Files.deleteIfExists(outputFile);
        }
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
