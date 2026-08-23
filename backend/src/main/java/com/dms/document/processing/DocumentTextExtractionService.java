package com.dms.document.processing;

import com.dms.document.entity.Document;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.hwpf.HWPFDocument;
import org.apache.poi.hwpf.extractor.WordExtractor;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.apache.poi.xwpf.extractor.XWPFWordExtractor;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.util.Locale;

@Service
public class DocumentTextExtractionService {
    private final DocumentOcrService ocrService;
    private final DocumentOcrProperties ocrProperties;

    public DocumentTextExtractionService(DocumentOcrService ocrService, DocumentOcrProperties ocrProperties) {
        this.ocrService = ocrService;
        this.ocrProperties = ocrProperties;
    }

    public ExtractedDocumentText extract(Document document, InputStream inputStream) {
        return extract(document.getFileType(), document, inputStream);
    }

    public ExtractedDocumentText extract(String fileType, Document document, InputStream inputStream) {
        try {
            String normalizedFileType = fileType.toLowerCase(Locale.ROOT);
            return switch (normalizedFileType) {
                case "pdf" -> extractPdfWithOcrFallback(inputStream);
                case "docx" -> extractDocx(inputStream);
                case "doc" -> extractDoc(inputStream);
                case "xlsx", "xls" -> extractSpreadsheet(inputStream);
                case "jpg", "jpeg", "png", "tif", "tiff" -> ocrService.extractImage(document, inputStream);
                default -> throw new UnsupportedOperationException("Unsupported file type: " + fileType);
            };
        } catch (IOException exception) {
            throw new IllegalStateException("Could not extract text", exception);
        }
    }

    private ExtractedDocumentText extractPdfWithOcrFallback(InputStream inputStream) throws IOException {
        byte[] content;
        try (inputStream) {
            content = inputStream.readAllBytes();
        }
        ExtractedDocumentText extractedText = extractPdf(content);
        if (extractedText.text().length() >= ocrProperties.minPdfTextLength()) {
            return extractedText;
        }
        return ocrService.extractPdf(new java.io.ByteArrayInputStream(content));
    }

    private ExtractedDocumentText extractPdf(byte[] content) throws IOException {
        try (var document = Loader.loadPDF(content)) {
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

    private ExtractedDocumentText extractSpreadsheet(InputStream inputStream) throws IOException {
        StringBuilder text = new StringBuilder();
        DataFormatter formatter = new DataFormatter(Locale.forLanguageTag("vi"));
        try (Workbook workbook = WorkbookFactory.create(inputStream)) {
            workbook.forEach(sheet -> sheet.forEach(row -> row.forEach(cell -> {
                String value = formatter.formatCellValue(cell);
                if (!value.isBlank()) {
                    if (!text.isEmpty()) {
                        text.append(' ');
                    }
                    text.append(value);
                }
            })));
        }
        return new ExtractedDocumentText(normalize(text.toString()), "POI_SPREADSHEET", "vi");
    }

    private String normalize(String text) {
        if (text == null) {
            return "";
        }
        return text.trim();
    }
}
