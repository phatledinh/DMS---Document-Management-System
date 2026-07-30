# System Architecture — DMS

> Kiến trúc hệ thống tổng quan và chi tiết cho hệ thống Quản lý Tài liệu Nội bộ.

---

## 1. High-Level Architecture

```text
                         ┌──────────────────────┐
                         │   Client (SPA/Web)    │
                         │   React + Vite        │
                         └───────┬────────┬──────┘
                                 │ HTTPS  │ Presigned PUT/GET
                                 ▼        ▼
                         ┌──────────────────────┐        ┌──────────────┐
                         │   API Gateway /       │        │ S3-compatible│
                         │   Spring Boot API     │        │ Object Store │
                         │   (profile=api)       │        │ MinIO / R2   │
                         └──────────┬───────────┘        └──────┬───────┘
                                    │ publish after commit       │ pull file / write artifact
                                    ▼                            │
                              ┌──────────┐                       │
                              │ RabbitMQ │                       │
                              │ dms.tasks│                       │
                              └────┬─────┘                       │
                                   ▼                             │
                         ┌──────────────────────┐                │
                         │ Spring Boot Worker   │◀───────────────┘
                         │ (profile=worker)     │
                         │ extract/ocr/preview/ │
                         │ index consumers      │
                         └──────────┬───────────┘
                                    ▼
        ┌────────────────────────────────────────────────────────────┐
        │ PostgreSQL DB + FTS + ACL + lifecycle + document contents  │
        └────────────────────────────────────────────────────────────┘
```


---

## 2. Software Design Patterns

### 2.1 Clean Architecture (Application Layer + Domain Services)

- **Domain Services**: (`DocumentService`, `DocumentBatchService`, `DocumentLifecycleService`, `DocumentStorageStatsService`, `CategoryService`, `TagService`). Xử lý logic nghiệp vụ nội tại của từng entity.
- **Application Layer** (Use Cases): (`DocumentUploadUseCase`, `DocumentSearchUseCase`). Điều phối nhiều Domain Services.
  - Ví dụ: `DocumentUploadUseCase` điều phối `upload-init`/`upload-complete`: lưu metadata `AWAITING_UPLOAD`, ký presigned URL bằng `S3StorageService`, validate object ở complete, chuyển `PROCESSING`, rồi publish RabbitMQ message sau commit. `ContentExtractorService` và `SearchRefreshService` chạy trong worker profile, không nằm trên request path của API server.

### 2.2 Strategy Pattern — Content Extraction

Hệ thống hỗ trợ nhiều loại file, sử dụng **Strategy Pattern** để trích xuất nội dung:

```text
ContentExtractorService
  ├── PdfTextExtractor          (Apache PDFBox)
  ├── PdfOcrExtractor           (Tika + Tesseract OCR)
  ├── DocxExtractor             (Apache POI - XWPF)
  ├── DocExtractor              (Apache POI - HWPF)
  ├── ExcelExtractor            (Apache POI)
  └── ImageOcrExtractor         (Tesseract OCR)
```

```java
public interface ContentExtractor {
    boolean supports(String mimeType);
    ExtractionResult extract(InputStream file);
}
```

`ContentExtractorService` tự chọn đúng `ContentExtractor` dựa trên `mimeType` của file.

### 2.3 Observer Pattern — Search Refresh

Khi tài liệu được tạo/sửa/xóa, cần refresh search row/vector trong PostgreSQL. Sử dụng publish RabbitMQ sau commit cho task nặng; event nội bộ chỉ dùng để gom dữ liệu và đảm bảo publish sau khi transaction thành công:

```text
DocumentUploadCompletedEvent  → publish dms.extract
DocumentMetadataChangedEvent  → publish dms.index
DocumentDeletedEvent          → publish dms.index hoặc cleanup marker theo retention policy
```

### 2.4 Adapter Pattern — Search Engine Abstraction

Trừu tượng hóa lớp gọi PostgreSQL FTS để tách business logic khỏi chi tiết query và refresh search vector:

