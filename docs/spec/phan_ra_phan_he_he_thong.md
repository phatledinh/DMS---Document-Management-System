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

## PH1: Identity — Quản lý Người dùng & Xác thực

### Mô tả
Quản lý xác thực (authentication), phiên đăng nhập và thông tin người dùng. Identity không quyết định quyền tài liệu theo role; role chỉ phục vụ quản trị hệ thống. Quyền tài liệu được tính từ category permission dựa trên danh sách phòng ban của user.

### Entities
| Entity | Mô tả |
|--------|-------|
| `User` | Thông tin người dùng (name, email, role hệ thống, status) |
| `UserDepartment` | Membership user-phòng ban, hỗ trợ một user thuộc nhiều phòng ban |
| `RefreshToken` | Token làm mới phiên đăng nhập |

### Chức năng chính
- Đăng nhập / Đăng xuất (JWT + Refresh Token)
- Quản lý user (Admin CRUD hoặc deactivate)
- Xem / Sửa profile cá nhân
- Xem dashboard cá nhân: thông tin user, phòng ban, tài liệu đã upload, version và lịch sử thao tác của bản thân
- Gán một hoặc nhiều phòng ban cho user
- Cung cấp user identity và `departmentIds` cho category permission policy

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
Phân hệ cốt lõi — quản lý toàn bộ vòng đời tài liệu: upload → xử lý → lưu trữ → preview → download → versioning → lifecycle. Tài liệu không lưu ACL riêng; mọi quyền thao tác tài liệu được suy ra từ category hiện tại của tài liệu.

### Entities
| Entity | Mô tả |
|--------|-------|
| `Document` | Metadata tài liệu (title, slug, document_code, file info, status, counters, categoryId) |
| `DocumentContent` | Nội dung text đã trích xuất từ file (tách bảng riêng vì data lớn) |
| `DocumentVersion` | Lịch sử phiên bản file |

### Chức năng chính
- Upload tài liệu bằng presigned URL init/complete, max 50MB, yêu cầu `UPLOAD` trên category
- Validate MIME type thực tế, extension, kích thước và extension bị chặn
- Trích xuất nội dung file (Content Extraction Pipeline)
- Lưu metadata, category, tags và phiên bản tài liệu
- Cập nhật metadata tài liệu, yêu cầu `UPDATE` trên category liên quan
- Archive, soft delete, restore tài liệu, yêu cầu `DELETE` trên category
- Preview tài liệu bằng presigned GET URL, yêu cầu `VIEW`; PDF/image dùng object gốc, Word/Excel dùng preview artifact PDF/HTML đã sanitize
- Download file gốc bằng presigned GET URL, yêu cầu `DOWNLOAD`
- Quản lý phiên bản: xem lịch sử cần `VIEW`, upload version mới cần `UPLOAD`, restore version cũ cần `UPDATE`
- Retry extraction/search refresh thủ công cho tài liệu `EXTRACTION_FAILED`

### API Endpoints
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/documents/upload-init` | Khởi tạo upload tài liệu, trả presigned PUT URL |
| POST | `/documents/{id}/upload-complete` | Xác nhận upload xong, validate object và publish xử lý nền |
| GET | `/documents` | Danh sách (pagination, filters) |
| GET | `/documents/{id}` | Chi tiết tài liệu, yêu cầu `VIEW` trên category |
| PUT | `/documents/{id}` | Cập nhật metadata/category/tags, yêu cầu `UPDATE` trên category liên quan |
| DELETE | `/documents/{id}` | Xóa mềm, yêu cầu `DELETE` trên category |
| POST | `/documents/{id}/archive` | Archive tài liệu, yêu cầu `DELETE` trên category |
| POST | `/documents/{id}/restore` | Restore tài liệu đã archive/delete, yêu cầu `DELETE` trên category |
| POST | `/documents/{id}/retry-indexing` | Retry extraction/search refresh thủ công |
| GET | `/documents/{id}/preview-url` | Lấy presigned URL preview, yêu cầu `VIEW` trên category |
| GET | `/documents/{id}/download-url` | Lấy presigned URL download, yêu cầu `DOWNLOAD` trên category |
| GET | `/documents/{id}/versions` | Lịch sử phiên bản, yêu cầu `VIEW` trên category |
| POST | `/documents/{id}/versions/init` | Khởi tạo upload version mới, yêu cầu `UPLOAD` trên category |
| POST | `/documents/{id}/versions/{versionId}/complete` | Xác nhận upload version xong |
| POST | `/documents/{id}/versions/{versionId}/restore` | Chọn version cũ làm version hiện hành, yêu cầu `UPDATE` trên category |

### Sub-components

```text
Document Management
  ├── UploadInit/CompleteUseCase     — Validate metadata, kiểm tra `UPLOAD`, ký presigned URL, HEAD object, Tika validate MIME thực tế
  ├── S3StorageService              — Ký presigned PUT/GET URL, HEAD/delete object qua S3-compatible API
  ├── DocumentPermissionGuard       — Map document action sang category permission và gọi CategoryPermissionService
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

