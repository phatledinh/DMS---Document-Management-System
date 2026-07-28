# Database Schema — Hệ Thống Quản Lý Tài Liệu Nội Bộ (DMS)

> Schema thiết kế cho hệ thống Quản lý & Tìm kiếm Tài liệu Doanh nghiệp.
> MySQL lưu metadata, dữ liệu quan hệ, ACL và log; Elasticsearch là search engine mặc định cho full-text search.

---

## 1. Entity Relationship Diagram

```text
[departments] 1──N [users]
[users] 1──N [documents] (uploaded_by)
[users] 1──N [documents] (owner_id)
[categories] 1──N [documents]
[departments] 1──N [documents] (department_id / owning department)

[documents] 1──N [document_versions]
[documents] N──N [tags] (via document_tags)
[documents] 1──1 [document_contents]
[documents] N──N [departments] (via document_department_accesses)
[documents] N──N [users] (via document_user_accesses)

[users] 1──N [audit_logs] (actor_id)
[users] 1──N [access_logs]
[users] 1──N [search_logs]
[documents] 1──N [access_logs]
```

---

## 2. Base Conventions

### BaseEntity

Tất cả entity chính có:

- `id` (BIGINT, PK, AUTO_INCREMENT)
- `created_at` (TIMESTAMP, NOT NULL, DEFAULT CURRENT_TIMESTAMP)
- `updated_at` (TIMESTAMP, NULLABLE, ON UPDATE CURRENT_TIMESTAMP)

### Soft Delete Strategy

| Entity | Soft Delete? | Field | Lý do |
|--------|:---:|-------|-------|
| User | Có | `deleted_at` | Giữ lại lịch sử hoạt động |
| Document | Có | `deleted_at` + `deleted_by` + `purge_after` + `status = DELETED` | Đưa vào Thùng rác, có thể restore trước khi tự purge sau 30 ngày |
| Category | Có | `deleted_at` | Cần giữ lại cho tài liệu cũ |
| Department | Có | `deleted_at` | Cần giữ lại cho user/tài liệu cũ |
| Tag | Có | `deleted_at` | Cần giữ lại mapping tài liệu cũ |
| Document Version | Không | — | Giữ lịch sử phiên bản, cleanup theo policy riêng |
| Logs | Không | — | Phục vụ audit và dashboard |

### Naming & Storage Rules

- `storage_path` phải dùng UUID hoặc generated key, không dùng trực tiếp tên file gốc.
- `file_name` là tên gốc đã sanitize để hiển thị/tải xuống.
- File upload tối đa `50MB`.
- Validate cả extension và MIME thực tế bằng Apache Tika.
- Chặn extension nguy hiểm: `.exe`, `.sh`, `.bat`, `.cmd`, `.js`, `.html`, `.htm`, `.jar`, `.msi`, `.ps1`, `.vbs`.

---

## 3. Access Model & Lifecycle

### Document Access Levels

| Access level | Quyền truy cập |
|--------------|----------------|
| `PUBLIC` | Tất cả user đã đăng nhập có thể xem, search, preview và download. |
| `DEPARTMENT` | User thuộc các phòng ban được cấp trong `document_department_accesses`, hoặc Admin. |
| `RESTRICTED` | Owner, user được cấp trực tiếp trong `document_user_accesses`, hoặc Admin. |

Quy tắc quyền phải dùng thống nhất cho list, detail, search, preview, download, version download và dashboard drill-down.

### Document Lifecycle

```text
PROCESSING -> INDEXED
PROCESSING -> EXTRACTION_FAILED
EXTRACTION_FAILED -> PROCESSING
INDEXED -> ARCHIVED
ARCHIVED -> INDEXED
INDEXED/ARCHIVED/EXTRACTION_FAILED -> DELETED
DELETED -> PROCESSING/INDEXED/ARCHIVED
DELETED -> PURGED (sau 30 ngày hoặc permanent delete)
```

