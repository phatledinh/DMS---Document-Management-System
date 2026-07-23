# Architecture — Hệ Thống Quản Lý Tài Liệu Nội Bộ (DMS)

> System design overview cho hệ thống Quản lý & Tìm kiếm Tài liệu Doanh nghiệp.
> MySQL lưu metadata/ACL/log; Elasticsearch là search engine mặc định ngay từ Phase 1.

---

## 1. Tổng Quan Hệ Thống

DMS cho phép **Admin** upload, phân loại, phân quyền và quản lý lifecycle tài liệu nội bộ. **User** có thể tìm kiếm, xem chi tiết, preview và download các tài liệu được cấp quyền. Chức năng cốt lõi là **Elasticsearch-first full-text search** trên metadata và nội dung file đã trích xuất, có permission filter trước khi trả kết quả.

### Phạm vi Phase 1

| Nhóm | Nội dung |
|------|----------|
| Document management | Upload một file/request, metadata, tags, ACL, versioning, archive, soft delete, restore |
| Search | Elasticsearch full-text search, fuzzy, facets, highlight, suggestions, permission-aware filter |
| Preview | PDF stream trực tiếp; Word/Excel convert sang PDF/HTML đã sanitize; image stream trực tiếp |
| Auth | JWT access token + Refresh Token HttpOnly Cookie, RBAC ADMIN/USER |
| Logs & dashboard | Audit log, access log, search log, dashboard analytics |
| Storage | Local disk trong Phase 1; S3/MinIO ở Phase 2 |

### Loại tài liệu hỗ trợ

| Loại | Định dạng | Trích xuất nội dung | Preview | Ghi chú |
|------|-----------|:---:|:---:|---------|
| PDF text | `.pdf` | Có | Có | Apache PDFBox, browser render trực tiếp |
| PDF scanned | `.pdf` | Phase 2 | Có | OCR bằng Tesseract ở Phase 2 |
| Word | `.doc`, `.docx` | Có | Có | Apache POI extract text, LibreOffice/JODConverter preview |
| Excel | `.xls`, `.xlsx` | Có | Có | Apache POI extract text, HTML table hoặc PDF preview |
| Image | `.jpg`, `.png`, `.tiff` | Phase 2 | Có | Preview trực tiếp, OCR ở Phase 2 |

---

## 2. High-Level Architecture

```text
                         ┌──────────────────────┐
                         │   Client (SPA/Web)    │
                         │ React + Vite + AntD   │
                         └──────────┬────────────┘
                                    │ HTTPS / JSON
                                    ▼
                         ┌──────────────────────┐
                         │   Spring Boot App     │
                         │ REST API + Security   │
                         └──────────┬────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        ▼                           ▼                           ▼
┌─────────────────┐       ┌──────────────────┐        ┌─────────────────┐
│ Application     │       │ Domain Services  │        │ Infrastructure  │
│ Use Cases       │──────▶│ Business Rules   │───────▶│ Adapters        │
└─────────────────┘       └──────────────────┘        └────────┬────────┘
                                                                │
              ┌────────────────────┬────────────────────────────┼───────────────┐
              ▼                    ▼                            ▼               ▼
        ┌──────────┐       ┌────────────────┐          ┌──────────────┐  ┌──────────┐
        │ MySQL 8  │       │ Elasticsearch  │          │ File Storage │  │ Redis    │
        │ Meta/ACL │       │ Full-text      │          │ Local/S3     │  │ Cache    │
        │ Logs     │       │ Search Index   │          │             │  │          │
        └──────────┘       └────────────────┘          └──────────────┘  └──────────┘
```

### Runtime topology Phase 1

