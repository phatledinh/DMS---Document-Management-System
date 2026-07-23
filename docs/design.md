# Thiết Kế Chi Tiết — DMS

> Tài liệu thiết kế chi tiết hệ thống: API conventions, database schema, phân quyền tài liệu, Elasticsearch design, lifecycle, logging và danh sách endpoint.

---

## 1. API Conventions

### Base URL & Versioning

```text
Development: http://localhost:8080/api/v1
Production:  https://api.qlktl.example.com/api/v1
```

*Rule: Không thay đổi breaking changes trong `v1`. Mọi thay đổi lớn phải tạo `v2`.*

### HTTP Status Codes

| Code | Meaning | Usage |
|------|---------|-------|
| `200` | OK | Successful GET, PUT |
| `201` | Created | Successful POST (upload document, create category...) |
| `204` | No Content | Successful DELETE |
| `400` | Bad Request | Validation errors, file type không hợp lệ |
| `401` | Unauthorized | Missing hoặc invalid JWT |
| `403` | Forbidden | JWT valid nhưng không đủ quyền |
| `404` | Not Found | Resource không tồn tại |
| `409` | Conflict | Duplicate data (email, document_code, slug...) |
| `413` | Payload Too Large | File upload vượt quá 50MB |
| `415` | Unsupported Media Type | File type không được hỗ trợ |
| `500` | Server Error | Internal exceptions |

### Response Wrapper (`ApiResponse<T>`)

Tất cả endpoint PHẢI trả data trong format thống nhất.