| Status | Mô tả |
|--------|-------|
| `PROCESSING` | File đã upload, đang extract text và đồng bộ Elasticsearch. |
| `INDEXED` | Tài liệu đã sẵn sàng để search/preview/download. |
| `EXTRACTION_FAILED` | Extract hoặc index thất bại; có thể retry. |
| `ARCHIVED` | Tài liệu ngưng sử dụng, ẩn khỏi danh sách/search mặc định. |
| `DELETED` | Xóa mềm trong Thùng rác; không hiển thị/search/preview/download theo mặc định và tự purge sau `purge_after`. |



### Document Code Generation Rule

- `documents.document_code` do backend tự sinh khi tạo document, không lấy từ input người dùng.
- Format đề xuất: `DMS-{yyyyMM}-{sequence6}`; ví dụ `DMS-202607-000001`.
- Sequence có thể theo tháng hoặc toàn hệ thống, nhưng phải sinh trong transaction và có unique index bảo vệ.
- Nếu upload nhiều file cùng lúc, mỗi file/document nhận một `document_code` riêng.
- Mã tài liệu là immutable trong luồng metadata thông thường; mọi thay đổi thủ công nếu có trong tương lai phải ghi audit riêng.

### Trash Retention Policy

- Soft delete document set:
  - `status = DELETED`
  - `deleted_at = now()`
  - `deleted_by = current_user_id`
  - `purge_after = deleted_at + interval 30 day`
  - `previous_status = old status`
- Restore document clear `deleted_at`, `deleted_by`, `purge_after`; status trở về `previous_status` nếu file/index còn hợp lệ, hoặc `PROCESSING` nếu cần re-index.
- Permanent purge áp dụng khi Admin xóa vĩnh viễn hoặc scheduled job thấy `status = DELETED AND purge_after <= now()`.
- Permanent purge xóa object storage current file, version files theo retention policy, `document_contents`, Elasticsearch document và metadata nếu chọn hard delete. Audit/access/search logs vẫn được giữ.
- Nếu cần giữ lịch sử tối thiểu cho audit, giữ tombstone row với `permanently_deleted_at` và xóa storage/content/search artifacts.

### Storage Usage Calculation

| Metric | Công thức |
|--------|-----------|
| Active storage | `SUM(documents.file_size)` với `status != 'DELETED'` |
| Trash storage | `SUM(documents.file_size)` với `status = 'DELETED'` |
| Version storage | `SUM(document_versions.file_size)` nếu version lưu object riêng |
| Total storage | Active + Trash + Version |

MB hiển thị = bytes / 1024 / 1024, làm tròn 2 chữ số. Các giá trị trên là logical file size theo DB, không nhất thiết bằng dung lượng billing thực tế của object storage nếu provider có nén/deduplication.

---

## 4. Identity Domain

### users

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | BIGINT | PK, AUTO_INCREMENT | |
| name | VARCHAR(100) | NOT NULL | Họ tên |
| email | VARCHAR(255) | NOT NULL, UNIQUE | Email đăng nhập |
| password | VARCHAR(255) | NOT NULL | BCrypt hash |
| phone | VARCHAR(20) | NULLABLE, UNIQUE | Số điện thoại |
| avatar | VARCHAR(255) | NULLABLE | URL ảnh đại diện |
| role | VARCHAR(20) | NOT NULL, DEFAULT 'USER' | ADMIN, USER |
| department_id | BIGINT | FK → departments(id), NULLABLE | Phòng ban của user |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'ACTIVE' | ACTIVE, INACTIVE, BANNED |
| last_login | TIMESTAMP | NULLABLE | Lần đăng nhập gần nhất |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | |
| updated_at | TIMESTAMP | NULLABLE, ON UPDATE CURRENT_TIMESTAMP | |
| deleted_at | TIMESTAMP | NULLABLE | Soft delete |

