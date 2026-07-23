# Architecture — Hệ Thống Quản Lý Tài Liệu Nội Bộ (DMS)

> System design overview cho hệ thống Quản lý & Tìm kiếm Tài liệu Doanh nghiệp.
> Update only during architecture review sessions.

---

## Tổng Quan Hệ Thống

Hệ thống cho phép **Admin** upload, phân loại và quản lý tài liệu nội bộ doanh nghiệp (SOP, quy trình, biểu mẫu, hướng dẫn...). **User** có thể tìm kiếm, đọc online (preview) và tải tài liệu. Chức năng cốt lõi là **Search Engine** mạnh mẽ, hỗ trợ tìm kiếm full-text nội dung bên trong file.

### Loại tài liệu hỗ trợ
| Loại | Định dạng | Ghi chú |
|------|-----------|---------|
| PDF (Text) | `.pdf` | Có thể trích xuất nội dung text để index |
| PDF (Scanned/Image) | `.pdf` | Cần OCR để trích xuất text (Phase 2) |
| Word | `.doc`, `.docx` | Hỗ trợ cả bản cũ (97-2003) và bản mới |
| Excel | `.xls`, `.xlsx` | Trích xuất nội dung sheet |
| Image | `.jpg`, `.png`, `.tiff` | OCR để trích xuất text (Phase 2) |

---

## High-Level Architecture

```text
                         ┌──────────────────────┐
                         │   Client (SPA/Web)    │
                         │   React + Vite        │
                         └──────────┬────────────┘
                                    │ HTTPS
                                    ▼
                         ┌──────────────────────┐
                         │   API Gateway /       │
                         │   Spring Boot App     │
                         └──────────┬────────────┘
                                    │
          ┌────────────────────┬────┴────┬─────────────────────┐
          ▼                    ▼         ▼                     ▼
 ┌─────────────────┐  ┌────────────┐  ┌────────────────┐  ┌──────────────┐
 │   Controller    │  │  Security  │  │  Exception     │  │  File Upload │
 │   (REST API)    │  │  (JWT)     │  │  Handler       │  │  Handler     │
 └────────┬────────┘  └────────────┘  └────────────────┘  └──────────────┘
          │
          ▼
 ┌───────────────────────────────┐
 │     Application Layer         │ (Use Cases / Orchestration)
 │  DocumentUploadUseCase        │
 │  DocumentSearchUseCase        │
 │  ContentExtractionUseCase     │
 └──────────────┬────────────────┘
                │
                ▼
 ┌───────────────────────────────┐
 │     Domain Services           │ (Business Logic)
 │  DocumentService              │
 │  CategoryService              │
 │  SearchService                │
 │  ContentExtractorService      │
 └──────────────┬────────────────┘
                │
    ┌───────────┼────────────────┐
    ▼           ▼                ▼
┌────────┐ ┌──────────────┐ ┌──────────────────┐
│ MySQL  │ │ File Storage │ │ Elasticsearch    │
│ (Meta) │ │ (Local/S3)   │ │ (Full-text Index)│
└────────┘ └──────────────┘ └──────────────────┘
```

---

## Luồng Nghiệp Vụ Chính

### 1. Upload & Xử lý tài liệu (Admin)

```text
Admin Upload File
      ↓
[FileUploadHandler] — Validate type, size
      ↓
[StorageService] — Lưu file gốc vào File Storage (Local / S3)
      ↓
[ContentExtractorService] — Trích xuất nội dung text từ file
  ├── PDF (Text)  → Apache PDFBox
  ├── PDF (Scan)  → Apache Tika + Tesseract OCR (Phase 2)
  ├── DOCX        → Apache POI
  ├── DOC (cũ)    → Apache POI (HWPF)
  ├── XLS/XLSX    → Apache POI
  └── Image       → Tesseract OCR (Phase 2)
      ↓
[DocumentService] — Lưu metadata vào MySQL
      ↓
[SearchIndexService] — Index nội dung + metadata vào Search Engine
      ↓
Response ← { documentId, status: "INDEXED" }
```

### 2. Tìm kiếm tài liệu (User)

```text
User nhập query + filters
      ↓
[SearchController] — Nhận request
      ↓
[SearchService] — Xây dựng search query
  ├── Full-text search trên nội dung tài liệu
  ├── Filter theo: category, file_type, date_range, tags, department
  ├── Faceted search (đếm kết quả theo từng filter)
  ├── Highlight matched text trong kết quả
  └── Sort: relevance, date, downloads, title
      ↓
[Elasticsearch] — Execute query
  ├── Multi-match + fuzzy search
  ├── Faceted aggregations
  └── Native highlight snippets
      ↓
Response ← { results[], facets{}, totalHits, highlights[] }
```

