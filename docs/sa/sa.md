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
│ MySQL  │ │ File Storage │ │ Elasticsearch    │
│ (Meta) │ │ (Local/S3)   │ │ (Full-text)      │
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

Sử dụng **Elasticsearch** làm search engine mặc định ngay từ đầu. MySQL lưu metadata nguồn và dữ liệu quan hệ; Elasticsearch lưu index phục vụ full-text search, filter, highlight, relevance scoring và permission-aware query. Phase 1 không dùng MySQL Full-text Search làm fallback.

```text
┌─────────────────────────────────────────────────────┐
│                  Elasticsearch Cluster               │
│                                                     │
│  Index: documents                                   │
│  ┌───────────────────────────────────────────┐      │
│  │ document_id       (keyword)               │      │
│  │ document_code     (keyword + text boost)  │      │
│  │ title             (text, analyzed)        │      │
│  │ description       (text, analyzed)        │      │
│  │ extracted_content (text, analyzed)        │      │
│  │ status            (keyword)               │      │
│  │ access_level      (keyword)               │      │
│  │ category_id/name  (keyword, facetable)    │      │
│  │ department_ids    (keyword[], facetable)  │      │
│  │ allowed_user_ids  (keyword[])             │      │
│  │ owner_id          (keyword)               │      │
│  │ uploader_id       (keyword)               │      │
│  │ tag_ids/tags      (keyword[], facetable)  │      │
│  │ file_type         (keyword, facetable)    │      │
│  │ created_at        (date, sortable)        │      │
│  │ updated_at        (date, sortable)        │      │
│  │ effective_date    (date, filterable)      │      │
│  │ expiry_date       (date, filterable)      │      │
│  │ view_count        (integer, sortable)     │      │
│  │ download_count    (integer, sortable)     │      │
│  └───────────────────────────────────────────┘      │
│                                                     │
│  Features:                                          │
│  ✅ Full-text search (BM25 scoring)                 │
│  ✅ Permission filter trước khi trả kết quả         │
│  ✅ Fuzzy search (tolerance for typos)              │
│  ✅ Synonym support                                 │
│  ✅ Vietnamese Analyzer (ICU + custom dictionary)   │
│  ✅ Faceted Aggregations                            │
│  ✅ Highlighted snippets                            │
│  ✅ Autocomplete / Suggest                          │
└─────────────────────────────────────────────────────┘
```

**Sync Strategy (MySQL → Elasticsearch):**
- **After-commit event**: Indexing/re-indexing chạy sau khi transaction MySQL commit thành công.
- **Failure handling**: Nếu extraction hoặc indexing thất bại, tài liệu chuyển `EXTRACTION_FAILED` hoặc ghi retry task tương ứng.
- **Retry**: Scheduled job retry mỗi 30 phút cho lỗi extraction/indexing tạm thời.
- **Batch Re-index**: Scheduled job chạy hàng đêm để self-heal lệch index giữa MySQL và Elasticsearch.

---

## 4. Content Extraction Pipeline

### Extraction & Preview Responsibility

Tika không phải extractor chính cho toàn bộ file trong Phase 1. Trách nhiệm được phân định như sau:

| Thành phần | Vai trò |
|------------|---------|
| **Apache Tika** | Detect MIME type thực tế khi upload và fallback extraction khi cần |
| **Apache PDFBox** | Extractor chính cho PDF text |
| **Apache POI** | Extractor chính cho DOC/DOCX/XLS/XLSX |
| **JODConverter + LibreOffice headless** | Convert Word/Excel sang PDF hoặc HTML preview |
| **OWASP Java HTML Sanitizer / Jsoup** | Sanitize HTML preview và search highlight trước khi trả frontend |
| **Tesseract OCR** | OCR scanned PDF/image ở Phase 2 |

