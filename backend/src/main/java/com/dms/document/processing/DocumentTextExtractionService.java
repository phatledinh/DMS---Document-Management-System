package com.dms.document.processing;

import com.dms.document.entity.Document;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.hwpf.HWPFDocument;
import org.apache.poi.hwpf.extractor.WordExtractor;
import org.apache.poi.xwpf.extractor.XWPFWordExtractor;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.util.Locale;

@Service
public class DocumentTextExtractionService {
    public ExtractedDocumentText extract(Document document, InputStream inputStream) {
        try (inputStream) {
            String fileType = document.getFileType().toLowerCase(Locale.ROOT);
            return switch (fileType) {
                case "pdf" -> extractPdf(inputStream);
                case "docx" -> extractDocx(inputStream);
                case "doc" -> extractDoc(inputStream);
                default -> throw new UnsupportedOperationException("Unsupported file type: " + document.getFileType());
            };
        } catch (IOException exception) {
            throw new IllegalStateException("Could not extract text", exception);
        }
    }

    private ExtractedDocumentText extractPdf(InputStream inputStream) throws IOException {
        try (var document = Loader.loadPDF(inputStream.readAllBytes())) {
            String text = new PDFTextStripper().getText(document);
            return new ExtractedDocumentText(normalize(text), "PDFBOX", "vi");
        }
    }

    private ExtractedDocumentText extractDocx(InputStream inputStream) throws IOException {
        try (XWPFDocument document = new XWPFDocument(inputStream);
             XWPFWordExtractor extractor = new XWPFWordExtractor(document)) {
            return new ExtractedDocumentText(normalize(extractor.getText()), "POI_DOCX", "vi");
        }
    }

    private ExtractedDocumentText extractDoc(InputStream inputStream) throws IOException {
        try (HWPFDocument document = new HWPFDocument(inputStream);
             WordExtractor extractor = new WordExtractor(document)) {
            return new ExtractedDocumentText(normalize(extractor.getText()), "POI_DOC", "vi");
        }
    }

    private String normalize(String text) {
        if (text == null) {
            return "";
        }
        return text.trim();
    }
}