### refresh_tokens

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | BIGINT | PK, AUTO_INCREMENT | |
| token | VARCHAR(500) | NOT NULL, UNIQUE | Refresh token value |
| user_id | BIGINT | FK → users(id), NOT NULL | Chủ sở hữu token |
| expires_at | TIMESTAMP | NOT NULL | Thời điểm hết hạn |
| revoked | BOOLEAN | NOT NULL, DEFAULT false | Đã thu hồi chưa |
| device_info | VARCHAR(255) | NULLABLE | User-Agent |
| ip_address | VARCHAR(45) | NULLABLE | IPv4/IPv6 |

---

## 5. Master Data Domain

### categories

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | BIGINT | PK, AUTO_INCREMENT | |
| parent_id | BIGINT | FK → categories(id), NULLABLE | Hỗ trợ cây phân cấp |
| name | VARCHAR(255) | NOT NULL | Tên danh mục |
| slug | VARCHAR(255) | NOT NULL, UNIQUE | URL-friendly |
| description | TEXT | NULLABLE | Mô tả |
| icon | VARCHAR(100) | NULLABLE | Icon class |
| sort_order | INT | NOT NULL, DEFAULT 0 | Thứ tự hiển thị |
| is_active | BOOLEAN | NOT NULL, DEFAULT true | Trạng thái sử dụng |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | |
| updated_at | TIMESTAMP | NULLABLE, ON UPDATE CURRENT_TIMESTAMP | |
| deleted_at | TIMESTAMP | NULLABLE | Soft delete |

### departments

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | BIGINT | PK, AUTO_INCREMENT | |
| name | VARCHAR(255) | NOT NULL | Tên phòng ban |
| code | VARCHAR(50) | NOT NULL, UNIQUE | Mã phòng ban |
| description | TEXT | NULLABLE | Mô tả |
| is_active | BOOLEAN | NOT NULL, DEFAULT true | Trạng thái sử dụng |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | |
| updated_at | TIMESTAMP | NULLABLE, ON UPDATE CURRENT_TIMESTAMP | |
| deleted_at | TIMESTAMP | NULLABLE | Soft delete |

### tags

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | BIGINT | PK, AUTO_INCREMENT | |
| name | VARCHAR(100) | NOT NULL, UNIQUE | Tên tag |
| slug | VARCHAR(100) | NOT NULL, UNIQUE | Tự sinh từ name |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | |
| updated_at | TIMESTAMP | NULLABLE, ON UPDATE CURRENT_TIMESTAMP | |
| deleted_at | TIMESTAMP | NULLABLE | Soft delete |

---

## 6. Document Domain

