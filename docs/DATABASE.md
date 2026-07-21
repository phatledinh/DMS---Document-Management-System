# Database Schema — Hệ Thống Quản Lý Tài Liệu Nội Bộ (DMS)

> Schema thiết kế cho hệ thống Quản lý & Tìm kiếm Tài liệu Doanh nghiệp.
> Sử dụng MySQL. Update file này khi có thay đổi schema.

---

## Entity Relationship Diagram

```text
[users] 1──N [documents] (uploaded_by)
[categories] 1──N [documents]
[departments] 1──N [documents]

[documents] 1──N [document_versions]
[documents] N──N [tags] (via document_tags)
[documents] 1──1 [document_contents] (extracted text)

[users] 1──N [search_histories]
```

---

## 0. Base Conventions (Audit & Soft Delete)

### BaseEntity

Tất cả entity chính đều kế thừa `BaseEntity`:
- `id` (BIGINT, PK, AUTO_INCREMENT)
- `created_at` (TIMESTAMP, NOT NULL)
- `updated_at` (TIMESTAMP, NULLABLE)

### Soft Delete Strategy

| Entity | Soft Delete? | Lý do |
|--------|:---:|--------|
| Category | ✅ `deleted_at` | Cần giữ lại cho tài liệu cũ |
| Department | ✅ `deleted_at` | Cần giữ lại cho tài liệu cũ |
| Tag | ✅ `deleted_at` | Cần giữ lại cho tài liệu cũ |
| Document | ✅ `deleted_at` | Không xóa vĩnh viễn, có thể restore |
| User | ✅ `deleted_at` | Giữ lại lịch sử hoạt động |
| Document Version | ❌ | Hard delete khi cleanup |

---

## 1. Identity Domain (Người dùng & Phân quyền)

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
| user_id | BIGINT | FK → users(id), NOT NULL | |
| expires_at | TIMESTAMP | NOT NULL | Thời điểm hết hạn |
| revoked | BOOLEAN | NOT NULL, DEFAULT false | Đã thu hồi chưa |
| device_info | VARCHAR(255) | NULLABLE | User-Agent |
| ip_address | VARCHAR(45) | NULLABLE | IPv4/IPv6 |

---

## 2. Document Domain (Tài liệu — Core)

### categories
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | BIGINT | PK, AUTO_INCREMENT | |
| parent_id | BIGINT | FK → categories(id), NULLABLE | Hỗ trợ cây phân cấp |
| name | VARCHAR(255) | NOT NULL | Tên danh mục |
| slug | VARCHAR(255) | NOT NULL, UNIQUE | URL-friendly |
| description | TEXT | NULLABLE | Mô tả |
| icon | VARCHAR(100) | NULLABLE | Icon class hoặc emoji |
| sort_order | INT | NOT NULL, DEFAULT 0 | Thứ tự hiển thị |
| is_active | BOOLEAN | NOT NULL, DEFAULT true | |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | |
| updated_at | TIMESTAMP | NULLABLE, ON UPDATE CURRENT_TIMESTAMP | |
| deleted_at | TIMESTAMP | NULLABLE | Soft delete |

**Ví dụ cây danh mục:**
```text
Quy trình ISO
  ├── ISO 9001 - Quản lý chất lượng
  ├── ISO 14001 - Môi trường
  └── ISO 45001 - An toàn lao động
Biểu mẫu
  ├── Biểu mẫu nhân sự
  ├── Biểu mẫu kế toán
  └── Biểu mẫu kỹ thuật
SOP (Quy trình vận hành)
Hướng dẫn công việc
Tài liệu đào tạo
```

### departments
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | BIGINT | PK, AUTO_INCREMENT | |
| name | VARCHAR(255) | NOT NULL | Tên phòng ban |
| code | VARCHAR(50) | NOT NULL, UNIQUE | Mã phòng ban (HR, IT, FIN...) |
| description | TEXT | NULLABLE | |
| is_active | BOOLEAN | NOT NULL, DEFAULT true | |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | |
| updated_at | TIMESTAMP | NULLABLE, ON UPDATE CURRENT_TIMESTAMP | |
| deleted_at | TIMESTAMP | NULLABLE | Soft delete |

### tags
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | BIGINT | PK, AUTO_INCREMENT | |
| name | VARCHAR(100) | NOT NULL, UNIQUE | Tên tag |
| slug | VARCHAR(100) | NOT NULL, UNIQUE | URL-friendly |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | |
| updated_at | TIMESTAMP | NULLABLE, ON UPDATE CURRENT_TIMESTAMP | |
| deleted_at | TIMESTAMP | NULLABLE | Soft delete |