```text
┌──────────────────────────────────────────────────────────────┐
│                    Single Server / VPS                       │
│                                                              │
│  ┌─────────────────────┐  ┌──────────────────────────────┐  │
│  │ Frontend Container  │  │ Backend Container            │  │
│  │ Nginx + React       │  │ Spring Boot + LibreOffice    │  │
│  └─────────────────────┘  └──────────────────────────────┘  │
│                                                              │
│  ┌─────────────────────┐  ┌──────────────────────────────┐  │
│  │ MySQL Container     │  │ Redis Container              │  │
│  └─────────────────────┘  └──────────────────────────────┘  │
│                                                              │
│  ┌─────────────────────┐  ┌──────────────────────────────┐  │
│  │ Elasticsearch       │  │ File Storage (Local Disk)    │  │
│  │ Single-node         │  │ /storage/documents/...       │  │
│  └─────────────────────┘  └──────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

Phase 1 không dùng MySQL Full-text Search làm fallback; nếu Elasticsearch không sẵn sàng thì search/suggestions phải báo lỗi hệ thống thay vì trả kết quả thiếu chính xác.

---

## 3. Phân Hệ Chính

Hệ thống được chia thành 6 phân hệ:

| Phân hệ | Vai trò | Thành phần chính |
|---------|---------|------------------|
| PH1 Identity | Xác thực, phiên đăng nhập, user, RBAC | `AuthService`, `UserService`, `JwtProvider`, `RefreshTokenService` |
| PH2 Document Management | Core domain quản lý tài liệu, file, ACL, lifecycle, versioning | `DocumentService`, `DocumentAccessPolicyService`, `StorageService`, `VersionService` |
| PH3 Search Engine | Full-text search, permission-aware query, suggestions, re-index | `SearchService`, `ElasticsearchSearchEngine`, `SearchIndexService`, `SearchPermissionService` |
| PH4 Master Data | Category tree, departments, tags | `CategoryService`, `DepartmentService`, `TagService` |
| PH5 Dashboard & Analytics | Tổng hợp thống kê quản trị | `DashboardService`, analytics queries |
| PH6 Audit & Access Log | Audit hành động, log truy cập, log search | `AuditLogService`, `AccessLogService`, `SearchLogService` |

### Dependency Flow

```text
Frontend → REST Controllers → Application Use Cases → Domain Services → Repositories/Adapters

Document Management → Identity          (owner/uploader/current user)
Document Management → Master Data       (category/department/tags)
Document Management → Search Engine     (index/re-index/delete status)
Search Engine       → Document Access   (permission filter)
Dashboard           → Documents/Users/Logs/Search metadata
Audit & Access Log  → Identity/Documents
```

---

## 4. Backend Layering

### Clean Architecture Style

```text
controllers/
  └── REST boundary, request/response DTO, auth annotations
application/
  └── Use cases phối hợp nhiều service: upload, search, restore version
service/
  └── Domain rules: document lifecycle, ACL, metadata, master data
repository/
  └── Spring Data JPA repositories cho MySQL
infrastructure/
  ├── storage/          Local/S3 adapter
  ├── search/           Elasticsearch adapter
  ├── extraction/       PDFBox/POI/Tika fallback/OCR
  ├── preview/          LibreOffice/JODConverter, sanitizer
  └── security/         JWT filter/provider
```

### Design Patterns

| Pattern | Áp dụng |
|---------|---------|
| Clean Architecture | Controller → Use Case → Domain Service → Adapter/Repository |
| Strategy | `ContentExtractor` theo MIME type |
| Adapter | `SearchEngine`, `StorageService`, preview converter |
| Observer/Event | Đồng bộ Elasticsearch sau khi MySQL commit |
| Policy Service | `DocumentAccessPolicyService` dùng chung cho detail/search/preview/download |
| Mapper | MapStruct cho Entity ↔ DTO |

### Transaction Boundaries

- Write operations như upload, update metadata/ACL, archive, restore, delete dùng `@Transactional` cho thay đổi MySQL.
- Indexing/re-indexing chạy sau khi transaction MySQL commit thành công.
- Search là read-path qua Elasticsearch, sau đó chỉ lookup metadata cần thiết và ghi `search_logs`.
- Preview/download phải kiểm tra quyền trước khi stream file và ghi `access_logs` sau quyết định truy cập.

---

## 5. Luồng Nghiệp Vụ Chính

### 5.1 Upload & xử lý tài liệu

```text
Admin submit multipart/form-data
      ↓
DTO validation
  • file required, max 50MB
  • metadata required
  • accessLevel hợp lệ
      ↓
FileUploadHandler
  • validate extension
  • detect MIME thực tế bằng Apache Tika
  • chặn extension nguy hiểm
      ↓
StorageService
  • tạo UUID/generated storage key
  • lưu file gốc vào /storage/documents/YYYY/MM/...
      ↓
DocumentUploadUseCase @Transactional
  • lưu documents status = PROCESSING
  • lưu document_versions version 1.0
  • lưu document_tags
  • lưu document_department_accesses hoặc document_user_accesses nếu cần
  • ghi audit_logs
      ↓ after commit
