# Thiết Kế Chi Tiết — DMS

> Tài liệu thiết kế chi tiết hệ thống: API conventions, database schema, và chi tiết từng endpoint.

---

## 1. API Conventions

### Base URL & Versioning

```
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
  "data": { ... }
}
```

**Pagination Response:**
```json
{
  "success": true,
  "data": {
    "content": [ { ... } ],
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
| `EXTRACTION_FAILED` | Trích xuất nội dung file thất bại |
| `INVALID_CREDENTIALS` | Email hoặc mật khẩu sai |
| `TOKEN_EXPIRED` | JWT đã hết hạn |
| `ACCESS_DENIED` | Không có quyền truy cập |

### Supported File Types

| MIME Type | Extension | Trích xuất |
|-----------|-----------|:---:|
| `application/pdf` | `.pdf` | ✅ PDFBox |
| `application/msword` | `.doc` | ✅ POI (HWPF) |
| `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | `.docx` | ✅ POI (XWPF) |
| `application/vnd.ms-excel` | `.xls` | ✅ POI |
| `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | `.xlsx` | ✅ POI |
| `image/jpeg` | `.jpg` | 🔮 OCR (Phase 2) |
| `image/png` | `.png` | 🔮 OCR (Phase 2) |
| `image/tiff` | `.tiff` | 🔮 OCR (Phase 2) |

---

## 2. Database Schema

### Entity Relationship Diagram

```text
[users] 1──N [documents] (uploaded_by)
[categories] 1──N [documents]
[departments] 1──N [documents]

[documents] 1──N [document_versions]
[documents] N──N [tags] (via document_tags)
[documents] 1──1 [document_contents] (extracted text)

[users] 1──N [search_histories]
```

### Base Conventions

Tất cả entity chính đều có:
- `id` (BIGINT, PK, AUTO_INCREMENT)
- `created_at` (TIMESTAMP, NOT NULL)
- `updated_at` (TIMESTAMP, NULLABLE)

Soft Delete: `deleted_at` (TIMESTAMP, NULLABLE) cho User, Document, Category, Department, Tag.

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
| icon | VARCHAR(100) | NULLABLE | Emoji / icon class |
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
| department_id | BIGINT | FK → departments, NULLABLE | |
| uploaded_by | BIGINT | FK → users, NOT NULL | |
| file_name | VARCHAR(255) | NOT NULL | Tên file gốc |
| file_type | VARCHAR(20) | NOT NULL | PDF, DOCX... |
| mime_type | VARCHAR(100) | NOT NULL | |
| file_size | BIGINT | NOT NULL | Bytes |
| storage_path | VARCHAR(500) | NOT NULL | Đường dẫn lưu trữ |
| thumbnail_path | VARCHAR(500) | NULLABLE | |
| page_count | INT | NULLABLE | |
| document_code | VARCHAR(100) | NULLABLE, UNIQUE | Mã tài liệu |
| version_number | VARCHAR(20) | DEFAULT '1.0' | |
| status | VARCHAR(30) | DEFAULT 'PROCESSING' | PROCESSING / INDEXED / EXTRACTION_FAILED |
| is_public | BOOLEAN | DEFAULT true | |
| view_count | INT | DEFAULT 0 | |
| download_count | INT | DEFAULT 0 | |
| effective_date | DATE | NULLABLE | |
| expiry_date | DATE | NULLABLE | |
| created_at | TIMESTAMP | NOT NULL | |
| updated_at | TIMESTAMP | NULLABLE | |
| deleted_at | TIMESTAMP | NULLABLE | |

### Table: `document_contents`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | BIGINT | PK, AI | |
| document_id | BIGINT | FK → documents, UNIQUE | 1:1 |
| extracted_text | LONGTEXT | NULLABLE | Nội dung text trích xuất |
| extraction_method | VARCHAR(50) | NOT NULL | TIKA / OCR / MANUAL |
| language | VARCHAR(10) | NULLABLE | vi, en... |
| extraction_status | VARCHAR(30) | NOT NULL | SUCCESS / PARTIAL / FAILED |
| error_message | TEXT | NULLABLE | |
| extracted_at | TIMESTAMP | NOT NULL | |

### Table: `document_versions`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | BIGINT | PK, AI | |
| document_id | BIGINT | FK → documents, NOT NULL | |
| version_number | VARCHAR(20) | NOT NULL | |
| file_name | VARCHAR(255) | NOT NULL | |
| file_size | BIGINT | NOT NULL | |
| storage_path | VARCHAR(500) | NOT NULL | |
| changelog | TEXT | NULLABLE | |
| uploaded_by | BIGINT | FK → users, NOT NULL | |
| created_at | TIMESTAMP | NOT NULL | |

### Table: `document_tags` (N:N)

| Column | Type | Constraints |
|--------|------|-------------|
| document_id | BIGINT | FK → documents, NOT NULL |
| tag_id | BIGINT | FK → tags, NOT NULL |
| | | Composite PK (document_id, tag_id) |

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
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_documents_file_type ON documents(file_type);
CREATE INDEX idx_documents_effective_date ON documents(effective_date);
CREATE INDEX idx_documents_created_at ON documents(created_at);
CREATE INDEX idx_document_versions_doc ON document_versions(document_id);
```