### documents

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | BIGINT | PK, AUTO_INCREMENT | |
| title | VARCHAR(500) | NOT NULL | Tiêu đề tài liệu |
| slug | VARCHAR(500) | NOT NULL, UNIQUE | URL-friendly |
| description | TEXT | NULLABLE | Mô tả ngắn |
| category_id | BIGINT | FK → categories(id), NOT NULL | Danh mục |
| department_id | BIGINT | FK → departments(id), NULLABLE | Phòng ban sở hữu/chủ quản |
| uploaded_by | BIGINT | FK → users(id), NOT NULL | Người upload |
| owner_id | BIGINT | FK → users(id), NOT NULL | Người chịu trách nhiệm tài liệu |
| file_name | VARCHAR(255) | NOT NULL | Tên file gốc đã sanitize |
| file_type | VARCHAR(20) | NOT NULL | PDF, DOC, DOCX, XLS, XLSX, JPG, PNG, TIFF |
| mime_type | VARCHAR(100) | NOT NULL | MIME thực tế sau validation |
| file_size | BIGINT | NOT NULL | Kích thước file bytes |
| storage_path | VARCHAR(500) | NOT NULL | UUID/generated storage key |
| thumbnail_path | VARCHAR(500) | NULLABLE | Đường dẫn thumbnail/preview image |
| page_count | INT | NULLABLE | Số trang nếu áp dụng |
| document_code | VARCHAR(100) | NOT NULL, UNIQUE | Mã tài liệu do backend tự sinh, ví dụ `DMS-202607-000001` |
| version_number | VARCHAR(20) | NOT NULL, DEFAULT '1.0' | Phiên bản hiện tại |
| status | VARCHAR(30) | NOT NULL, DEFAULT 'PROCESSING' | PROCESSING, INDEXED, EXTRACTION_FAILED, ARCHIVED, DELETED |
| access_level | VARCHAR(20) | NOT NULL, DEFAULT 'PUBLIC' | PUBLIC, DEPARTMENT, RESTRICTED |
| view_count | INT | NOT NULL, DEFAULT 0 | Số lượt preview/xem |
| download_count | INT | NOT NULL, DEFAULT 0 | Số lượt tải |
| effective_date | DATE | NULLABLE | Ngày hiệu lực |
| expiry_date | DATE | NULLABLE | Ngày hết hiệu lực |
| archived_at | TIMESTAMP | NULLABLE | Thời điểm archive |
| deleted_at | TIMESTAMP | NULLABLE | Soft delete / thời điểm đưa vào Thùng rác |
| deleted_by | BIGINT | FK → users(id), NULLABLE | Người đưa tài liệu vào Thùng rác |
| purge_after | TIMESTAMP | NULLABLE | Thời điểm tự xóa vĩnh viễn, mặc định `deleted_at + 30 ngày` |
| previous_status | VARCHAR(30) | NULLABLE | Trạng thái trước khi soft delete, dùng cho restore |
| permanently_deleted_at | TIMESTAMP | NULLABLE | Tombstone nếu chọn giữ row sau permanent purge |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | |
| updated_at | TIMESTAMP | NULLABLE, ON UPDATE CURRENT_TIMESTAMP | |

### document_department_accesses

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| document_id | BIGINT | FK → documents(id), NOT NULL | Tài liệu được cấp quyền |
| department_id | BIGINT | FK → departments(id), NOT NULL | Phòng ban được xem |
| granted_by | BIGINT | FK → users(id), NOT NULL | Admin cấp quyền |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Thời điểm cấp quyền |
| | | Composite PK (document_id, department_id) | |

### document_user_accesses

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| document_id | BIGINT | FK → documents(id), NOT NULL | Tài liệu được cấp quyền |
| user_id | BIGINT | FK → users(id), NOT NULL | User được xem trực tiếp |
| granted_by | BIGINT | FK → users(id), NOT NULL | Admin cấp quyền |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Thời điểm cấp quyền |
| | | Composite PK (document_id, user_id) | |

### document_contents

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | BIGINT | PK, AUTO_INCREMENT | |
| document_id | BIGINT | FK → documents(id), NOT NULL, UNIQUE | 1:1 với documents |
| extracted_text | LONGTEXT | NULLABLE | Nội dung text đã trích xuất |
| extraction_method | VARCHAR(50) | NOT NULL | PDFBOX, POI, TIKA_FALLBACK, OCR, MANUAL |
| language | VARCHAR(10) | NULLABLE | vi, en... |
| extraction_status | VARCHAR(30) | NOT NULL | SUCCESS, PARTIAL, FAILED |
| error_message | TEXT | NULLABLE | Lỗi extraction/indexing gần nhất |
| retry_count | INT | NOT NULL, DEFAULT 0 | Số lần retry extraction/indexing |
| extracted_at | TIMESTAMP | NULLABLE | Thời điểm trích xuất gần nhất |

`extracted_text` có thể rất lớn nên tách khỏi bảng `documents`; dữ liệu này được đồng bộ sang Elasticsearch để full-text search.

### document_versions

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | BIGINT | PK, AUTO_INCREMENT | |
| document_id | BIGINT | FK → documents(id), NOT NULL | Tài liệu gốc |
| version_number | VARCHAR(20) | NOT NULL | Ví dụ 1.0, 1.1, 2.0 |
| file_name | VARCHAR(255) | NOT NULL | Tên file gốc đã sanitize |
| file_size | BIGINT | NOT NULL | Kích thước bytes |
| mime_type | VARCHAR(100) | NOT NULL | MIME thực tế sau validation |
| storage_path | VARCHAR(500) | NOT NULL | UUID/generated storage key |
| changelog | TEXT | NULLABLE | Ghi chú thay đổi |
| uploaded_by | BIGINT | FK → users(id), NOT NULL | Người upload version |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Thời điểm upload |