### Quy tắc quyền tài liệu theo danh mục
- Tài liệu không có ACL riêng; quyền truy cập được tính từ category hiện tại của tài liệu.
- Search, danh sách, detail và preview yêu cầu `VIEW` trên category.
- Download file hoặc version yêu cầu `DOWNLOAD` trên category.
- Upload tài liệu mới hoặc upload version yêu cầu `UPLOAD` trên category.
- Cập nhật metadata, move hoặc restore version yêu cầu `UPDATE` trên category liên quan.
- Archive, soft delete, restore và permanent delete yêu cầu `DELETE` trên category.
- Khi `documents.category_id` thay đổi, quyền hiệu lực đổi theo category mới ở request tiếp theo.

---

## PH3: Search Engine — Tìm kiếm Full-text (Core Feature)

### Mô tả
Cho phép User tìm kiếm tài liệu theo từ khóa trong tiêu đề, mô tả, mã tài liệu, tags và nội dung file đã trích xuất, đồng thời áp category permission `VIEW` trong PostgreSQL FTS query.

### Chức năng chính
- Full-text search bằng PostgreSQL FTS trên `title`, `description`, `extracted_content`, `document_code`, `tags`
- Exact match và boost cao cho `document_code`
- Boost theo thứ tự ưu tiên: document code → title → tags → description → extracted content
- Filter kết quả theo: category, department, tag, file type, uploader, date range, document status
- Status filter mặc định: chỉ trả về tài liệu `INDEXED`
- Permission-aware search: chỉ trả tài liệu mà user có `VIEW` trên category
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
  ├── PostgresSearchEngine          — Adapter thực thi full-text search
  ├── SearchRefreshService          — Refresh search row/vector khi create/update/delete/version restore
  ├── SearchPermissionService       — Build `VIEW` predicate từ user departments và category permissions
  ├── SuggestionService             — Autocomplete/suggestion có áp category permission
  └── SearchResultMapper            — Chuẩn hóa highlight, facets, score và pagination