```java
public interface SearchEngine {
    SearchResult search(SearchQuery query);
    void refresh(DocumentSearchRow document);
    void remove(Long documentId);
    void refreshAll();
}
```

Implementation:
- `PostgresSearchEngine` — search engine mặc định, thực thi PostgreSQL FTS/trigram query bằng SQL/native query

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
Persistence (Lưu file + PostgreSQL + search row/vector)
  ↓
Response
```

### 2.7 Mapper Strategy

Sử dụng **MapStruct** cho toàn bộ chuyển đổi Entity ↔ DTO. Không dùng Manual Mapping.


### 2.8 Document Lifecycle, Batch & Storage Stats Services

```text
DocumentBatchService
  ├── batchUpload(files[], sharedMetadata)
  ├── batchDelete(documentIds[])
  └── batchMove(documentIds[], targetCategoryId)

DocumentLifecycleService
  ├── softDelete(documentId)
  ├── restore(documentIds[])
  ├── permanentDelete(documentIds[])
  └── purgeDeletedDocuments()

DocumentStorageStatsService
  └── calculate active/trash/version/total storage from PostgreSQL
```

- Batch operations dùng partial success response để lỗi từng file/tài liệu không rollback toàn bộ batch.
- `DocumentLifecycleService` là nơi duy nhất set/clear `deleted_at`, `deleted_by`, `purge_after`, `previous_status`.
- `DocumentStorageStatsService` tính dung lượng từ `documents.file_size` và `document_versions.file_size`, không phụ thuộc PostgreSQL FTS.
- Trash list lấy từ PostgreSQL vì PostgreSQL FTS mặc định không giữ document `DELETED` trong kết quả search.

---

## 3. Search Engine Architecture

### PostgreSQL-only Search Engine

Sử dụng **PostgreSQL Full-Text Search** làm search engine mặc định ngay từ đầu. PostgreSQL lưu metadata nguồn, dữ liệu quan hệ, ACL và nội dung đã trích xuất; search chạy trực tiếp bằng `tsvector`/`tsquery`, GIN index, `pg_trgm`, `unaccent` và tùy chọn `pgvector`. Hệ thống không triển khai Elasticsearch/OpenSearch trong MVP.

```text
PostgreSQL
├── documents                         metadata, lifecycle, counters
├── document_contents                  extracted_text, extraction status
├── document_search_index              denormalized search fields
│   ├── document_id                    FK/unique
│   ├── search_vector                  weighted tsvector
│   ├── title_unaccent                 normalized title
│   ├── document_code                  exact/fuzzy lookup
│   ├── tag_text                       denormalized tags
│   ├── file_type/status/access fields filter/facet columns
│   └── optional embedding vector      pgvector semantic search
└── Indexes
    ├── GIN(search_vector)
    ├── GIN(title/document_code/tag_text gin_trgm_ops)
    ├── B-tree(status, category_id, file_type, created_at)
    └── ACL indexes on owner/department/user permission tables
