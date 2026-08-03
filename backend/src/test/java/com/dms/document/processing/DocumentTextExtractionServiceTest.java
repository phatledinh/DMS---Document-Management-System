package com.dms.document.processing;

import com.dms.document.entity.Document;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class DocumentTextExtractionServiceTest {
    private final DocumentTextExtractionService service = new DocumentTextExtractionService();

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
    void extract_unsupportedFileTypeThrows() {
        Document document = document("XLSX");

        assertThatThrownBy(() -> service.extract(document, new ByteArrayInputStream(new byte[0])))
                .isInstanceOf(UnsupportedOperationException.class)
                .hasMessage("Unsupported file type: XLSX");
    }

    private Document document(String fileType) {
        Document document = new Document();
        document.setFileType(fileType);
        return document;
    }
}