```

---

## PH4: Master Data — Dữ liệu danh mục

### Mô tả
Quản lý dữ liệu danh mục dùng chung cho toàn hệ thống: danh mục tài liệu, phòng ban, tags và ma trận quyền phòng ban theo category.

### Entities
| Entity | Mô tả |
|--------|-------|
| `Category` | Danh mục phân loại tài liệu (hỗ trợ cây phân cấp parent-child) |
| `Department` | Phòng ban tổ chức, dùng để cấp quyền theo category |
| `CategoryDepartmentPermission` | Quyền `VIEW/DOWNLOAD/UPLOAD/UPDATE/DELETE` của một phòng ban trong một category |
| `CategoryUserPermissionOverride` | Extension point cho quyền riêng user trong phạm vi category/phòng ban nếu bật sau này |
| `Tag` | Nhãn gắn cho tài liệu (N:N qua `document_tags`) |

### Chức năng chính
- CRUD Category (hỗ trợ cây phân cấp, sắp xếp thứ tự)
- CRUD Department
- CRUD Tag (slug tự động sinh từ name)
- Quản lý ma trận quyền phòng ban theo category
- Tính effective permissions bằng union quyền từ tất cả phòng ban của user
- Chuẩn bị extension cho user-specific permission overrides
- Soft delete cho tất cả entity chính
- Cache danh mục/phòng ban/tags/permissions phổ biến nếu cần
- Refresh search row cho tài liệu bị ảnh hưởng khi metadata search/filter thay đổi

### API Endpoints
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET/POST/PUT/DELETE | `/categories`, `/categories/{id}` | Quản lý danh mục |
| GET/PUT | `/categories/{id}/permissions` | Xem/cập nhật ma trận quyền phòng ban của category |
| GET/PUT | `/categories/{id}/user-overrides` | Extension point cho quyền riêng user trong category |
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
- Dữ liệu truy cập hệ thống: login, active users, unique access users, denied access theo action/permission
- Thống kê lỗi truy cập theo category hoặc permission thiếu nếu cần phân tích phân quyền
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
| `AuditLog` | Nhật ký thao tác quản trị và audit action: upload, batch action, update metadata, move, delete, restore, permanent delete, archive, user management, permission changes, system actions |
| `AccessLog` | Nhật ký truy cập tài liệu: detail, preview, download, upload/update/delete attempt, accessGranted, denialReason |
| `SearchLog` | Nhật ký tìm kiếm: keyword, filters, resultCount, searchTime |

### Chức năng chính
- Ghi nhận upload document
- Ghi nhận update metadata với `changedFields`
- Ghi nhận delete/restore/archive/move/permanent delete document
- Ghi nhận batch upload/delete/move với total/succeeded/failed
- Ghi nhận lỗi xử lý tài liệu với errorCode/errorMessage/stage
- Ghi nhận preview và download document
- Ghi nhận search keyword, filters, resultCount, searchTime
- Ghi nhận user management actions và thay đổi user-department memberships
- Ghi nhận thay đổi category permissions
- Ghi nhận denied access theo permission thiếu: `MISSING_VIEW`, `MISSING_DOWNLOAD`, `MISSING_UPLOAD`, `MISSING_UPDATE`, `MISSING_DELETE`
- Cung cấp audit action timeline cho Admin theo actor, target type, action, category, permission và thời gian
- Cung cấp lịch sử thao tác cá nhân cho User, chỉ gồm activity của chính user và không lộ dữ liệu tài liệu ngoài quyền hiện tại
- Cung cấp API tra cứu audit log theo actor, action, document, category, permission, thời gian
- Cung cấp dữ liệu aggregate cho PH5 Dashboard & Analytics

### API Endpoints
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/admin/audit-logs` | Tra cứu audit/access/search logs với filters |
| GET | `/admin/audit-actions` | Tra cứu audit action timeline chi tiết cho Admin |
| GET | `/users/me/activity` | User xem lịch sử thao tác của chính mình |

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
│  Dept, Tag,  │        └────────┬─────────┘        └────────┬─────────┘
│  Permission) │
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
| Document → Identity | Dùng current user cho audit và lấy userId khi kiểm tra category permission |
| Document → Master Data | Document gắn với Category, Tags và gọi category permission để kiểm tra action |
| Document → Search | Document phát sinh refresh search/deactivate khi create/update/delete/version restore |
| Search → Identity | Lấy userId và departmentIds để build `VIEW` predicate |
| Search → Master Data | Dùng category permission matrix để filter kết quả search/list/suggestion/facet |
| Search → Audit Log | Search ghi keyword, filters, resultCount, searchTime |
| Document → Audit Log | Document ghi upload, metadata update, archive, delete, restore, preview, download và denied access |
| Master Data → Audit Log | Thay đổi category permissions được ghi log |
| Identity → Audit Log | User management và thay đổi user-department memberships được ghi log |
| Dashboard → Document | Aggregate thống kê từ Document data |
| Dashboard → Identity | Đếm số users |
| Dashboard → Audit Log | Tổng hợp access log và search log |
| All → Identity | Mọi module đều cần User để xác thực |

### Ghi chú coupling giữa Document, Search và Category Permission
- PH2 phát sinh indexing action khi tài liệu hoặc metadata thay đổi.
- PH3 chịu trách nhiệm build PostgreSQL search row, query và category permission filter.
- Category permission thay đổi không cần refresh search vector vì query dùng quyền hiện tại ở PH4.
- Khi triển khai có thể dùng domain event nội bộ như `DocumentUploaded`, `DocumentMetadataUpdated`, `DocumentDeleted`, `DocumentVersionRestored` để tránh coupling trực tiếp hai chiều.

---

## Mapping với Package Structure (Backend)

```text
com.dms
├── identity/                    ← PH1
│   ├── controller/
│   ├── service/
│   ├── entity/                  ← User, UserDepartment
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
│   ├── service/                 ← Category CRUD, category permission matrix
│   ├── entity/                  ← Category, Department, Tag, CategoryDepartmentPermission
│   ├── repository/
│   └── dto/
├── category/
│   └── policy/                  ← Effective category permission policy
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