```

**Search features:**
- Full-text search bằng `websearch_to_tsquery` / `plainto_tsquery`.
- Ranking bằng `ts_rank_cd` với weighted `tsvector`: document code/title > tags > description > extracted content.
- Permission filter áp ngay trong SQL bằng JOIN/EXISTS với ACL, không search xong mới lọc ở frontend.
- Highlight bằng `ts_headline`, backend sanitize HTML trước khi trả frontend.
- Fuzzy/typeahead bằng `pg_trgm` (`similarity`, `%`, trigram GIN index).
- Facet theo category/department/file type/tags bằng SQL aggregation.
- Search tiếng Việt mức cơ bản bằng `unaccent`; nếu cần tách từ tốt hơn thì bổ sung dictionary/tokenizer tiếng Việt.
- Semantic search/RAG là optional bằng `pgvector`, không thuộc MVP bắt buộc.
**Consistency Strategy (PostgreSQL ↔ Object Storage):**
- **Source of truth**: PostgreSQL là nguồn chính cho metadata, ACL, lifecycle, current version, extracted text, search vector và object key được tham chiếu.
- **Object storage**: MinIO/R2 chỉ lưu binary/artifact theo UUID object key; không dùng object storage làm nguồn sự thật cho quyền hoặc lifecycle.
- **Upload ordering**: Backend tạo object key và row `AWAITING_UPLOAD`, trả presigned PUT URL; client upload binary trực tiếp lên object storage; `upload-complete` HEAD object, validate size/MIME thực tế bằng Tika, chuyển `PROCESSING` trong PostgreSQL rồi commit. Row `AWAITING_UPLOAD` quá TTL hoặc object orphan được cleanup job xử lý.
- **After-commit event**: API server publish RabbitMQ message sau khi transaction PostgreSQL commit thành công; extraction, OCR, preview conversion và refresh search vector chỉ chạy trong worker sau message đó.
- **Failure handling**: Nếu extraction hoặc refresh search vector thất bại sau DB commit, tài liệu/version chuyển `EXTRACTION_FAILED` hoặc ghi retry task tương ứng; không rollback metadata đã commit.
- **Delete/archive/restore**: Ghi PostgreSQL trước, search query tự loại theo `status`/ACL; worker refresh denormalized search row sau commit nếu metadata/ACL đổi.
- **Object cleanup**: Xóa vật lý chỉ chạy bằng cleanup job theo retention policy và chỉ xóa object không còn được PostgreSQL tham chiếu.
- **Retry**: Worker retry qua RabbitMQ TTL queues `dms.retry.30s`, `dms.retry.5m`, `dms.retry.30m`; vượt `maxAttempts = 3` thì message vào `dms.dlq` và document/version chuyển `EXTRACTION_FAILED`.
- **Batch search refresh**: Scheduled job chạy hàng đêm để publish `INDEX` messages rebuild `document_search_index` từ PostgreSQL khi cần self-heal; ShedLock đảm bảo chỉ một API instance phát batch.

---

## 4. Worker Processing Pipeline

### Extraction, Preview & Index Responsibility

Tika không phải extractor chính cho toàn bộ file. Trách nhiệm được phân định như sau:

| Thành phần | Vai trò |
|------------|---------|
| **Apache Tika** | Detect MIME type thực tế khi upload và fallback extraction khi cần |
| **Apache PDFBox** | Extractor chính cho PDF text |
| **Apache POI** | Extractor chính cho DOC/DOCX/XLS/XLSX |
| **JODConverter + LibreOffice headless** | Worker convert Word/Excel sang PDF hoặc HTML preview artifact |
| **OWASP Java HTML Sanitizer / Jsoup** | Sanitize HTML preview và search highlight trước khi trả frontend |
| **Tesseract OCR** | Worker OCR scanned PDF/image |
### RabbitMQ queues

| Queue | Task | Trigger |
|-------|------|---------|
| `dms.extract` | Extract text bằng PDFBox/POI hoặc phát hiện cần OCR | `upload-complete`, version complete, retry thủ công |
| `dms.ocr` | OCR scanned PDF/image bằng Tesseract | Worker extract phát hiện scan/image |
| `dms.preview` | Generate preview artifact PDF/HTML bằng LibreOffice/JODConverter | File Office sau upload/version complete |
| `dms.index` | Refresh `document_search_index` / search vector | Extract/OCR thành công hoặc metadata/ACL đổi |

Worker dùng manual acknowledgement, message persistent và queue durable. Mỗi task idempotent bằng cách đọc lại PostgreSQL state trước khi xử lý; search row và document content ghi bằng upsert.

Retry topology đã chốt: `maxAttempts = 3`, delay `30s -> 5m -> 30m`, vượt retry thì reject sang `dms.dlq` và alert cho admin xử lý thủ công.


```text
File Input
    ↓
[Tika MIME Detection]
    ├── PDF text      → PDFBox extract text → extracted_content
    ├── DOC/DOCX      → Apache POI extract text → extracted_content
    ├── XLS/XLSX      → Apache POI extract text → extracted_content
    ├── Word/Excel    → JODConverter + LibreOffice → PDF/HTML preview
    ├── HTML preview  → HtmlSanitizer → safe preview response
    └── Image/PDF scan → Tesseract OCR
    ↓