### documents ⭐ (Bảng chính)
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | BIGINT | PK, AUTO_INCREMENT | |
| title | VARCHAR(500) | NOT NULL | Tiêu đề tài liệu |
| slug | VARCHAR(500) | NOT NULL, UNIQUE | URL-friendly |
| description | TEXT | NULLABLE | Mô tả ngắn |
| category_id | BIGINT | FK → categories(id), NOT NULL | Danh mục |
| department_id | BIGINT | FK → departments(id), NULLABLE | Phòng ban sở hữu |
| uploaded_by | BIGINT | FK → users(id), NOT NULL | Admin upload |
| file_name | VARCHAR(255) | NOT NULL | Tên file gốc |
| file_type | VARCHAR(20) | NOT NULL | PDF, DOC, DOCX, XLS, XLSX, JPG, PNG, TIFF |
| mime_type | VARCHAR(100) | NOT NULL | e.g. `application/pdf` |
| file_size | BIGINT | NOT NULL | Kích thước file (bytes) |
| storage_path | VARCHAR(500) | NOT NULL | Đường dẫn lưu trữ trên disk/S3 |
| thumbnail_path | VARCHAR(500) | NULLABLE | Đường dẫn thumbnail |
| page_count | INT | NULLABLE | Số trang (nếu áp dụng) |
| document_code | VARCHAR(100) | NULLABLE, UNIQUE | Mã tài liệu doanh nghiệp (VD: SOP-HR-001) |
| version_number | VARCHAR(20) | NOT NULL, DEFAULT '1.0' | Số phiên bản hiện tại |
| status | VARCHAR(30) | NOT NULL, DEFAULT 'PROCESSING' | PROCESSING, INDEXED, EXTRACTION_FAILED |
| is_public | BOOLEAN | NOT NULL, DEFAULT true | Tất cả user đều xem được? |
| view_count | INT | NOT NULL, DEFAULT 0 | Số lượt xem |
| download_count | INT | NOT NULL, DEFAULT 0 | Số lượt tải |
| effective_date | DATE | NULLABLE | Ngày hiệu lực |
| expiry_date | DATE | NULLABLE | Ngày hết hiệu lực |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | |
| updated_at | TIMESTAMP | NULLABLE, ON UPDATE CURRENT_TIMESTAMP | |
| deleted_at | TIMESTAMP | NULLABLE | Soft delete |

### document_contents (Nội dung trích xuất — tách bảng riêng vì data lớn)
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | BIGINT | PK, AUTO_INCREMENT | |
| document_id | BIGINT | FK → documents(id), NOT NULL, UNIQUE | 1:1 với documents |
| extracted_text | LONGTEXT | NULLABLE | Nội dung text đã trích xuất từ file |
| extraction_method | VARCHAR(50) | NOT NULL | TIKA, OCR, MANUAL |
| language | VARCHAR(10) | NULLABLE | Ngôn ngữ phát hiện (vi, en...) |
| extraction_status | VARCHAR(30) | NOT NULL | SUCCESS, PARTIAL, FAILED |
| error_message | TEXT | NULLABLE | Lỗi khi trích xuất (nếu có) |
| extracted_at | TIMESTAMP | NOT NULL | Thời điểm trích xuất |

> **Lý do tách bảng**: `extracted_text` có thể rất lớn (hàng MB cho PDF dài). Tách riêng để tránh ảnh hưởng performance khi query metadata `documents`. Chỉ JOIN khi cần search full-text.

### document_versions (Lịch sử phiên bản)
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | BIGINT | PK, AUTO_INCREMENT | |
| document_id | BIGINT | FK → documents(id), NOT NULL | |
| version_number | VARCHAR(20) | NOT NULL | e.g. 1.0, 1.1, 2.0 |
| file_name | VARCHAR(255) | NOT NULL | Tên file của phiên bản này |
| file_size | BIGINT | NOT NULL | Kích thước (bytes) |
| storage_path | VARCHAR(500) | NOT NULL | Đường dẫn lưu trữ |
| changelog | TEXT | NULLABLE | Ghi chú thay đổi |
| uploaded_by | BIGINT | FK → users(id), NOT NULL | Ai upload phiên bản này |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | |

### document_tags (Bảng trung gian N:N)
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| document_id | BIGINT | FK → documents(id), NOT NULL | |
| tag_id | BIGINT | FK → tags(id), NOT NULL | |
| | | Composite PK (document_id, tag_id) | |



## 4. Search Index (Elasticsearch — Phase 2)