### Full-Text Indexes (Phase 1)
```sql
CREATE FULLTEXT INDEX ft_documents_title ON documents(title);
CREATE FULLTEXT INDEX ft_document_contents_text ON document_contents(extracted_text);
CREATE FULLTEXT INDEX ft_documents_title_desc ON documents(title, description);
```

### Composite Indexes
```sql
CREATE INDEX idx_documents_cat_status_date ON documents(category_id, status, created_at);
CREATE INDEX idx_documents_dept_type ON documents(department_id, file_type);
```

---

## 4. API Endpoints Chi Tiết

> Chi tiết request/response cho từng endpoint xem tại [API_SPEC.md](./API_SPEC.md)

### Authentication

| # | Method | Endpoint | Auth | Description |
|---|--------|----------|------|-------------|
| 1 | POST | `/auth/login` | 🔓 | Đăng nhập |
| 2 | POST | `/auth/register` | 👑 | Admin tạo tài khoản |
| 3 | POST | `/auth/refresh` | 🔓 | Refresh Access Token |
| 4 | POST | `/auth/logout` | 🔒 | Đăng xuất |

### User Management

| # | Method | Endpoint | Auth | Description |
|---|--------|----------|------|-------------|
| 5 | GET | `/users/me` | 🔒 | Xem profile |
| 6 | PUT | `/users/me` | 🔒 | Cập nhật profile |
| 7 | GET | `/users` | 👑 | Danh sách users |
| 8 | GET | `/users/{id}` | 👑 | Chi tiết user |
| 9 | POST | `/users` | 👑 | Tạo user |
| 10 | PUT | `/users/{id}` | 👑 | Cập nhật user |
| 11 | DELETE | `/users/{id}` | 👑 | Xóa user (soft) |

### Document Management

| # | Method | Endpoint | Auth | Description |
|---|--------|----------|------|-------------|
| 12 | POST | `/documents` | 👑 | Upload tài liệu |
| 13 | GET | `/documents` | 🔒 | Danh sách tài liệu |
| 14 | GET | `/documents/{id}` | 🔒 | Chi tiết tài liệu |
| 15 | PUT | `/documents/{id}` | 👑 | Cập nhật metadata |
| 16 | DELETE | `/documents/{id}` | 👑 | Xóa tài liệu (soft) |
| 17 | GET | `/documents/{id}/preview` | 🔒 | Preview tài liệu |
| 18 | GET | `/documents/{id}/download` | 🔒 | Tải tài liệu |
| 19 | GET | `/documents/{id}/versions` | 🔒 | Lịch sử phiên bản |
| 20 | POST | `/documents/{id}/versions` | 👑 | Upload phiên bản mới |
| 21 | GET | `/documents/{id}/versions/{vId}/download` | 🔒 | Tải phiên bản cũ |

### Search

| # | Method | Endpoint | Auth | Description |
|---|--------|----------|------|-------------|
| 22 | GET | `/documents/search` | 🔒 | Tìm kiếm full-text |

### Master Data

| # | Method | Endpoint | Auth | Description |
|---|--------|----------|------|-------------|
| 23–27 | CRUD | `/categories`, `/categories/{id}` | 🔒/👑 | Danh mục |
| 28–32 | CRUD | `/departments`, `/departments/{id}` | 🔒/👑 | Phòng ban |
| 33–37 | CRUD | `/tags`, `/tags/{id}` | 🔒/👑 | Tags |

### Dashboard

| # | Method | Endpoint | Auth | Description |
|---|--------|----------|------|-------------|
| 38 | GET | `/admin/dashboard` | 👑 | Thống kê tổng quan |

> Ký hiệu: 🔓 Public | 🔒 Authenticated | 👑 Admin only

---

## 5. Tài liệu liên quan

| Tài liệu | Đường dẫn |
|-----------|-----------|
| API chi tiết (Request/Response) | [API_SPEC.md](./API_SPEC.md) |
| Database schema đầy đủ | [DATABASE.md](./DATABASE.md) |
| System Architecture | [sa/sa.md](./sa/sa.md) |
| Tech Stack | [sa/techstack.md](./sa/techstack.md) |
| Server & Deployment | [sa/server.md](./sa/server.md) |
| Đặc tả yêu cầu | [spec/specs.md](./spec/specs.md) |