ExtractionResult {
    extractedText: String,
    metadata: Map<String,String>,
    pageCount: Integer,
    language: String
}
```

### OCR Pipeline

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
- PostgreSQL FTS query phải filter theo quyền truy cập trước khi trả kết quả; không search xong rồi mới loại bỏ ở frontend.
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
| `POST /documents/upload-init` + `/upload-complete` | ✅ | ❌ | ❌ |
| `PUT/DELETE /documents/{id}` | ✅ | ❌ | ❌ |
| `GET /documents/search` | ✅ | ✅ | ❌ |
| `GET /documents/search/suggestions` | ✅ | ✅ | ❌ |
| `GET /documents/{id}` | ✅ | ✅ | ❌ |
| `GET /documents/{id}/preview-url` | ✅ | ✅ | ❌ |
| `GET /documents/{id}/download-url` | ✅ | ✅ | ❌ |
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
| Search refresh batch | Hàng đêm (2:00 AM) | Rebuild `document_search_index` để self-heal lệch search vector |
| Content extraction retry | Mỗi 30 phút | Retry extraction/refresh search cho documents `EXTRACTION_FAILED` do lỗi tạm thời |
| Storage cleanup | Hàng tuần hoặc production hardening | Chỉ xóa orphan files không còn metadata/version reference; không xóa file của tài liệu soft-deleted còn khả năng restore |
| Analytics aggregation | Hàng ngày | Tổng hợp view/download/search metrics cho dashboard, tránh scan log lớn trực tiếp |
| OCR queue processor | Mỗi 5 phút | Xử lý hàng đợi OCR |

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
| `GET /admin/dashboard/summary` | Thống kê tổng quan: documents, users, categories, departments, preview/download/search totals |
| `GET /admin/dashboard/storage` | Tổng dung lượng file toàn hệ thống theo MB, tách active/trash/version |
| `GET /admin/dashboard/top-documents` | Top tài liệu xem/tải nhiều |
| `GET /admin/dashboard/recent-uploads` | Tài liệu upload gần đây |
| `GET /admin/dashboard/top-search-keywords` | Top keyword tìm kiếm, resultCount trung bình, searchTime trung bình |
| `GET /admin/dashboard/access-stats` | Thống kê preview/download theo ngày/tuần/tháng, unique users |
| `GET /admin/dashboard/system-access` | Dữ liệu truy cập hệ thống: login, active users, unique access users, preview/download/search/denied access |
| `GET /admin/dashboard/processing-errors` | Tài liệu `PROCESSING` lâu hoặc `EXTRACTION_FAILED`, gồm errorCode/errorMessage/stage lỗi |
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
│   │   │   ├── DocumentBatchService.java
│   │   │   ├── DocumentLifecycleService.java
│   │   │   ├── DocumentStorageStatsService.java
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
│   │   ├── service/                    ← SearchService, SearchRefreshService, SuggestionService
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
│   ├── application.yml                 ← presigned upload TTL + small multipart limit for non-file forms
│   ├── application-dev.yml
│   └── application-prod.yml
├── src/test/
├── pom.xml hoặc build.gradle
└── Dockerfile                          ← Backend image cần LibreOffice nếu preview Office dùng JODConverter
```

---

## 10. Scalability Tiers

| Quy mô | Mục tiêu | Giải pháp |
|--------|----------|-----------|
| **MVP / single server** | < 10k documents | PostgreSQL FTS single-node, MinIO dev object storage, Monolith, OCR (Tesseract) |
| **Production scale** | 10k–100k documents | PostgreSQL FTS cluster, Cloudflare R2 qua S3-compatible API, OCR queue, Redis Cache |
| **Enterprise scale** | > 100k documents | Multi-node PostgreSQL FTS, CDN, Async queue (RabbitMQ), Vietnamese NLP |