ContentExtractorService async
  • PDF text → PDFBox
  • DOC/DOCX → Apache POI
  • XLS/XLSX → Apache POI
  • Image/PDF scan Phase 1 → có thể INDEXED với content rỗng nếu metadata index thành công
      ↓
document_contents + SearchIndexService
  • lưu extracted_text/status/retry_count
  • index metadata + content + ACL vào Elasticsearch
      ↓
Document status = INDEXED hoặc EXTRACTION_FAILED
```

Response upload trả `documentId` và status ban đầu `PROCESSING`; xử lý nội dung/index chạy nền.

### 5.2 Permission-aware search

```text
User search q + filters
      ↓
SearchController
      ↓
SearchService
  • build multi-match query trên title, description, content, document_code, tags
  • build filters: category, department, tag, file type, owner/uploader, date range, status, access level
      ↓
SearchPermissionService
  • PUBLIC
  • owner_id = current user
  • DEPARTMENT + current user's department in department_ids
  • RESTRICTED + current user in allowed_user_ids
  • ADMIN bypass
      ↓
ElasticsearchSearchEngine
  • execute query với status mặc định INDEXED
  • facets, highlight, relevance score, suggestions
      ↓
SearchLogService
  • ghi keyword, filters, result_count, latency_ms
      ↓
Response ApiResponse<SearchResultPage>
```

Frontend không được lọc quyền thay backend; user không có quyền không được thấy title, snippet, metadata hoặc download URL.

### 5.3 Detail, preview và download

```text
GET /documents/{id}
GET /documents/{id}/preview
GET /documents/{id}/download
GET /documents/{id}/versions/{versionId}/download
      ↓
DocumentAccessPolicyService
  • kiểm tra role, owner, access_level, department ACL, direct-share ACL
  • chặn DELETED và status không hợp lệ với User
      ↓
Nếu denied
  • ghi access_logs access_granted=false
  • trả 403/404 theo policy không lộ metadata
      ↓
Nếu allowed
  • detail: trả metadata + URL hợp lệ
  • preview: stream PDF/image hoặc convert Office sang PDF/HTML sanitize
  • download: stream file gốc với Content-Disposition
  • tăng view_count/download_count khi preview/download thành công
  • ghi access_logs access_granted=true
```

### 5.4 Lifecycle và versioning

```text
PROCESSING -> INDEXED
PROCESSING -> EXTRACTION_FAILED
EXTRACTION_FAILED -> PROCESSING     (retry)
INDEXED -> ARCHIVED                 (admin archive)
ARCHIVED -> INDEXED                 (restore)
INDEXED/ARCHIVED/EXTRACTION_FAILED -> DELETED
DELETED -> PROCESSING/INDEXED/ARCHIVED
```

- Upload version mới không ghi đè version cũ.
- Current version được phản ánh qua `documents.version_number`.
- Restore version cũ tạo trạng thái current mới, trích xuất lại content và re-index Elasticsearch.
- Archive/delete cập nhật status trong MySQL và Elasticsearch để loại khỏi search mặc định.

---

## 6. Search Engine Architecture

### Elasticsearch document shape

```text
Index: documents_v1

metadata:
  document_id, title, description, document_code
  category_id, category_name
  department_id, document_type, tags
  owner_id, uploaded_by
  status, access_level
  created_at, updated_at, effective_date, expiry_date
  view_count, download_count

content:
  content (extracted text)

permission fields:
  department_ids[]
  allowed_user_ids[]