```text
File Input
    ↓
[Tika MIME Detection]
    ├── PDF text      → PDFBox extract text → extracted_content
    ├── DOC/DOCX      → Apache POI extract text → extracted_content
    ├── XLS/XLSX      → Apache POI extract text → extracted_content
    ├── Word/Excel    → JODConverter + LibreOffice → PDF/HTML preview
    ├── HTML preview  → HtmlSanitizer → safe preview response
    └── Image/PDF scan → OCR Phase 2, Phase 1 có thể index metadata với extracted_content rỗng
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

### Document Access Policy

- Search, metadata detail, preview và download dùng chung `DocumentAccessPolicyService`.
- Elasticsearch query phải filter theo quyền truy cập trước khi trả kết quả; không search xong rồi mới loại bỏ ở frontend.
- User không có quyền không được nhìn thấy title, snippet, metadata hoặc download URL của tài liệu.
- Tài liệu `DELETED` không xuất hiện trong search, preview, download hoặc metadata detail của User.
- Tài liệu `ARCHIVED` không hiển thị mặc định với User; Admin có thể filter để xem.
- Unauthorized access trả `404` hoặc `403` nhưng không lộ metadata/file URL.

### API Response Standard

- Tất cả REST endpoint trả JSON thống nhất qua `ApiResponse<T>`.
- Endpoint phân trang dùng `PageResponse<T>` bên trong `ApiResponse<T>`.
- `GlobalExceptionHandler` chuẩn hóa lỗi validation, authentication, authorization và business error về cùng error payload.

### API Security Matrix

| Endpoint Pattern | ADMIN | USER | PUBLIC |
|-----------------|-------|------|--------|
| `POST /documents` (upload) | ✅ | ❌ | ❌ |
| `PUT/DELETE /documents/{id}` | ✅ | ❌ | ❌ |
| `GET /documents/search` | ✅ | ✅ | ❌ |
| `GET /documents/search/suggestions` | ✅ | ✅ | ❌ |
| `GET /documents/{id}` | ✅ | ✅ | ❌ |
| `GET /documents/{id}/preview` | ✅ | ✅ | ❌ |
| `GET /documents/{id}/download` | ✅ | ✅ | ❌ |
| `GET /documents/{id}/versions` | ✅ | ✅ | ❌ |
| `POST /documents/{id}/versions` | ✅ | ❌ | ❌ |
| `POST /documents/{id}/versions/{versionId}/restore` | ✅ | ❌ | ❌ |
| `POST /documents/{id}/archive` | ✅ | ❌ | ❌ |
| `POST /documents/{id}/restore` | ✅ | ❌ | ❌ |
| `POST /documents/{id}/retry-indexing` | ✅ | ❌ | ❌ |
| `POST /auth/login` | — | — | ✅ |
| `POST /auth/refresh` | — | — | ✅ |
| `POST /auth/logout` | ✅ | ✅ | ❌ |
| `POST /users` | ✅ | ❌ | ❌ |
| `GET/PUT /users/me` | ✅ | ✅ | ❌ |
| `CRUD /users/{id}` | ✅ | ❌ | ❌ |
| `CRUD /categories` | ✅ | READ | ❌ |
| `CRUD /departments` | ✅ | READ | ❌ |
| `CRUD /tags` | ✅ | READ | ❌ |
| `GET /admin/dashboard/**` | ✅ | ❌ | ❌ |
| `GET /admin/audit-logs` | ✅ | ❌ | ❌ |
| `GET /admin/analytics/**` | ✅ | ❌ | ❌ |

---

## 6. Background Jobs

Sử dụng **Spring Scheduler** (`@Scheduled`):

| Job | Tần suất | Mô tả |
|-----|----------|-------|
| Re-index batch | Hàng đêm (2:00 AM) | Đồng bộ lại toàn bộ search index để self-heal lệch index |
| Content extraction retry | Mỗi 30 phút | Retry extraction/indexing cho documents `EXTRACTION_FAILED` do lỗi tạm thời |
| Storage cleanup | Hàng tuần hoặc Phase 2 hardening | Chỉ xóa orphan files không còn metadata/version reference; không xóa file của tài liệu soft-deleted còn khả năng restore |
| Analytics aggregation | Hàng ngày | Tổng hợp view/download/search metrics cho dashboard, tránh scan log lớn trực tiếp |
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

## 8. Dashboard & Analytics API Contract

Dashboard dùng nhóm endpoint Admin thống nhất với phân rã tính năng và phân rã màn hình:

| Endpoint | Mục đích |
|----------|----------|
| `GET /admin/dashboard` | Thống kê tổng quan: documents, users, categories, departments, preview/download/search totals |
| `GET /admin/dashboard/top-documents` | Top tài liệu xem/tải nhiều |
| `GET /admin/dashboard/recent-uploads` | Tài liệu upload gần đây |
| `GET /admin/dashboard/top-search-keywords` | Top keyword tìm kiếm, resultCount trung bình, searchTime trung bình |
| `GET /admin/dashboard/access-stats` | Thống kê preview/download theo ngày/tuần/tháng, unique users |
| `GET /admin/dashboard/processing-errors` | Tài liệu `PROCESSING` lâu hoặc `EXTRACTION_FAILED` |
| `GET /admin/audit-logs` | Tra cứu audit/access/search logs với filters |
| `GET /admin/analytics/**` | Optional nếu triển khai MH18 như màn riêng thay vì tab trong dashboard |

Nếu chọn gom MH18 vào tab của MH07, không cần tạo thêm API `/admin/analytics/**`.

---

## 9. Backend Package Structure

```text
backend/
├── src/main/java/com/dms/
│   ├── DmsApplication.java
│   ├── common/                         ← Shared utilities
│   │   ├── config/                     ← AppConfig, CorsConfig, CacheConfig
│   │   ├── exception/                  ← GlobalExceptionHandler, custom exceptions
│   │   ├── security/                   ← JwtFilter, SecurityConfig, JwtProvider
│   │   └── dto/                        ← ApiResponse<T>, PageResponse
│   ├── identity/                       ← PH1: Identity module
│   │   ├── controller/
│   │   ├── service/
│   │   ├── entity/
│   │   ├── repository/
│   │   ├── dto/
│   │   └── mapper/
│   ├── document/                       ← PH2: Document module
│   │   ├── controller/
│   │   ├── service/
│   │   │   ├── DocumentService.java
│   │   │   ├── DocumentAccessPolicyService.java
│   │   │   ├── StorageService.java
│   │   │   ├── ContentExtractorService.java
│   │   │   └── PreviewService.java     ← JODConverter/LibreOffice + HtmlSanitizer
│   │   ├── entity/
│   │   ├── repository/
│   │   ├── dto/
│   │   └── mapper/
│   ├── search/                         ← PH3: Search module
│   │   ├── controller/
│   │   ├── service/                    ← SearchService, SearchIndexService, SuggestionService
│   │   └── dto/
│   ├── masterdata/                     ← PH4: Master Data
│   │   ├── controller/
│   │   ├── service/
│   │   ├── entity/
│   │   ├── repository/
│   │   ├── dto/
│   │   └── mapper/
│   ├── dashboard/                      ← PH5: Dashboard
│   │   ├── controller/
│   │   ├── service/
│   │   └── dto/
│   └── audit/                          ← PH6: Audit & Access Log
│       ├── controller/                 ← AuditLogController (/admin/audit-logs)
│       ├── service/                    ← AuditLogService, AccessLogService, SearchLogService
│       ├── entity/                     ← AuditLog, AccessLog, SearchLog
│       ├── repository/
│       └── dto/
├── src/main/resources/
│   ├── db/migration/                   ← Flyway migration scripts (V1__init.sql...)
│   ├── application.yml                 ← multipart max-file-size/max-request-size = 50MB
│   ├── application-dev.yml
│   └── application-prod.yml
├── src/test/
├── pom.xml hoặc build.gradle
└── Dockerfile                          ← Backend image cần LibreOffice nếu preview Office dùng JODConverter
```

---

## 10. Scalability Roadmap

| Phase | Mục tiêu | Giải pháp |
|-------|----------|-----------|
| **Phase 1** | MVP — < 10k documents | Elasticsearch single-node, Local Storage, Monolith |
| **Phase 2** | Scale — 10k–100k documents | Elasticsearch cluster, S3/MinIO, OCR (Tesseract), Redis Cache |
| **Phase 3** | Enterprise — > 100k documents | Multi-node Elasticsearch, CDN, Async queue (RabbitMQ), Vietnamese NLP |