> Phase 1 sử dụng MySQL FULLTEXT Index. Phase 2 migrate sang Elasticsearch.

### Elasticsearch Document Mapping

```json
{
  "mappings": {
    "properties": {
      "id":              { "type": "long" },
      "title":           { "type": "text", "analyzer": "vietnamese_analyzer" },
      "description":     { "type": "text", "analyzer": "vietnamese_analyzer" },
      "extracted_text":  { "type": "text", "analyzer": "vietnamese_analyzer" },
      "document_code":   { "type": "keyword" },
      "file_name":       { "type": "text", "fields": { "keyword": { "type": "keyword" } } },
      "file_type":       { "type": "keyword" },
      "category_id":     { "type": "long" },
      "category_name":   { "type": "keyword" },
      "department_id":   { "type": "long" },
      "department_name": { "type": "keyword" },
      "tags":            { "type": "keyword" },
      "uploaded_by_name":{ "type": "keyword" },
      "version_number":  { "type": "keyword" },
      "page_count":      { "type": "integer" },
      "file_size":       { "type": "long" },
      "view_count":      { "type": "integer" },
      "download_count":  { "type": "integer" },
      "effective_date":  { "type": "date" },
      "expiry_date":     { "type": "date" },
      "created_at":      { "type": "date" },
      "updated_at":      { "type": "date" },
      "suggest":         { "type": "completion" }
    }
  }
}
```

---

## 5. Database Indexes

### Unique Indexes (B-Tree)
```sql
-- Identity
CREATE UNIQUE INDEX idx_users_email ON users(email);

-- Document
CREATE UNIQUE INDEX idx_documents_slug ON documents(slug);
CREATE UNIQUE INDEX idx_documents_code ON documents(document_code);
CREATE UNIQUE INDEX idx_categories_slug ON categories(slug);
CREATE UNIQUE INDEX idx_departments_code ON departments(code);
CREATE UNIQUE INDEX idx_tags_slug ON tags(slug);
CREATE UNIQUE INDEX idx_document_contents_doc ON document_contents(document_id);
```

### Performance Indexes (B-Tree)
```sql
-- Document queries
CREATE INDEX idx_documents_category ON documents(category_id);
CREATE INDEX idx_documents_department ON documents(department_id);
CREATE INDEX idx_documents_uploaded_by ON documents(uploaded_by);
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_documents_file_type ON documents(file_type);
CREATE INDEX idx_documents_effective_date ON documents(effective_date);
CREATE INDEX idx_documents_created_at ON documents(created_at);
CREATE INDEX idx_document_versions_doc ON document_versions(document_id);
```

### Full-Text Indexes (Phase 1 — MySQL)
```sql
-- Search trên tiêu đề tài liệu
CREATE FULLTEXT INDEX ft_documents_title ON documents(title);

-- Search trên nội dung trích xuất (bảng riêng)
CREATE FULLTEXT INDEX ft_document_contents_text ON document_contents(extracted_text);

-- Combined search (title + description)
CREATE FULLTEXT INDEX ft_documents_title_desc ON documents(title, description);
```

### Composite Indexes
```sql
-- Lọc tài liệu theo category + status + ngày tạo (query phổ biến nhất)
CREATE INDEX idx_documents_cat_status_date ON documents(category_id, status, created_at);

-- Lọc tài liệu theo department + file_type
CREATE INDEX idx_documents_dept_type ON documents(department_id, file_type);

-- Access log theo document + thời gian (analytics)
CREATE INDEX idx_access_logs_doc_time ON access_logs(document_id, accessed_at);
```

---

## 6. Sample Queries (Tham khảo)

### Search tài liệu theo từ khóa (Phase 1 — MySQL Full-text)
```sql
-- Tìm trong tiêu đề
SELECT d.*, MATCH(d.title) AGAINST ('quy trình ISO' IN NATURAL LANGUAGE MODE) AS relevance
FROM documents d
WHERE d.deleted_at IS NULL AND d.status = 'INDEXED'
ORDER BY relevance DESC
LIMIT 20 OFFSET 0;

-- Tìm trong nội dung (JOIN bảng content)
SELECT d.*, MATCH(dc.extracted_text) AGAINST ('an toàn lao động' IN BOOLEAN MODE) AS relevance
FROM documents d
INNER JOIN document_contents dc ON dc.document_id = d.id
WHERE d.deleted_at IS NULL
  AND d.status = 'INDEXED'
  AND d.category_id = 5
  AND dc.extraction_status = 'SUCCESS'
ORDER BY relevance DESC
LIMIT 20 OFFSET 0;
```