**Success Response:**
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { }
}
```

**Pagination Response:**
```json
{
  "success": true,
  "data": {
    "content": [ { } ],
    "page": 1,
    "size": 20,
    "totalElements": 200,
    "totalPages": 10
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "code": "DOCUMENT_NOT_FOUND",
  "message": "Document with id 123 not found",
  "data": null
}
```

### Error Codes

| Code | Mô tả |
|------|--------|
| `USER_NOT_FOUND` | User không tồn tại |
| `EMAIL_ALREADY_EXISTS` | Email đã được đăng ký |
| `DOCUMENT_NOT_FOUND` | Tài liệu không tồn tại |
| `DOCUMENT_CODE_DUPLICATE` | Mã tài liệu đã tồn tại |
| `CATEGORY_NOT_FOUND` | Danh mục không tồn tại |
| `DEPARTMENT_NOT_FOUND` | Phòng ban không tồn tại |
| `TAG_NOT_FOUND` | Tag không tồn tại |
| `FILE_TYPE_NOT_SUPPORTED` | Loại file không được hỗ trợ |
| `FILE_SIZE_EXCEEDED` | File vượt quá giới hạn 50MB |
| `DANGEROUS_FILE_TYPE` | File thuộc nhóm extension bị chặn |
| `MIME_TYPE_MISMATCH` | Extension và MIME thực tế không khớp |
| `EXTRACTION_FAILED` | Trích xuất nội dung file thất bại |
| `INDEXING_FAILED` | Đồng bộ Elasticsearch thất bại |
| `INVALID_CREDENTIALS` | Email hoặc mật khẩu sai |
| `TOKEN_EXPIRED` | JWT đã hết hạn |
| `ACCESS_DENIED` | Không có quyền truy cập |

### Supported File Types & Upload Validation

| MIME Type | Extension | Trích xuất |
|-----------|-----------|:---:|
| `application/pdf` | `.pdf` | PDFBox |
| `application/msword` | `.doc` | POI (HWPF) |
| `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | `.docx` | POI (XWPF) |
| `application/vnd.ms-excel` | `.xls` | POI |
| `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | `.xlsx` | POI |
| `image/jpeg` | `.jpg`, `.jpeg` | OCR (Phase 2) |
| `image/png` | `.png` | OCR (Phase 2) |
| `image/tiff` | `.tiff` | OCR (Phase 2) |

Upload validation rules:

- File size tối đa: `50MB`.
- Validate cả extension và MIME thực tế bằng Apache Tika; không chỉ tin vào filename hoặc header từ client.
- Chặn các extension nguy hiểm: `.exe`, `.sh`, `.bat`, `.cmd`, `.js`, `.html`, `.htm`, `.jar`, `.msi`, `.ps1`, `.vbs`.
- `storage_path` phải dùng UUID hoặc generated key, không dùng trực tiếp tên file gốc.
- `file_name` là tên gốc đã sanitize để hiển thị/tải xuống, không được dùng để tạo path lưu trữ.
- Khi upload phiên bản mới, file mới cũng phải đi qua toàn bộ validation như upload tài liệu lần đầu.

---

## 2. Database Schema

### Entity Relationship Diagram

```text
[departments] 1──N [users]
[users] 1──N [documents] (uploaded_by)
[users] 1──N [documents] (owner_id)
[categories] 1──N [documents]
[departments] 1──N [documents] (owning_department_id)

[documents] 1──N [document_versions]
[documents] N──N [tags] (via document_tags)
[documents] 1──1 [document_contents]
[documents] N──N [departments] (via document_department_accesses)
[documents] N──N [users] (via document_user_accesses)

[users] 1──N [search_logs]
[users] 1──N [access_logs]
[users] 1──N [audit_logs]
```

### Base Conventions

Tất cả entity chính đều có:

- `id` (BIGINT, PK, AUTO_INCREMENT)
- `created_at` (TIMESTAMP, NOT NULL)
- `updated_at` (TIMESTAMP, NULLABLE)

Soft Delete: `deleted_at` (TIMESTAMP, NULLABLE) cho User, Document, Category, Department, Tag.

### Document Access Model

| Access level | Quyền truy cập |
|--------------|----------------|
| `PUBLIC` | Tất cả user đã đăng nhập có thể xem, preview, download và search thấy tài liệu. |
| `DEPARTMENT` | Chỉ user thuộc các phòng ban được cấp trong `document_department_accesses` hoặc admin. |
| `RESTRICTED` | Chỉ owner, user được cấp trực tiếp trong `document_user_accesses`, hoặc admin. |

Quy tắc áp dụng cho mọi read-path của tài liệu: list, detail, search, preview, download, version download và dashboard drill-down.

### Document Lifecycle

```text
PROCESSING -> INDEXED
PROCESSING -> EXTRACTION_FAILED
EXTRACTION_FAILED -> PROCESSING     // retry indexing
INDEXED -> ARCHIVED
ARCHIVED -> INDEXED                 // restore
INDEXED/ARCHIVED/EXTRACTION_FAILED -> DELETED
DELETED -> INDEXED/ARCHIVED          // restore nếu còn trong retention window
```

| Status | Mô tả |
|--------|-------|
| `PROCESSING` | File đã upload, đang extract text và đồng bộ Elasticsearch. |
| `INDEXED` | Tài liệu đã sẵn sàng để search/preview/download. |
| `EXTRACTION_FAILED` | Extract hoặc index thất bại; admin có thể retry. |
| `ARCHIVED` | Tài liệu bị ẩn khỏi danh sách mặc định nhưng vẫn có thể restore. |
| `DELETED` | Soft delete; không hiển thị/search theo mặc định. |

---

### Table: `users`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | BIGINT | PK, AI | |
| name | VARCHAR(100) | NOT NULL | Họ tên |
| email | VARCHAR(255) | NOT NULL, UNIQUE | Email đăng nhập |
| password | VARCHAR(255) | NOT NULL | BCrypt hash |
| phone | VARCHAR(20) | NULLABLE, UNIQUE | SĐT |
| avatar | VARCHAR(255) | NULLABLE | URL ảnh |
| role | VARCHAR(20) | NOT NULL, DEFAULT 'USER' | ADMIN / USER |
| department_id | BIGINT | FK → departments | Phòng ban |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'ACTIVE' | ACTIVE / INACTIVE / BANNED |
| last_login | TIMESTAMP | NULLABLE | Lần login gần nhất |
| created_at | TIMESTAMP | NOT NULL | |
| updated_at | TIMESTAMP | NULLABLE | |
| deleted_at | TIMESTAMP | NULLABLE | Soft delete |

### Table: `refresh_tokens`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | BIGINT | PK, AI | |
| token | VARCHAR(500) | NOT NULL, UNIQUE | Refresh token |
| user_id | BIGINT | FK → users, NOT NULL | |
| expires_at | TIMESTAMP | NOT NULL | |
| revoked | BOOLEAN | DEFAULT false | |
| device_info | VARCHAR(255) | NULLABLE | User-Agent |
| ip_address | VARCHAR(45) | NULLABLE | |

### Table: `categories`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | BIGINT | PK, AI | |
| parent_id | BIGINT | FK → categories, NULLABLE | Cây phân cấp |
| name | VARCHAR(255) | NOT NULL | |
| slug | VARCHAR(255) | NOT NULL, UNIQUE | URL-friendly |
| description | TEXT | NULLABLE | |
| icon | VARCHAR(100) | NULLABLE | Icon class |
| sort_order | INT | DEFAULT 0 | Thứ tự hiển thị |
| is_active | BOOLEAN | DEFAULT true | |
| created_at | TIMESTAMP | NOT NULL | |
| updated_at | TIMESTAMP | NULLABLE | |
| deleted_at | TIMESTAMP | NULLABLE | |

### Table: `departments`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | BIGINT | PK, AI | |
| name | VARCHAR(255) | NOT NULL | |
| code | VARCHAR(50) | NOT NULL, UNIQUE | Mã (HR, IT, FIN...) |
| description | TEXT | NULLABLE | |
| is_active | BOOLEAN | DEFAULT true | |
| created_at | TIMESTAMP | NOT NULL | |
| updated_at | TIMESTAMP | NULLABLE | |
| deleted_at | TIMESTAMP | NULLABLE | |

### Table: `tags`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | BIGINT | PK, AI | |
| name | VARCHAR(100) | NOT NULL, UNIQUE | |
| slug | VARCHAR(100) | NOT NULL, UNIQUE | Tự sinh từ name |
| created_at | TIMESTAMP | NOT NULL | |
| updated_at | TIMESTAMP | NULLABLE | |
| deleted_at | TIMESTAMP | NULLABLE | |

### Table: `documents` ⭐ (Core)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | BIGINT | PK, AI | |
| title | VARCHAR(500) | NOT NULL | Tiêu đề |
| slug | VARCHAR(500) | NOT NULL, UNIQUE | URL-friendly |
| description | TEXT | NULLABLE | Mô tả ngắn |
| category_id | BIGINT | FK → categories, NOT NULL | |
| department_id | BIGINT | FK → departments, NULLABLE | Phòng ban sở hữu/chủ quản |
| uploaded_by | BIGINT | FK → users, NOT NULL | Người upload |
| owner_id | BIGINT | FK → users, NOT NULL | Người chịu trách nhiệm tài liệu |
| file_name | VARCHAR(255) | NOT NULL | Tên file gốc đã sanitize |
| file_type | VARCHAR(20) | NOT NULL | PDF, DOCX... |
| mime_type | VARCHAR(100) | NOT NULL | MIME thực tế sau validation |
| file_size | BIGINT | NOT NULL | Bytes |
| storage_path | VARCHAR(500) | NOT NULL | UUID/generated storage key |
| thumbnail_path | VARCHAR(500) | NULLABLE | |
| page_count | INT | NULLABLE | |
| document_code | VARCHAR(100) | NULLABLE, UNIQUE | Mã tài liệu |
| version_number | VARCHAR(20) | DEFAULT '1.0' | Phiên bản hiện tại |
| status | VARCHAR(30) | DEFAULT 'PROCESSING' | PROCESSING / INDEXED / EXTRACTION_FAILED / ARCHIVED / DELETED |
| access_level | VARCHAR(20) | NOT NULL, DEFAULT 'PUBLIC' | PUBLIC / DEPARTMENT / RESTRICTED |
| view_count | INT | DEFAULT 0 | |
| download_count | INT | DEFAULT 0 | |
| effective_date | DATE | NULLABLE | |
| expiry_date | DATE | NULLABLE | |
| archived_at | TIMESTAMP | NULLABLE | Thời điểm archive |
| deleted_at | TIMESTAMP | NULLABLE | Soft delete |
| created_at | TIMESTAMP | NOT NULL | |
| updated_at | TIMESTAMP | NULLABLE | |

### Table: `document_department_accesses`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| document_id | BIGINT | FK → documents, NOT NULL | |
| department_id | BIGINT | FK → departments, NOT NULL | |
| granted_by | BIGINT | FK → users, NOT NULL | Admin cấp quyền |
| created_at | TIMESTAMP | NOT NULL | |
| | | Composite PK (document_id, department_id) | |

### Table: `document_user_accesses`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| document_id | BIGINT | FK → documents, NOT NULL | |
| user_id | BIGINT | FK → users, NOT NULL | User được cấp quyền |
| granted_by | BIGINT | FK → users, NOT NULL | Admin cấp quyền |
| created_at | TIMESTAMP | NOT NULL | |
| | | Composite PK (document_id, user_id) | |

### Table: `document_contents`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | BIGINT | PK, AI | |
| document_id | BIGINT | FK → documents, UNIQUE | 1:1 |
| extracted_text | LONGTEXT | NULLABLE | Nội dung text trích xuất |
| extraction_method | VARCHAR(50) | NOT NULL | PDFBOX / POI / TIKA_FALLBACK / OCR / MANUAL |
| language | VARCHAR(10) | NULLABLE | vi, en... |
| extraction_status | VARCHAR(30) | NOT NULL | SUCCESS / PARTIAL / FAILED |
| error_message | TEXT | NULLABLE | |
| retry_count | INT | DEFAULT 0 | Số lần retry extraction/indexing |
| extracted_at | TIMESTAMP | NULLABLE | |

### Table: `document_versions`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | BIGINT | PK, AI | |
| document_id | BIGINT | FK → documents, NOT NULL | |
| version_number | VARCHAR(20) | NOT NULL | |
| file_name | VARCHAR(255) | NOT NULL | Tên file gốc đã sanitize |
| file_size | BIGINT | NOT NULL | |
| mime_type | VARCHAR(100) | NOT NULL | |
| storage_path | VARCHAR(500) | NOT NULL | UUID/generated storage key |
| changelog | TEXT | NULLABLE | |
| uploaded_by | BIGINT | FK → users, NOT NULL | |
| created_at | TIMESTAMP | NOT NULL | |

### Table: `document_tags` (N:N)

| Column | Type | Constraints |
|--------|------|-------------|
| document_id | BIGINT | FK → documents, NOT NULL |
| tag_id | BIGINT | FK → tags, NOT NULL |
| | | Composite PK (document_id, tag_id) |

### Table: `audit_logs`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | BIGINT | PK, AI | |
| actor_id | BIGINT | FK → users, NULLABLE | User thực hiện hành động |
| action | VARCHAR(50) | NOT NULL | CREATE / UPDATE / DELETE / ARCHIVE / RESTORE / LOGIN / LOGOUT |
| target_type | VARCHAR(50) | NOT NULL | DOCUMENT / USER / CATEGORY / DEPARTMENT / TAG |
| target_id | BIGINT | NULLABLE | ID đối tượng tác động |
| old_value | JSON | NULLABLE | Giá trị trước khi đổi |
| new_value | JSON | NULLABLE | Giá trị sau khi đổi |
| ip_address | VARCHAR(45) | NULLABLE | |
| user_agent | VARCHAR(255) | NULLABLE | |
| created_at | TIMESTAMP | NOT NULL | |

### Table: `access_logs`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | BIGINT | PK, AI | |
| user_id | BIGINT | FK → users, NOT NULL | |
| document_id | BIGINT | FK → documents, NOT NULL | |
| action | VARCHAR(30) | NOT NULL | VIEW / PREVIEW / DOWNLOAD / VERSION_DOWNLOAD |
| access_granted | BOOLEAN | NOT NULL | Có được phép truy cập không |
| denial_reason | VARCHAR(255) | NULLABLE | Lý do bị từ chối |
| ip_address | VARCHAR(45) | NULLABLE | |
| user_agent | VARCHAR(255) | NULLABLE | |
| created_at | TIMESTAMP | NOT NULL | |

### Table: `search_logs`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | BIGINT | PK, AI | |
| user_id | BIGINT | FK → users, NOT NULL | |
| keyword | VARCHAR(500) | NULLABLE | Từ khóa tìm kiếm |
| filters | JSON | NULLABLE | category, type, department, date range... |
| result_count | INT | NOT NULL | Số kết quả trả về sau khi áp quyền |
| latency_ms | INT | NULLABLE | Thời gian xử lý |
| created_at | TIMESTAMP | NOT NULL | |

---

## 3. Database Indexes

### Unique Indexes

```sql
CREATE UNIQUE INDEX idx_users_email ON users(email);
CREATE UNIQUE INDEX idx_documents_slug ON documents(slug);
CREATE UNIQUE INDEX idx_documents_code ON documents(document_code);
CREATE UNIQUE INDEX idx_categories_slug ON categories(slug);
CREATE UNIQUE INDEX idx_departments_code ON departments(code);
CREATE UNIQUE INDEX idx_tags_slug ON tags(slug);
CREATE UNIQUE INDEX idx_document_contents_doc ON document_contents(document_id);
```

### Performance Indexes

```sql
CREATE INDEX idx_documents_category ON documents(category_id);
CREATE INDEX idx_documents_department ON documents(department_id);
CREATE INDEX idx_documents_uploaded_by ON documents(uploaded_by);
CREATE INDEX idx_documents_owner ON documents(owner_id);
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_documents_access_level ON documents(access_level);
CREATE INDEX idx_documents_file_type ON documents(file_type);
CREATE INDEX idx_documents_effective_date ON documents(effective_date);
CREATE INDEX idx_documents_created_at ON documents(created_at);
CREATE INDEX idx_document_versions_doc ON document_versions(document_id);
CREATE INDEX idx_audit_logs_actor_date ON audit_logs(actor_id, created_at);
CREATE INDEX idx_access_logs_doc_date ON access_logs(document_id, created_at);
CREATE INDEX idx_access_logs_user_date ON access_logs(user_id, created_at);
CREATE INDEX idx_search_logs_user_date ON search_logs(user_id, created_at);
```

### Composite Indexes

```sql
CREATE INDEX idx_documents_cat_status_date ON documents(category_id, status, created_at);
CREATE INDEX idx_documents_dept_type ON documents(department_id, file_type);
CREATE INDEX idx_doc_dept_access_dept ON document_department_accesses(department_id, document_id);
CREATE INDEX idx_doc_user_access_user ON document_user_accesses(user_id, document_id);
```

---

## 4. Elasticsearch Design

Full-text search được thực thi bởi Elasticsearch. MySQL chỉ dùng B-Tree indexes cho lookup metadata, filter, join và đồng bộ index.

### Index: `documents_v1`

| Field | Type | Usage |
|-------|------|-------|
| `document_id` | keyword | Join ngược về MySQL |
| `title` | text + keyword | Full-text, exact sort/filter |
| `description` | text | Full-text |
| `content` | text | Nội dung extract |
| `document_code` | keyword + text | Tìm theo mã tài liệu |
| `category_id` | keyword | Filter/facet |
| `category_name` | keyword | Facet display |
| `department_id` | keyword | Phòng ban chủ quản |
| `document_type` | keyword | PDF/DOC/DOCX/XLS/XLSX |
| `tags` | keyword + text | Filter/facet và search |
| `status` | keyword | Chỉ search mặc định `INDEXED` |
| `access_level` | keyword | PUBLIC / DEPARTMENT / RESTRICTED |
| `owner_id` | keyword | Permission filter |
| `department_ids` | keyword[] | Departments được cấp quyền |
| `allowed_user_ids` | keyword[] | Users được cấp quyền trực tiếp |
| `uploaded_by` | keyword | Filter/admin dashboard |
| `created_at` | date | Sort/filter |
| `updated_at` | date | Sync/debug |

### Analyzer & Ranking

- Dùng Vietnamese analyzer cho `title`, `description`, `content`, `tags`.
- Ưu tiên ranking theo boost: `title^4`, `document_code^3`, `tags^2`, `description^1.5`, `content^1`.
- Search response hỗ trợ highlight cho `title`, `description`, `content`.
- Facets tối thiểu: category, department, document_type, tags, created date range.
- `GET /documents/search/suggestions` dùng completion suggester hoặc prefix query trên `title`, `document_code`, `tags`.

### Permission Filter

Mọi query search phải thêm filter quyền theo user hiện tại:

```text
status = INDEXED
AND (
  access_level = PUBLIC
  OR owner_id = current_user_id
  OR (access_level = DEPARTMENT AND department_ids contains current_user.department_id)
  OR (access_level = RESTRICTED AND allowed_user_ids contains current_user_id)
  OR current_user.role = ADMIN
)
```

### Sync & Retry

- Khi upload hoặc upload version mới: lưu MySQL trước, extract text, sau đó index Elasticsearch.
- Khi metadata, tags, category, ACL hoặc status thay đổi: cập nhật lại document trong Elasticsearch.
- Khi archive/delete: cập nhật `status`; không hard delete khỏi Elasticsearch ngay để phục vụ audit/debug nội bộ.
- `POST /documents/{id}/retry-indexing` chỉ áp dụng cho tài liệu `EXTRACTION_FAILED` hoặc tài liệu có lỗi index gần nhất.

---

## 5. API Endpoints Chi Tiết

> Chi tiết request/response cho từng endpoint xem tại [API_SPEC.md](./API_SPEC.md)

### Authentication

| # | Method | Endpoint | Auth | Description |
|---|--------|----------|------|-------------|
| 1 | POST | `/auth/login` | Public | Đăng nhập |
| 2 | POST | `/auth/register` | Admin | Admin tạo tài khoản |
| 3 | POST | `/auth/refresh` | Public | Refresh Access Token |
| 4 | POST | `/auth/logout` | Auth | Đăng xuất |

### User Management

| # | Method | Endpoint | Auth | Description |
|---|--------|----------|------|-------------|
| 5 | GET | `/users/me` | Auth | Xem profile |
| 6 | PUT | `/users/me` | Auth | Cập nhật profile |
| 7 | GET | `/users` | Admin | Danh sách users |
| 8 | GET | `/users/{id}` | Admin | Chi tiết user |
| 9 | POST | `/users` | Admin | Tạo user |
| 10 | PUT | `/users/{id}` | Admin | Cập nhật user |
| 11 | DELETE | `/users/{id}` | Admin | Xóa user (soft) |

### Document Management

| # | Method | Endpoint | Auth | Description |
|---|--------|----------|------|-------------|
| 12 | POST | `/documents` | Admin | Upload tài liệu |
| 13 | GET | `/documents` | Auth | Danh sách tài liệu theo quyền hiện tại |
| 14 | GET | `/documents/{id}` | Auth | Chi tiết tài liệu |
| 15 | PUT | `/documents/{id}` | Admin | Cập nhật metadata, tags, ACL |
| 16 | DELETE | `/documents/{id}` | Admin | Xóa tài liệu (soft delete) |
| 17 | POST | `/documents/{id}/archive` | Admin | Archive tài liệu |
| 18 | POST | `/documents/{id}/restore` | Admin | Restore tài liệu đã archive/delete |
| 19 | POST | `/documents/{id}/retry-indexing` | Admin | Retry extraction/indexing |
| 20 | GET | `/documents/{id}/preview` | Auth | Preview tài liệu |
| 21 | GET | `/documents/{id}/download` | Auth | Tải tài liệu |
| 22 | GET | `/documents/{id}/versions` | Auth | Lịch sử phiên bản |
| 23 | POST | `/documents/{id}/versions` | Admin | Upload phiên bản mới |
| 24 | GET | `/documents/{id}/versions/{versionId}/download` | Auth | Tải phiên bản cũ |
| 25 | POST | `/documents/{id}/versions/{versionId}/restore` | Admin | Khôi phục một phiên bản cũ thành phiên bản hiện tại |

### Search

| # | Method | Endpoint | Auth | Description |
|---|--------|----------|------|-------------|
| 26 | GET | `/documents/search` | Auth | Tìm kiếm full-text có filter quyền |
| 27 | GET | `/documents/search/suggestions` | Auth | Gợi ý keyword/title/code/tag |

### Master Data

| # | Method | Endpoint | Auth | Description |
|---|--------|----------|------|-------------|
| 28–32 | CRUD | `/categories`, `/categories/{id}` | Auth/Admin | Danh mục |
| 33–37 | CRUD | `/departments`, `/departments/{id}` | Auth/Admin | Phòng ban |
| 38–42 | CRUD | `/tags`, `/tags/{id}` | Auth/Admin | Tags |

### Dashboard & Audit

Dashboard dùng convention `/admin/dashboard/summary` cho thống kê tổng quan, các số liệu chuyên biệt nằm ở endpoint con.

| # | Method | Endpoint | Auth | Description |
|---|--------|----------|------|-------------|
| 43 | GET | `/admin/dashboard/summary` | Admin | Tổng số tài liệu, user, lượt truy cập, lỗi xử lý |
| 44 | GET | `/admin/dashboard/top-documents` | Admin | Tài liệu được xem/tải nhiều nhất |
| 45 | GET | `/admin/dashboard/recent-uploads` | Admin | Tài liệu upload gần đây |
| 46 | GET | `/admin/dashboard/top-search-keywords` | Admin | Từ khóa tìm kiếm phổ biến |
| 47 | GET | `/admin/dashboard/access-stats` | Admin | Thống kê preview/download/view theo thời gian |
| 48 | GET | `/admin/dashboard/processing-errors` | Admin | Danh sách lỗi extraction/indexing |
| 49 | GET | `/admin/audit-logs` | Admin | Tra cứu audit logs |

---

## 6. Logging Rules

| Action | Log table |
|--------|-----------|
| Login/logout | `audit_logs` |
| Create/update/delete/archive/restore document | `audit_logs` |
| Update ACL/tags/category/metadata | `audit_logs` |
| Preview/download/version download | `access_logs` |
| Denied preview/download/detail due to ACL | `access_logs` |
| Search/suggestions | `search_logs` |
| Retry extraction/indexing | `audit_logs` |

Dashboard chỉ tổng hợp từ `documents`, `users`, `audit_logs`, `access_logs`, `search_logs` và trạng thái xử lý trong `document_contents`/Elasticsearch sync metadata.

---

## 7. Tài liệu liên quan

| Tài liệu | Đường dẫn |
|-----------|-----------|
| API chi tiết (Request/Response) | [API_SPEC.md](./API_SPEC.md) |
| Database schema đầy đủ | [DATABASE.md](./DATABASE.md) |
| System Architecture | [sa/sa.md](./sa/sa.md) |
| Tech Stack | [sa/techstack.md](./sa/techstack.md) |
| Server & Deployment | [sa/server.md](./sa/server.md) |
| Đặc tả yêu cầu | [spec/specs.md](./spec/specs.md) |