```

### Query responsibilities

| Capability | Cách xử lý |
|------------|------------|
| Full-text | Multi-match trên `title`, `description`, `content`, `document_code`, `tags` |
| Relevance | Boost `title^4`, `document_code^3`, `tags^2`, `description^1.5`, `content^1` |
| Permission | Filter quyền trong Elasticsearch query trước khi trả kết quả |
| Status | User mặc định chỉ search `INDEXED`; Admin có thể filter status |
| Facets | Category, department, document type, tags, created date range |
| Highlight | Native highlight cho title/description/content, backend sanitize trước khi trả FE |
| Suggestions | Completion suggester hoặc prefix query trên title/document_code/tags, có thể cache Redis |

### Sync strategy

- Upload/update/version restore: lưu MySQL trước, sau commit mới extract/index.
- Metadata/tags/category/ACL/status thay đổi: re-index document liên quan.
- Archive/delete: cập nhật status trong index, không hard delete ngay để phục vụ audit/debug nội bộ.
- Retry extraction/indexing: scheduled mỗi 30 phút và endpoint admin `POST /documents/{id}/retry-indexing`.
- Batch re-index hằng đêm để self-heal lệch MySQL ↔ Elasticsearch.

---

## 7. Content Extraction & Preview

### Extraction responsibility

Tika không phải extractor chính cho toàn bộ file trong Phase 1; Tika dùng để detect MIME thực tế và fallback khi cần.

| File | Extractor chính | Preview |
|------|-----------------|---------|
| PDF text | Apache PDFBox | Stream PDF trực tiếp |
| DOCX | Apache POI XWPF | LibreOffice/JODConverter → PDF/HTML |
| DOC | Apache POI HWPF | LibreOffice/JODConverter → PDF/HTML |
| XLS/XLSX | Apache POI | HTML table sanitize hoặc LibreOffice/JODConverter |
| Image | OCR Phase 2 | Stream trực tiếp |
| PDF scan | OCR Phase 2 | Stream PDF trực tiếp |

### Pipeline

```text
Stored file
  ↓
ContentExtractorService
  ├── select extractor by validated MIME type
  ├── extract text/page count/language if supported
  └── return SUCCESS / PARTIAL / FAILED
  ↓
document_contents
  • extracted_text
  • extraction_method
  • extraction_status
  • error_message
  • retry_count
  • extracted_at
  ↓
SearchIndexService
```

HTML preview và search highlight phải sanitize bằng OWASP Java HTML Sanitizer/Jsoup ở backend; frontend vẫn có thể dùng DOMPurify như lớp bảo vệ bổ sung khi render HTML.

---

## 8. Data Architecture

### MySQL responsibilities

MySQL là source of truth cho:

- Users, refresh tokens, RBAC và department của user.
- Document metadata, lifecycle status, counters, owner/uploader.
- Category, department, tags.
- ACL theo department/user.
- Document versions và extracted content.
- Audit logs, access logs, search logs.

### Core relational model

```text
[departments] 1──N [users]
[users] 1──N [documents] (uploaded_by, owner_id)
[categories] 1──N [documents]
[documents] 1──N [document_versions]
[documents] 1──1 [document_contents]
[documents] N──N [tags]
[documents] N──N [departments] via document_department_accesses
[documents] N──N [users] via document_user_accesses
[users] 1──N [audit_logs/access_logs/search_logs]
```

MySQL chỉ dùng B-Tree indexes cho lookup metadata, filter, join, ACL và đồng bộ index. Full-text search thực thi bởi Elasticsearch.

---

## 9. Security & Authorization

### Authentication

```text
POST /auth/login
  ↓
Verify email/password bằng BCrypt
  ↓
Issue Access Token JWT 15 phút
Set Refresh Token HttpOnly Cookie 7 ngày
  ↓
