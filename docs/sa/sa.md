# System Architecture — DMS

> Kiến trúc hệ thống tổng quan và chi tiết cho hệ thống Quản lý Tài liệu Nội bộ.

---

## 1. High-Level Architecture

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
│ MySQL  │ │ File Storage │ │ Search Engine    │
│ (Meta) │ │ (Local/S3)   │ │ (MySQL FT / ES)  │
└────────┘ └──────────────┘ └──────────────────┘
```

---

## 2. Software Design Patterns

### 2.1 Clean Architecture (Application Layer + Domain Services)

- **Domain Services**: (`DocumentService`, `CategoryService`, `TagService`). Xử lý logic nghiệp vụ nội tại của từng entity.
- **Application Layer** (Use Cases): (`DocumentUploadUseCase`, `DocumentSearchUseCase`). Điều phối nhiều Domain Services.
  - Ví dụ: `DocumentUploadUseCase` sẽ gọi `StorageService` (lưu file) → `ContentExtractorService` (trích xuất text) → `DocumentService` (lưu metadata) → `SearchIndexService` (đánh index).

### 2.2 Strategy Pattern — Content Extraction

Hệ thống hỗ trợ nhiều loại file, sử dụng **Strategy Pattern** để trích xuất nội dung:

```text
ContentExtractorService
  ├── PdfTextExtractor          (Apache PDFBox)
  ├── PdfOcrExtractor           (Tika + Tesseract - Phase 2)
  ├── DocxExtractor             (Apache POI - XWPF)
  ├── DocExtractor              (Apache POI - HWPF)
  ├── ExcelExtractor            (Apache POI)
  └── ImageOcrExtractor         (Tesseract - Phase 2)
```

```java
public interface ContentExtractor {
    boolean supports(String mimeType);
    ExtractionResult extract(InputStream file);
}
```

`ContentExtractorService` tự chọn đúng `ContentExtractor` dựa trên `mimeType` của file.

### 2.3 Observer Pattern — Search Index Sync

Khi tài liệu được tạo/sửa/xóa, cần đồng bộ sang Search Engine. Sử dụng **Spring Application Events**:

```text
DocumentCreatedEvent  → SearchIndexListener (index document)
DocumentUpdatedEvent  → SearchIndexListener (re-index)
DocumentDeletedEvent  → SearchIndexListener (remove from index)
```

### 2.4 Adapter Pattern — Search Engine Abstraction

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

### 2.5 Transaction Boundaries

- **Write Operations** (upload, update, delete...): `@Transactional`
- **Read Operations** (search, findById, preview...): `@Transactional(readOnly = true)`

### 2.6 Validation Pipeline

```text
HTTP Request
  ↓
DTO Validation (@Valid — kiểm tra file type, size, metadata)
  ↓
Business Validation (trùng lặp? quyền truy cập? category tồn tại?)
  ↓
Authorization (JWT — Admin mới được upload/xóa, User chỉ đọc/tải)
  ↓
Persistence (Lưu file + MySQL + Search Index)
  ↓
Response
```

### 2.7 Mapper Strategy

Sử dụng **MapStruct** cho toàn bộ chuyển đổi Entity ↔ DTO. Không dùng Manual Mapping.

---

## 3. Search Engine Architecture

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
│  │ file_type      (keyword, facetable)       │      │
│  │ category_name  (keyword, facetable)       │      │
│  │ tags           (keyword[], facetable)     │      │
│  │ department     (keyword, facetable)       │      │
│  │ view_count     (integer, sortable)        │      │
│  │ download_count (integer, sortable)        │      │
│  └───────────────────────────────────────────┘      │
│                                                     │
│  Features:                                          │
│  ✅ Full-text search (BM25 scoring)                 │
│  ✅ Fuzzy search (tolerance for typos)              │
│  ✅ Synonym support                                 │
│  ✅ Vietnamese Analyzer (ICU + custom dictionary)   │
│  ✅ Faceted Aggregations                            │
│  ✅ Highlighted snippets                            │
│  ✅ Autocomplete / Suggest                          │
│  ✅ More Like This (gợi ý tài liệu tương tự)      │
└─────────────────────────────────────────────────────┘
```

**Sync Strategy (MySQL → Elasticsearch):**
- **Real-time**: Dùng Application Events khi create/update/delete.
- **Batch Re-index**: Scheduled job chạy hàng đêm.

---

## 4. Content Extraction Pipeline

### Apache Tika Integration

Sử dụng **Apache Tika** làm framework trích xuất nội dung thống nhất:

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
    extractedText: String,
    metadata: Map<String,String>,
    pageCount: Integer,
    language: String
}
```

### OCR Pipeline (Phase 2)

```text
Scanned PDF / Image
    ↓
[Tika + Tesseract]
    ├── PDF → Render từng trang thành image → OCR
    └── Image → OCR trực tiếp
    ↓
Extracted Text
```

---

## 5. Security & Authorization

### Role-based Access Control

| Role | Quyền |
|------|-------|
| **ADMIN** | Upload, Edit, Delete tài liệu; Quản lý categories/tags/departments; Xem analytics; Quản lý users |
| **USER** | Tìm kiếm, Đọc (preview), Tải (download) tài liệu |

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
| `PUT/DELETE /documents/{id}` | ✅ | ❌ | ❌ |
| `GET /documents/search` | ✅ | ✅ | ❌ |
| `GET /documents/{id}` | ✅ | ✅ | ❌ |
| `GET /documents/{id}/preview` | ✅ | ✅ | ❌ |
| `GET /documents/{id}/download` | ✅ | ✅ | ❌ |
| `POST /auth/login` | — | — | ✅ |
| `POST /auth/register` | ✅ | ❌ | ❌ |
| `CRUD /categories` | ✅ | READ | ❌ |
| `GET /analytics/*` | ✅ | ❌ | ❌ |

---

## 6. Background Jobs

Sử dụng **Spring Scheduler** (`@Scheduled`):

| Job | Tần suất | Mô tả |
|-----|----------|-------|
| Re-index batch | Hàng đêm (2:00 AM) | Đồng bộ lại toàn bộ search index |
| Content extraction retry | Mỗi 30 phút | Retry extract cho documents lỗi |
| Storage cleanup | Hàng tuần | Xóa file mồ côi |
| Analytics aggregation | Hàng ngày | Tổng hợp view/download counts |
| OCR queue processor | Mỗi 5 phút (Phase 2) | Xử lý hàng đợi OCR |

---

## 7. Caching Strategy (Redis)

| Cache Key Pattern | TTL | Mô tả |
|------------------|-----|-------|
| `categories:tree` | 1 giờ | Toàn bộ cây danh mục |
| `departments:all` | 1 giờ | Danh sách phòng ban |
| `tags:popular` | 30 phút | Tags phổ biến |
| `document:meta:{id}` | 15 phút | Metadata tài liệu |
| `search:suggest:{prefix}` | 10 phút | Autocomplete suggestions |

**Cache Invalidation**: Write operations → `@CacheEvict`.

---

## 8. Scalability Roadmap

| Phase | Mục tiêu | Giải pháp |
|-------|----------|-----------|
| **Phase 1** | MVP — < 10k documents | Elasticsearch single-node, Local Storage, Monolith |
| **Phase 2** | Scale — 10k–100k documents | Elasticsearch cluster, S3/MinIO, OCR (Tesseract), Redis Cache |
| **Phase 3** | Enterprise — > 100k documents | Multi-node Elasticsearch, CDN, Async queue (RabbitMQ), Vietnamese NLP |