### document_tags

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| document_id | BIGINT | FK → documents(id), NOT NULL | |
| tag_id | BIGINT | FK → tags(id), NOT NULL | |
| | | Composite PK (document_id, tag_id) | |

---

## 7. Audit, Access & Search Logs

### audit_logs

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | BIGINT | PK, AUTO_INCREMENT | |
| actor_id | BIGINT | FK → users(id), NULLABLE | User thực hiện hành động |
| action | VARCHAR(50) | NOT NULL | CREATE, UPDATE, DELETE, ARCHIVE, RESTORE, LOGIN, LOGOUT |
| target_type | VARCHAR(50) | NOT NULL | DOCUMENT, USER, CATEGORY, DEPARTMENT, TAG |
| target_id | BIGINT | NULLABLE | ID đối tượng tác động |
| old_value | JSON | NULLABLE | Giá trị trước khi đổi |
| new_value | JSON | NULLABLE | Giá trị sau khi đổi |
| ip_address | VARCHAR(45) | NULLABLE | IPv4/IPv6 |
| user_agent | VARCHAR(255) | NULLABLE | User-Agent |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Thời điểm ghi log |

### access_logs

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | BIGINT | PK, AUTO_INCREMENT | |
| user_id | BIGINT | FK → users(id), NOT NULL | User truy cập |
| document_id | BIGINT | FK → documents(id), NOT NULL | Tài liệu được truy cập |
| action | VARCHAR(30) | NOT NULL | VIEW, PREVIEW, DOWNLOAD, VERSION_DOWNLOAD |
| access_granted | BOOLEAN | NOT NULL | Có được phép truy cập không |
| denial_reason | VARCHAR(255) | NULLABLE | Lý do bị từ chối |
| ip_address | VARCHAR(45) | NULLABLE | IPv4/IPv6 |
| user_agent | VARCHAR(255) | NULLABLE | User-Agent |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Thời điểm truy cập |

### search_logs

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | BIGINT | PK, AUTO_INCREMENT | |
| user_id | BIGINT | FK → users(id), NOT NULL | User tìm kiếm |
| keyword | VARCHAR(500) | NULLABLE | Từ khóa tìm kiếm |
| filters | JSON | NULLABLE | category, type, department, date range... |
| result_count | INT | NOT NULL | Số kết quả sau khi áp quyền |
| latency_ms | INT | NULLABLE | Thời gian xử lý search |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Thời điểm tìm kiếm |

---

## 8. Database Indexes

### Unique Indexes

```sql
CREATE UNIQUE INDEX idx_users_email ON users(email);
CREATE UNIQUE INDEX idx_documents_slug ON documents(slug);
CREATE UNIQUE INDEX idx_documents_code ON documents(document_code); -- chống trùng mã tự sinh khi concurrent upload
CREATE UNIQUE INDEX idx_categories_slug ON categories(slug);
CREATE UNIQUE INDEX idx_departments_code ON departments(code);
CREATE UNIQUE INDEX idx_tags_slug ON tags(slug);
CREATE UNIQUE INDEX idx_document_contents_doc ON document_contents(document_id);
```

### Performance Indexes