Frontend Axios interceptor tự gọi /auth/refresh khi nhận 401
```

### RBAC endpoint matrix

| Endpoint pattern | ADMIN | USER | Public |
|------------------|:---:|:---:|:---:|
| `POST /auth/login`, `POST /auth/refresh` | Có | Có | Có |
| `POST /auth/logout` | Có | Có | Không |
| `GET/PUT /users/me` | Có | Có | Không |
| `GET/POST/PUT/DELETE /users` | Có | Không | Không |
| `POST /documents` | Có | Không | Không |
| `PUT/DELETE /documents/{id}` | Có | Không | Không |
| `POST /documents/{id}/archive|restore|retry-indexing` | Có | Không | Không |
| `GET /documents`, `/documents/search` | Có | Có | Không |
| `GET /documents/{id}/preview|download` | Có | Có | Không |
| Master data read | Có | Có | Không |
| Master data write | Có | Không | Không |
| `GET /admin/dashboard/*`, `GET /admin/audit-logs` | Có | Không | Không |

### Document-level authorization

RBAC chỉ quyết định quyền gọi endpoint; quyền xem từng tài liệu do `DocumentAccessPolicyService` quyết định theo `access_level`, owner, department ACL, direct user ACL và status tài liệu.

### Upload and preview safety

- Validate MIME thực tế và extension, không tin filename/header từ client.
- Không dùng tên file gốc làm storage path.
- Chặn extension nguy hiểm.
- HTML preview và highlight phải sanitize trước khi trả response.
- Production hardening có thể thêm virus/malware scan ở Phase 2.

---

## 10. Logging, Audit & Analytics

| Action | Log table |
|--------|-----------|
| Login/logout | `audit_logs` |
| Create/update/delete/archive/restore document | `audit_logs` |
| Update ACL/tags/category/metadata | `audit_logs` |
| Upload/restore version | `audit_logs` |
| Preview/download/version download | `access_logs` |
| Denied preview/download/detail due to ACL | `access_logs` |
| Search/suggestions | `search_logs` |
| Retry extraction/indexing | `audit_logs` |

Dashboard đọc từ `documents`, `users`, `audit_logs`, `access_logs`, `search_logs`, `document_contents` và Elasticsearch sync metadata. Khi dữ liệu log lớn, các endpoint dashboard nên dùng query tối ưu hoặc bảng tổng hợp thay vì scan log thô.

---

## 11. Background Jobs

Sử dụng Spring `@Scheduled`; nếu multi-instance ở Phase 2 thì dùng ShedLock để tránh chạy trùng.

| Job | Tần suất | Mô tả |
|-----|----------|-------|
| Content extraction/index retry | Mỗi 30 phút | Retry tài liệu `EXTRACTION_FAILED` do lỗi tạm thời |
| Batch re-index | Hằng đêm | Self-heal lệch MySQL ↔ Elasticsearch |
| Storage cleanup | Hằng tuần | Dọn file mồ côi theo policy an toàn |
| Analytics aggregation | Hằng ngày hoặc theo nhu cầu | Tổng hợp metrics cho dashboard nếu log tăng lớn |
| OCR queue processor | Phase 2 | OCR PDF scan/image bằng Tesseract |

---

## 12. Caching Strategy

Redis cache dùng cho dữ liệu đọc nhiều và suggestion, không phải source of truth.

| Cache key pattern | TTL gợi ý | Mô tả |
|-------------------|-----------|-------|
| `categories:tree` | 1 giờ | Cây danh mục active |
| `departments:all` | 1 giờ | Danh sách phòng ban active |
| `tags:popular` | 30 phút | Tags phổ biến |
| `search:suggest:{prefix}:{userContext}` | 10 phút | Suggestions đã tôn trọng quyền người dùng |

Không cache kết quả search tổng quát nếu chưa đưa user context/ACL vào cache key. Mọi thay đổi category, tag, department, ACL hoặc document metadata phải evict/re-index dữ liệu liên quan.

---

## 13. Deployment & Scalability Roadmap

| Phase | Mục tiêu | Kiến trúc |
|-------|----------|-----------|
| Phase 1 | MVP, < 10k documents | Monolith Spring Boot, React/Nginx, MySQL, Redis, Elasticsearch single-node, Local Storage |
| Phase 2 | Production scale, 10k–100k documents | Backend xN, Elasticsearch cluster, Redis cluster, S3/MinIO, OCR, ShedLock |
| Phase 3 | Enterprise, > 100k documents | Multi-node Elasticsearch, CDN preview, async queue, advanced Vietnamese NLP, stronger malware scanning |

### Production rules

- Không expose MySQL, Redis hoặc Elasticsearch ra public network.
- Backend container cần LibreOffice headless để preview Office.
- MySQL dùng `utf8mb4_unicode_ci` và timezone `Asia/Ho_Chi_Minh`.
- `ddl-auto=validate`; schema quản lý bằng Flyway.
- Secrets như JWT secret, database password phải đến từ environment/secret manager, không commit vào repo.

---

## 14. Tài Liệu Liên Quan

| Tài liệu | Đường dẫn |
|----------|-----------|
| Thiết kế chi tiết | [design.md](./design.md) |
| Database schema | [DATABASE.md](./DATABASE.md) |
| API spec | [API_SPEC.md](./API_SPEC.md) |
| System Architecture chi tiết | [sa/sa.md](./sa/sa.md) |
| Tech Stack | [sa/techstack.md](./sa/techstack.md) |
| Server & Deployment | [sa/server.md](./sa/server.md) |
| Đặc tả yêu cầu | [spec/specs.md](./spec/specs.md) |
| Phân rã phân hệ | [spec/phan_ra_phan_he_he_thong.md](./spec/phan_ra_phan_he_he_thong.md) |