### 3. Đọc & Tải tài liệu (User)

```text
User click vào tài liệu
      ↓
[DocumentController] — GET /documents/{id}
      ↓
[DocumentService]
  ├── Lấy metadata từ MySQL
  ├── Tăng view_count
  └── Ghi lại access_log
      ↓
Response ← { metadata, previewUrl, downloadUrl }

--- Preview ---
[PreviewController] — GET /documents/{id}/preview
  ├── PDF → Trả stream PDF trực tiếp (browser render)
  ├── DOCX/DOC → Convert sang PDF rồi trả stream (LibreOffice / Apache POI)
  ├── Image → Trả stream trực tiếp
  └── XLS/XLSX → Convert sang HTML table hoặc PDF
      ↓
Response ← Binary stream / HTML

--- Download ---
[DownloadController] — GET /documents/{id}/download
  ├── Tăng download_count
  └── Trả file gốc với Content-Disposition header
      ↓
Response ← File binary
```

---

## Software Design Patterns

### 1. Clean Architecture (Application Layer + Domain Services)

- **Domain Services**: (`DocumentService`, `CategoryService`, `TagService`). Xử lý logic nghiệp vụ nội tại của từng entity.
- **Application Layer** (Use Cases): (`DocumentUploadUseCase`, `DocumentSearchUseCase`). Điều phối nhiều Domain Services.
  - Ví dụ: `DocumentUploadUseCase` sẽ gọi `StorageService` (lưu file) → `ContentExtractorService` (trích xuất text) → `DocumentService` (lưu metadata) → `SearchIndexService` (đánh index).

### 2. Strategy Pattern — Content Extraction

Vì hệ thống hỗ trợ nhiều loại file khác nhau, sử dụng **Strategy Pattern** để trích xuất nội dung:

```text
ContentExtractorService
  ├── PdfTextExtractor          (Apache PDFBox)
  ├── PdfOcrExtractor           (Tika + Tesseract - Phase 2)
  ├── DocxExtractor             (Apache POI - XWPF)
  ├── DocExtractor              (Apache POI - HWPF)
  ├── ExcelExtractor            (Apache POI)
  └── ImageOcrExtractor         (Tesseract - Phase 2)
```

Interface:
```java
public interface ContentExtractor {
    boolean supports(String mimeType);
    ExtractionResult extract(InputStream file);
}
```

`ContentExtractorService` sẽ tự chọn đúng `ContentExtractor` dựa trên `mimeType` của file.

### 3. Observer Pattern — Search Index Sync

Khi tài liệu được tạo/sửa/xóa, cần đồng bộ sang Search Engine. Sử dụng **Spring Application Events** để decouple:

```text
DocumentCreatedEvent  → SearchIndexListener (index document)
DocumentUpdatedEvent  → SearchIndexListener (re-index)
DocumentDeletedEvent  → SearchIndexListener (remove from index)
```

### 4. Adapter Pattern — Search Engine Abstraction

Trừu tượng hóa lớp gọi Elasticsearch để tách business logic khỏi chi tiết query/indexing:

```java
public interface SearchEngine {
    SearchResult search(SearchQuery query);
    void index(DocumentIndex document);
    void delete(Long documentId);
    void reindexAll();
}
```

Implementation:
- `ElasticsearchSearchEngine` — search engine mặc định cho full-text search, filters, highlight và scoring

### 5. Transaction Boundaries

- **Write Operations** (upload, update, delete...): `@Transactional`
- **Read Operations** (search, findById, preview...): `@Transactional(readOnly = true)`

### 6. Validation Pipeline

```text
HTTP Request
  ↓
DTO Validation (@Valid — kiểm tra file type, size, metadata)
  ↓
Business Validation (kiểm tra trùng lặp? quyền truy cập? category tồn tại?)
  ↓
Authorization (JWT — Admin mới được upload/xóa, User chỉ đọc/tải)
  ↓
Persistence (Lưu file + MySQL + Search Index)
  ↓
Response
```

### 7. Mapper Strategy

Sử dụng **MapStruct** cho toàn bộ chuyển đổi Entity ↔ DTO. Không dùng Manual Mapping.

---

## Domain Modules & Dependency Graph

Hệ thống chia thành **4 Domain** chính:

```text
1. Identity (Quản lý người dùng)
   └── User

2. Document (Quản lý tài liệu — Core Domain)
   ├── Document (metadata + nội dung)
   ├── DocumentVersion (lịch sử phiên bản)
   ├── Category (danh mục phân loại)
   ├── Tag (gắn nhãn tài liệu)
   └── Department (phòng ban sở hữu)

3. Search (Search Engine — Core Feature)
   ├── SearchIndex (đánh index nội dung)
   ├── SearchQuery (xây dựng query)
   └── SearchResult (kết quả + highlight)
```

### Dependency Flow

```text
Search → Document (index document content & metadata)
Document → Identity (document owner / uploader)
All Modules → Identity (User)
```

---

## Search Engine Architecture (Chi tiết)

### Elasticsearch-first Search Engine

Sử dụng **Elasticsearch** làm search engine mặc định ngay từ đầu. MySQL lưu metadata nguồn và dữ liệu quan hệ; Elasticsearch lưu index phục vụ full-text search, filter, highlight và relevance scoring:

```text
┌─────────────────────────────────────────────────────┐
│                  Elasticsearch Cluster               │
│                                                     │
│  Index: documents                                   │
│  ┌───────────────────────────────────────────┐      │
│  │ title          (text, analyzed)           │      │
│  │ extracted_text (text, analyzed)           │      │
│  │ description    (text, analyzed)           │      │
│  │ file_name      (keyword)                  │      │
│  │ file_type      (keyword, facetable)       │      │
│  │ category_name  (keyword, facetable)       │      │
│  │ tags           (keyword[], facetable)     │      │
│  │ department     (keyword, facetable)       │      │
│  │ uploaded_by    (keyword)                  │      │
│  │ uploaded_at    (date, sortable)           │      │
│  │ view_count     (integer, sortable)        │      │
│  │ download_count (integer, sortable)        │      │
│  └───────────────────────────────────────────┘      │
│                                                     │
│  Features:                                          │
│  ✅ Full-text search (BM25 scoring)                 │
│  ✅ Fuzzy search (tolerance for typos)              │
│  ✅ Synonym support (configurable)                  │
│  ✅ Vietnamese Analyzer (ICU + custom dictionary)   │
│  ✅ Faceted Aggregations                            │
│  ✅ Highlighted snippets                            │
│  ✅ Autocomplete / Suggest                          │
│  ✅ More Like This (gợi ý tài liệu tương tự)      │
└─────────────────────────────────────────────────────┘
```

**Sync Strategy (MySQL → Elasticsearch):**
- **Real-time**: Dùng Application Events khi create/update/delete.
- **Batch Re-index**: Scheduled job chạy hàng đêm để đồng bộ lại toàn bộ (phòng trường hợp lệch data).

---

## Storage Layer

### File Storage Abstraction

```java
public interface StorageService {
    StorageResult upload(MultipartFile file, String path);
    void delete(String storagePath);
    Resource download(String storagePath);
    String generatePreviewUrl(String storagePath);
}
```

| Phase | Implementation | Mô tả |
|-------|---------------|--------|
| Phase 1 | `LocalStorageService` | Lưu file trên disk server, serve qua Spring Resource |
| Phase 2 | `S3StorageService` | Lưu trên AWS S3 / MinIO, dùng Pre-signed URL |

### Cấu trúc thư mục lưu trữ

```text
/storage/documents/
  ├── 2026/07/
  │   ├── {uuid}_original.pdf          ← File gốc
  │   ├── {uuid}_preview.pdf           ← File preview (nếu convert)
  │   └── {uuid}_thumbnail.png         ← Thumbnail cho listing
  └── ...
```

### Upload Constraints

| Constraint | Giá trị |
|-----------|---------|
| Max file size | 50 MB |
| Allowed types | `.pdf`, `.doc`, `.docx`, `.xls`, `.xlsx`, `.jpg`, `.png`, `.tiff` |
| Max files per request | 1 |
| Naming | UUID-based để tránh trùng lặp |

---

## Content Extraction Pipeline

### Apache Tika Integration

Sử dụng **Apache Tika** làm framework trích xuất nội dung thống nhất, bên dưới Tika sẽ delegate cho các parser phù hợp:

```text
File Input
    ↓
[Tika AutoDetectParser]
    ├── application/pdf         → PDFBox Parser
    ├── application/msword      → POI OLE2 Parser (DOC)
    ├── application/vnd.openxmlformats...word → POI OOXML Parser (DOCX)
    ├── application/vnd.ms-excel             → POI OLE2 Parser (XLS)
    ├── application/vnd.openxmlformats...sheet → POI OOXML Parser (XLSX)
    └── image/*                 → Tesseract OCR Parser (Phase 2)
    ↓
ExtractionResult {
    extractedText: String,      ← Nội dung text đã trích xuất
    metadata: Map<String,String>, ← Tiêu đề, tác giả, ngày tạo từ file metadata
    pageCount: Integer,          ← Số trang (nếu có)
    language: String             ← Ngôn ngữ phát hiện được
}
```

### OCR Pipeline (Phase 2)

Cho PDF scan và ảnh, cần thêm Tesseract OCR:

```text
Scanned PDF / Image
    ↓
[Tika + Tesseract]
    ├── PDF → Render từng trang thành image → OCR
    └── Image → OCR trực tiếp
    ↓
Extracted Text (có thể kém chính xác → cần review flag)
```

---

## Security & Authorization

### Role-based Access Control (2 roles)

| Role | Quyền |
|------|-------|
| **ADMIN** | Upload, Edit, Delete tài liệu; Quản lý categories/tags/departments; Xem analytics; Quản lý users |
| **USER** | Tìm kiếm, Đọc (preview), Tải (download) tài liệu; Xem thông báo |

### JWT Authentication Flow

```text
Login (email + password)
    ↓
Server → Verify credentials → Issue JWT (Access Token) + Refresh Token (HttpOnly Cookie)
    ↓
Client → Gửi Access Token trong Authorization header cho mọi request
    ↓
Server → Verify JWT → Extract userId, role → Authorize endpoint
```

### API Security Matrix

| Endpoint Pattern | ADMIN | USER | PUBLIC |
|-----------------|-------|------|--------|
| `POST /documents` (upload) | ✅ | ❌ | ❌ |
| `PUT /documents/{id}` | ✅ | ❌ | ❌ |
| `DELETE /documents/{id}` | ✅ | ❌ | ❌ |
| `GET /documents/search` | ✅ | ✅ | ❌ |
| `GET /documents/{id}` | ✅ | ✅ | ❌ |
| `GET /documents/{id}/preview` | ✅ | ✅ | ❌ |
| `GET /documents/{id}/download` | ✅ | ✅ | ❌ |
| `POST /auth/login` | — | — | ✅ |
| `POST /auth/register` | ✅ | ❌ | ❌ |
| `GET /categories` | ✅ | ✅ | ❌ |
| `POST /categories` | ✅ | ❌ | ❌ |
| `GET /analytics/*` | ✅ | ❌ | ❌ |

---

## Background Jobs (Scheduler)

Sử dụng **Spring Scheduler** (`@Scheduled`):

| Job | Tần suất | Mô tả |
|-----|----------|--------|
| Re-index batch | Hàng đêm (2:00 AM) | Đồng bộ lại toàn bộ search index từ MySQL |
| Content extraction retry | Mỗi 30 phút | Retry extract cho documents bị lỗi (status = `EXTRACTION_FAILED`) |
| Storage cleanup | Hàng tuần | Xóa file mồ côi (có trên disk nhưng không có trong DB) |
| Analytics aggregation | Hàng ngày | Tổng hợp view_count, download_count, search trends |
| OCR queue processor | Mỗi 5 phút (Phase 2) | Xử lý hàng đợi OCR cho scanned documents |

---

## Caching Strategy

### Redis Cache (Spring Cache)

| Cache Key Pattern | TTL | Mô tả |
|------------------|-----|--------|
| `categories:tree` | 1 giờ | Toàn bộ cây danh mục |
| `departments:all` | 1 giờ | Danh sách phòng ban |
| `tags:popular` | 30 phút | Tags phổ biến cho autocomplete |
| `document:meta:{id}` | 15 phút | Metadata tài liệu hay xem |
| `search:suggest:{prefix}` | 10 phút | Autocomplete suggestions |

**Cache Invalidation**: Mọi thao tác write (create/update/delete) category, tag, department sẽ tự động `@CacheEvict`.

---

## Scalability Roadmap

| Phase | Mục tiêu | Giải pháp |
|-------|----------|-----------|
| **Phase 1** | MVP — < 10k documents | Elasticsearch single-node, Local Storage, Monolith |
| **Phase 2** | Scale — 10k–100k documents | Elasticsearch cluster, S3/MinIO, OCR (Tesseract), Redis Cache |
| **Phase 3** | Enterprise — > 100k documents | Multi-node Elasticsearch, CDN cho preview, Async processing queue (RabbitMQ), Vietnamese NLP |