```sql
CREATE INDEX idx_users_department ON users(department_id);
CREATE INDEX idx_users_status ON users(status);

CREATE INDEX idx_documents_category ON documents(category_id);
CREATE INDEX idx_documents_department ON documents(department_id);
CREATE INDEX idx_documents_uploaded_by ON documents(uploaded_by);
CREATE INDEX idx_documents_owner ON documents(owner_id);
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_documents_access_level ON documents(access_level);
CREATE INDEX idx_documents_file_type ON documents(file_type);
CREATE INDEX idx_documents_effective_date ON documents(effective_date);
CREATE INDEX idx_documents_created_at ON documents(created_at);
CREATE INDEX idx_documents_deleted_at ON documents(deleted_at);
CREATE INDEX idx_documents_purge_after ON documents(purge_after);

CREATE INDEX idx_document_versions_doc ON document_versions(document_id);
CREATE INDEX idx_audit_logs_actor_date ON audit_logs(actor_id, created_at);
CREATE INDEX idx_audit_logs_target ON audit_logs(target_type, target_id);
CREATE INDEX idx_access_logs_doc_date ON access_logs(document_id, created_at);
CREATE INDEX idx_access_logs_user_date ON access_logs(user_id, created_at);
CREATE INDEX idx_search_logs_user_date ON search_logs(user_id, created_at);
```

### Composite Indexes

```sql
CREATE INDEX idx_documents_cat_status_date ON documents(category_id, status, created_at);
CREATE INDEX idx_documents_dept_type ON documents(department_id, file_type);
CREATE INDEX idx_documents_status_purge ON documents(status, purge_after);
CREATE INDEX idx_doc_dept_access_dept ON document_department_accesses(department_id, document_id);
CREATE INDEX idx_doc_user_access_user ON document_user_accesses(user_id, document_id);
```

MySQL chỉ dùng B-Tree indexes cho lookup metadata, join, filter, ACL và đồng bộ Elasticsearch. Full-text search không dùng MySQL Full-text Search làm fallback.

---

## 9. Elasticsearch Index Design

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
| `document_type` | keyword | PDF/DOC/DOCX/XLS/XLSX/JPG/PNG/TIFF |
| `tags` | keyword + text | Filter/facet và search |
| `status` | keyword | Mặc định search `INDEXED` |
| `access_level` | keyword | PUBLIC, DEPARTMENT, RESTRICTED |
| `owner_id` | keyword | Permission filter |
| `department_ids` | keyword[] | Departments được cấp quyền |
| `allowed_user_ids` | keyword[] | Users được cấp quyền trực tiếp |
| `uploaded_by` | keyword | Filter/admin dashboard |
| `created_at` | date | Sort/filter |
| `updated_at` | date | Sync/debug |
| `effective_date` | date | Filter |
| `expiry_date` | date | Filter |
| `view_count` | integer | Sort/boost |
| `download_count` | integer | Sort/boost |

### Permission Filter

Mọi Elasticsearch query phải áp quyền theo user hiện tại:

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

### Ranking & Facets

- Analyzer tiếng Việt cho `title`, `description`, `content`, `tags`.
- Boost: `title^4`, `document_code^3`, `tags^2`, `description^1.5`, `content^1`.
- Highlight cho `title`, `description`, `content`.
- Facets tối thiểu: category, department, document type, tags, created date range.
- Suggestions dùng completion suggester hoặc prefix query trên `title`, `document_code`, `tags`.

---

## 10. Logging Rules

| Action | Log table |
|--------|-----------|
| Login/logout | `audit_logs` |
| Create/update/delete/archive/restore/move/permanent delete document | `audit_logs` |
| Update ACL/tags/category/metadata | `audit_logs` |
| Upload/restore version | `audit_logs` |
| Preview/download/version download | `access_logs` |
| Denied preview/download/detail due to ACL | `access_logs` |
| Search/suggestions | `search_logs` |
| Retry extraction/indexing | `audit_logs` |
| Batch upload/delete/move | `audit_logs` per affected document |
| Scheduled trash purge | `audit_logs` hoặc maintenance log |

Dashboard tổng hợp từ `documents`, `document_versions`, `users`, `audit_logs`, `access_logs`, `search_logs`, `document_contents` và Elasticsearch sync metadata. Dung lượng lưu trữ lấy từ MySQL để bao gồm cả active/trash/version theo policy, không lấy từ Elasticsearch.
