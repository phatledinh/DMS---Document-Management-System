package com.dms.document.processing;

import com.dms.document.entity.Document;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DocumentTextExtractionServiceTest {
    @Mock
    private DocumentOcrService ocrService;

    private DocumentTextExtractionService service;

    @BeforeEach
    void setUp() {
        service = new DocumentTextExtractionService(ocrService, new DocumentOcrProperties("http://localhost:8000/ocr", 200, 20, Duration.ofSeconds(30), 20));
    }

    @Test
    void extract_docxReturnsText() throws Exception {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        try (XWPFDocument document = new XWPFDocument()) {
            document.createParagraph().createRun().setText("Quy trình chất lượng");
            document.write(output);
        }
        Document document = document("DOCX");

        ExtractedDocumentText extracted = service.extract(document, new ByteArrayInputStream(output.toByteArray()));

        assertThat(extracted.text()).contains("Quy trình chất lượng");
        assertThat(extracted.method()).isEqualTo("POI_DOCX");
    }

    @Test
    void extract_imageUsesOcrService() {
        Document document = document("PNG");
        ExtractedDocumentText ocrText = new ExtractedDocumentText("xin chào", "VIETOCR_IMAGE", "vi");
        when(ocrService.extractImage(eq(document), any())).thenReturn(ocrText);

        ExtractedDocumentText extracted = service.extract(document, new ByteArrayInputStream(new byte[]{1}));

        assertThat(extracted).isEqualTo(ocrText);
        verify(ocrService).extractImage(eq(document), any());
    }

    @Test
    void extract_pdfWithNativeTextDoesNotUseOcr() throws Exception {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        try (PDDocument pdf = new PDDocument()) {
            PDPage page = new PDPage();
            pdf.addPage(page);
            try (var contentStream = new org.apache.pdfbox.pdmodel.PDPageContentStream(pdf, page)) {
                contentStream.beginText();
                contentStream.setFont(new org.apache.pdfbox.pdmodel.font.PDType1Font(org.apache.pdfbox.pdmodel.font.Standard14Fonts.FontName.HELVETICA), 12);
                contentStream.newLineAtOffset(50, 700);
                contentStream.showText("Native searchable PDF content");
                contentStream.endText();
            }
            pdf.save(output);
        }

        ExtractedDocumentText extracted = service.extract(document("PDF"), new ByteArrayInputStream(output.toByteArray()));

        assertThat(extracted.text()).contains("Native searchable PDF content");
        assertThat(extracted.method()).isEqualTo("PDFBOX");
        verify(ocrService, never()).extractPdf(any());
    }

    @Test
    void extract_pdfWithBlankNativeTextFallsBackToOcr() throws Exception {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        try (PDDocument pdf = new PDDocument()) {
            pdf.addPage(new PDPage());
            pdf.save(output);
        }
        ExtractedDocumentText ocrText = new ExtractedDocumentText("scan text", "VIETOCR_PDF", "vi");
        when(ocrService.extractPdf(any())).thenReturn(ocrText);

        ExtractedDocumentText extracted = service.extract(document("PDF"), new ByteArrayInputStream(output.toByteArray()));

        assertThat(extracted).isEqualTo(ocrText);
        verify(ocrService).extractPdf(any());
    }

    @Test
    void extract_xlsxReturnsCellText() throws Exception {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        try (Workbook workbook = new XSSFWorkbook()) {
            var sheet = workbook.createSheet("Sheet1");
            var row = sheet.createRow(0);
            row.createCell(0).setCellValue("Bảng chất lượng");
            workbook.write(output);
        }

        ExtractedDocumentText extracted = service.extract(document("XLSX"), new ByteArrayInputStream(output.toByteArray()));

        assertThat(extracted.text()).contains("Bảng chất lượng");
        assertThat(extracted.method()).isEqualTo("POI_SPREADSHEET");
    }

    @Test
    void extract_unsupportedFileTypeThrows() {
        Document document = document("PPTX");

        assertThatThrownBy(() -> service.extract(document, new ByteArrayInputStream(new byte[0])))
                .isInstanceOf(UnsupportedOperationException.class)
                .hasMessage("Unsupported file type: PPTX");
    }

    private Document document(String fileType) {
        Document document = new Document();
        document.setFileType(fileType);
        return document;
    }
}
