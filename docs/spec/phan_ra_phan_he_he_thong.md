# Phân Rã Phân Hệ Hệ Thống — DMS

> Mô tả cách hệ thống DMS được phân rã thành các phân hệ (module/subsystem) và quan hệ phụ thuộc giữa chúng.

---

## Tổng quan phân hệ

Hệ thống DMS được chia thành **6 phân hệ chính**:

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│                              HỆ THỐNG DMS                                    │
│                                                                              │
│  ┌──────────────┐  ┌──────────────────┐  ┌───────────────────────────────┐  │
│  │  PH1:        │  │  PH2:            │  │  PH3:                         │  │
│  │  IDENTITY    │  │  DOCUMENT MGMT   │  │  SEARCH ENGINE                │  │
│  │  (Người dùng │  │  (Quản lý tài    │  │  (Tìm kiếm full-text)        │  │
│  │  & Phân quyền│  │   liệu - Core)   │  │                               │  │
│  └──────┬───────┘  └──────┬───────────┘  └──────────┬────────────────────┘  │
│         │                 │                          │                       │
│  ┌──────┴───────┐  ┌──────┴───────────┐  ┌──────────┴────────────────────┐  │
│  │  PH4:        │  │  PH5:            │  │  PH6:                         │  │
│  │  MASTER DATA │  │  DASHBOARD &     │  │  AUDIT & ACCESS LOG           │  │
│  │  (Danh mục,  │  │  ANALYTICS       │  │  (Truy vết & thống kê hành vi)│  │
│  │  Phòng ban,  │  │  (Thống kê)      │  │                               │  │
│  │  Tags)       │  │                  │  │                               │  │
│  └──────────────┘  └──────────────────┘  └───────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## PH1: Identity — Quản lý Người dùng & Phân quyền

### Mô tả
Quản lý xác thực (authentication), phiên đăng nhập và phân quyền vai trò (RBAC) cho toàn bộ hệ thống.

### Entities
| Entity | Mô tả |
|--------|-------|
| `User` | Thông tin người dùng (name, email, role, department, status) |
| `RefreshToken` | Token làm mới phiên đăng nhập |

### Chức năng chính
- Đăng nhập / Đăng xuất (JWT + Refresh Token)
- Quản lý user (Admin CRUD hoặc deactivate)
- Xem / Sửa profile cá nhân
- Phân quyền RBAC (ADMIN, USER)
- Gán phòng ban cho user để phục vụ quyền truy cập tài liệu cấp `DEPARTMENT`

### API Endpoints
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/auth/login` | Đăng nhập |
| POST | `/auth/register` | Admin tạo tài khoản |
| POST | `/auth/refresh` | Refresh token |
| POST | `/auth/logout` | Đăng xuất |
| GET | `/users/me` | Xem profile |
| PUT | `/users/me` | Sửa profile |
| GET/POST/PUT | `/users`, `/users/{id}` | Admin quản lý user |
| DELETE hoặc POST | `/users/{id}`, `/users/{id}/deactivate` | Soft delete/deactivate user |

---

## PH2: Document Management — Quản lý Tài liệu (Core Domain)

### Mô tả
Phân hệ cốt lõi — quản lý toàn bộ vòng đời tài liệu: upload → xử lý → lưu trữ → phân quyền → preview → download → versioning → lifecycle.

### Entities
| Entity | Mô tả |
|--------|-------|
| `Document` | Metadata tài liệu (title, slug, document_code, file info, status, counters, access_level) |
| `DocumentContent` | Nội dung text đã trích xuất từ file (tách bảng riêng vì data lớn) |
| `DocumentVersion` | Lịch sử phiên bản file |
| `DocumentDepartmentAccess` | ACL theo phòng ban cho tài liệu `DEPARTMENT` |
| `DocumentUserAccess` | ACL theo user được chia sẻ trực tiếp cho tài liệu `RESTRICTED` |

### Chức năng chính
- Upload tài liệu bằng presigned URL init/complete, max 50MB
- Validate MIME type thực tế, extension, kích thước và extension bị chặn
- Trích xuất nội dung file (Content Extraction Pipeline)
- Lưu metadata, ACL và phiên bản tài liệu
- Cập nhật metadata tài liệu
- Archive, soft delete, restore tài liệu
- Preview tài liệu bằng presigned GET URL; PDF/image dùng object gốc, Word/Excel dùng preview artifact PDF/HTML đã sanitize
- Download file gốc bằng presigned GET URL
- Quản lý phiên bản (upload version mới, xem lịch sử, restore version cũ)
- Retry extraction/search refresh thủ công cho tài liệu `EXTRACTION_FAILED`

### API Endpoints
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/documents/upload-init` | Khởi tạo upload tài liệu, trả presigned PUT URL |
| POST | `/documents/{id}/upload-complete` | Xác nhận upload xong, validate object và publish xử lý nền |
| GET | `/documents` | Danh sách (pagination, filters) |
| GET | `/documents/{id}` | Chi tiết tài liệu, có kiểm tra quyền truy cập |
| PUT | `/documents/{id}` | Cập nhật metadata và ACL |
| DELETE | `/documents/{id}` | Xóa mềm |
| POST | `/documents/{id}/archive` | Archive tài liệu |
| POST | `/documents/{id}/restore` | Restore tài liệu đã archive/delete |
| POST | `/documents/{id}/retry-indexing` | Retry extraction/search refresh thủ công |
| GET | `/documents/{id}/preview-url` | Lấy presigned URL preview, có kiểm tra quyền truy cập |
| GET | `/documents/{id}/download-url` | Lấy presigned URL download, có kiểm tra quyền truy cập |
| GET | `/documents/{id}/versions` | Lịch sử phiên bản |
| POST | `/documents/{id}/versions/init` | Khởi tạo upload version mới |
| POST | `/documents/{id}/versions/{versionId}/complete` | Xác nhận upload version xong |
| POST | `/documents/{id}/versions/{versionId}/restore` | Chọn version cũ làm version hiện hành |

### Sub-components

```text
Document Management
  ├── UploadInit/CompleteUseCase     — Validate metadata, ký presigned URL, HEAD object, Tika validate MIME thực tế
  ├── S3StorageService              — Ký presigned PUT/GET URL, HEAD/delete object qua S3-compatible API
  ├── DocumentAccessPolicyService   — Dùng chung cho detail, preview, download và search filter
  ├── RabbitMQ Worker               — Consume extract/OCR/preview/index tasks
  │     ├── PdfTextExtractor        (Apache PDFBox)
  │     ├── DocxExtractor           (Apache POI - XWPF)
  │     ├── DocExtractor            (Apache POI - HWPF)
  │     ├── ExcelExtractor          (Apache POI)
  │     └── ImageOcrExtractor       (Tesseract OCR)
  ├── PreviewService                — Convert, sanitize & stream file preview
  ├── HtmlSanitizer                 — Làm sạch HTML preview để tránh XSS
  ├── VersionService                — Quản lý phiên bản
  └── DocumentLifecycleService      — Archive, soft delete, restore, retry processing
```

### Quy tắc phân quyền tài liệu
- `PUBLIC`: mọi user đã đăng nhập có quyền xem.
- `DEPARTMENT`: user thuộc một trong các phòng ban được gán hoặc Admin có quyền xem.
- `RESTRICTED`: owner, Admin hoặc user được chia sẻ trực tiếp có quyền xem.
- Search, metadata detail, preview và download phải dùng cùng logic trong `DocumentAccessPolicyService`.
- User không có quyền không được nhìn thấy title, snippet, metadata hoặc download URL.

---

## PH3: Search Engine — Tìm kiếm Full-text (Core Feature)

### Mô tả
Cho phép User tìm kiếm tài liệu theo từ khóa trong tiêu đề, mô tả, mã tài liệu, tags và nội dung file đã trích xuất, đồng thời áp dụng filter quyền truy cập ngay trong PostgreSQL FTS query.

### Chức năng chính
- Full-text search bằng PostgreSQL FTS trên `title`, `description`, `extracted_content`, `document_code`, `tags`
- Exact match và boost cao cho `document_code`
- Boost theo thứ tự ưu tiên: document code → title → tags → description → extracted content
- Filter kết quả theo: category, department, tag, file type, owner/uploader, date range, document status, access level
- Status filter mặc định: chỉ trả về tài liệu `INDEXED`
- Permission-aware search: filter quyền trước khi trả kết quả
- Sắp xếp: relevance, createdAt, updatedAt, viewCount, downloadCount, title
- Highlight matched text trong title, description và extracted_content
- Fuzzy search, synonym, faceted aggregations và Vietnamese analyzer
- Autocomplete/suggestion cho title, document code và tags
- Ghi nhận search keyword, filters, resultCount và searchTime qua PH6

### Search Engine mặc định

| Công nghệ | Vai trò | Mô tả |
|-----------|---------|-------|
| PostgreSQL FTS | Full-text search engine | Multi-match query, exact/boosted document_code, fuzzy search, synonym, faceted filters, highlight, relevance scoring |

### API Endpoints
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/documents/search` | Tìm kiếm full-text với filters |
| GET | `/documents/search/suggestions` | Autocomplete/suggestion cho title, document code, tags |

### Sub-components

```text
Search Engine
  ├── SearchService                 — Xây dựng & thực thi PostgreSQL FTS query
  ├── PostgresSearchEngine     — Adapter thực thi full-text search
  ├── SearchRefreshService          — Refresh search row/vector khi create/update/delete/version restore
  ├── SearchPermissionService       — Build filter quyền từ DocumentAccessPolicyService
  ├── SuggestionService             — Autocomplete/suggestion
  └── SearchResultMapper            — Chuẩn hóa highlight, facets, score và pagination
```

---

## PH4: Master Data — Dữ liệu danh mục

### Mô tả
Quản lý dữ liệu danh mục dùng chung cho toàn hệ thống: danh mục tài liệu, phòng ban, tags.

### Entities
| Entity | Mô tả |
|--------|-------|
| `Category` | Danh mục phân loại tài liệu (hỗ trợ cây phân cấp parent-child) |
| `Department` | Phòng ban sở hữu hoặc được cấp quyền xem tài liệu |
| `Tag` | Nhãn gắn cho tài liệu (N:N qua `document_tags`) |

### Chức năng chính
- CRUD Category (hỗ trợ cây phân cấp, sắp xếp thứ tự)
- CRUD Department
- CRUD Tag (slug tự động sinh từ name)
- Soft delete cho tất cả entity
- Cache danh mục/phòng ban/tags phổ biến
- Refresh search row cho tài liệu bị ảnh hưởng khi metadata search/filter thay đổi

### API Endpoints
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET/POST/PUT/DELETE | `/categories`, `/categories/{id}` | Quản lý danh mục |
| GET/POST/PUT/DELETE | `/departments`, `/departments/{id}` | Quản lý phòng ban |
| GET/POST/PUT/DELETE | `/tags`, `/tags/{id}` | Quản lý tags |

---

## PH5: Dashboard & Analytics — Thống kê

### Mô tả
Dashboard thống kê tổng quan cho Admin dựa trên dữ liệu tài liệu, dung lượng lưu trữ, dữ liệu truy cập hệ thống, lỗi xử lý, user, master data, access log và search log.

### Chức năng chính
- Tổng số tài liệu, users, categories, departments
- Phân bổ tài liệu theo trạng thái (INDEXED, PROCESSING, EXTRACTION_FAILED, ARCHIVED, DELETED)
- Phân bổ tài liệu theo category, department và loại file
- Tổng lượt xem và lượt tải
- Tổng dung lượng file toàn hệ thống theo MB, tách active/trash/version
- Dữ liệu truy cập hệ thống: login, active users, unique access users, denied access
- Tài liệu lỗi xử lý kèm lý do lỗi (`errorCode`, `errorMessage`, stage lỗi)
- Top tài liệu xem nhiều nhất
- Top tài liệu tải nhiều nhất
- Tài liệu upload gần đây
- Top keyword tìm kiếm
- Thống kê searchTime/resultCount theo search log
- Bộ lọc thời gian cho dashboard

### API Endpoints
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/admin/dashboard/summary` | Thống kê tổng quan Admin |
| GET | `/admin/dashboard/storage` | Tổng dung lượng file toàn hệ thống theo MB |
| GET | `/admin/dashboard/system-access` | Dữ liệu truy cập hệ thống |
| GET | `/admin/dashboard/processing-errors` | Tài liệu lỗi xử lý kèm lý do lỗi |

---

## PH6: Audit & Access Log — Truy vết & Nhật ký truy cập

### Mô tả
Ghi nhận các hành động quan trọng để phục vụ truy vết, kiểm toán nội bộ, dashboard và phân tích hành vi sử dụng hệ thống.

### Entities
| Entity | Mô tả |
|--------|-------|
| `AuditLog` | Nhật ký thao tác quản trị: upload, batch action, update metadata, move, delete, restore, permanent delete, archive, user management |
| `AccessLog` | Nhật ký truy cập tài liệu: metadata detail, preview, download |
| `SearchLog` | Nhật ký tìm kiếm: keyword, filters, resultCount, searchTime |

### Chức năng chính
- Ghi nhận upload document
- Ghi nhận update metadata với `changedFields`
- Ghi nhận delete/restore/archive/move/permanent delete document
- Ghi nhận batch upload/delete/move với total/succeeded/failed
- Ghi nhận lỗi xử lý tài liệu với errorCode/errorMessage/stage
- Ghi nhận preview và download document
- Ghi nhận search keyword, filters, resultCount, searchTime
- Ghi nhận user management actions
- Cung cấp API tra cứu audit log theo actor, action, document, thời gian
- Cung cấp dữ liệu aggregate cho PH5 Dashboard & Analytics

### API Endpoints
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/admin/audit-logs` | Tra cứu audit/access/search logs với filters |

### Sub-components

```text
Audit & Access Log
  ├── AuditLogService              — Ghi và truy vấn thao tác quản trị
  ├── AccessLogService             — Ghi preview/download/detail access
  ├── SearchLogService             — Ghi search keyword và search metrics
  └── AuditLogQueryService         — Filter, pagination và export dữ liệu truy vết
```

---

## Dependency Graph — Quan hệ phụ thuộc

```text
                         ┌──────────────┐
                         │  PH1:        │
                         │  IDENTITY    │
                         └──────┬───────┘
                                │ User, role, department
                                ▼
┌──────────────┐        ┌──────────────────┐        ┌──────────────────┐
│  PH4:        │ ─────→ │  PH2:            │ ─────→ │  PH3:            │
│  MASTER DATA │        │  DOCUMENT MGMT   │        │  SEARCH ENGINE   │
│ (Category,   │        │  (Core Domain)   │ ←───── │  (Index & Query) │
│  Dept, Tag)  │        └────────┬─────────┘        └────────┬─────────┘
└──────────────┘                 │                            │
                                 ▼                            ▼
                          ┌──────────────────┐        ┌──────────────────┐
                          │  PH6:            │ ─────→ │  PH5:            │
                          │  AUDIT & LOG     │        │  DASHBOARD       │
                          └──────────────────┘        │  (Aggregation)   │
                                                       └──────────────────┘
```

### Quy tắc phụ thuộc

| Từ | Đến | Quan hệ |
|----|-----|---------|
| Document → Identity | Document thuộc về User (owner/uploader), dùng department/role để kiểm tra quyền |
| Document → Master Data | Document gắn với Category, Department, Tags |
| Document → Search | Document phát sinh refresh search/deactivate khi create/update/delete/version restore |
| Search → Document | Search dùng metadata, status và ACL của Document để build query/filter |
| Search → Audit Log | Search ghi keyword, filters, resultCount, searchTime |
| Document → Audit Log | Document ghi upload, metadata update, archive, delete, restore, preview, download |
| Identity → Audit Log | User management actions được ghi log |
| Dashboard → Document | Aggregate thống kê từ Document data |
| Dashboard → Identity | Đếm số users |
| Dashboard → Audit Log | Tổng hợp access log và search log |
| All → Identity | Mọi module đều cần User để xác thực |

### Ghi chú coupling giữa Document và Search
- PH2 phát sinh indexing action khi tài liệu hoặc metadata thay đổi.
- PH3 chịu trách nhiệm build PostgreSQL search row, query và permission filter.
- Khi triển khai có thể dùng domain event nội bộ như `DocumentUploaded`, `DocumentMetadataUpdated`, `DocumentDeleted`, `DocumentVersionRestored` để tránh coupling trực tiếp hai chiều.

---

## Mapping với Package Structure (Backend)

```text
com.dms
├── identity/                    ← PH1
│   ├── controller/
│   ├── service/
│   ├── entity/
│   ├── repository/
│   └── dto/
├── document/                    ← PH2
│   ├── controller/
│   ├── service/
│   ├── entity/
│   ├── repository/
│   └── dto/
├── search/                      ← PH3
│   ├── controller/
│   ├── service/
│   └── dto/
├── masterdata/                  ← PH4
│   ├── controller/
│   ├── service/
│   ├── entity/
│   ├── repository/
│   └── dto/
├── dashboard/                   ← PH5
│   ├── controller/
│   ├── service/
│   └── dto/
├── audit/                       ← PH6
│   ├── controller/
│   ├── service/
│   ├── entity/
│   ├── repository/
│   └── dto/
└── common/                      ← Shared utilities
    ├── config/
    ├── exception/
    ├── security/
    └── dto/
```
