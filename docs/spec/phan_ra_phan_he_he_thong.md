# Phân Rã Phân Hệ Hệ Thống — DMS

> Mô tả cách hệ thống DMS được phân rã thành các phân hệ (module/subsystem) và quan hệ phụ thuộc giữa chúng.

---

## Tổng quan phân hệ

Hệ thống DMS được chia thành **5 phân hệ chính**:

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                          HỆ THỐNG DMS                                  │
│                                                                         │
│  ┌──────────────┐  ┌──────────────────┐  ┌──────────────────────────┐  │
│  │  PH1:        │  │  PH2:            │  │  PH3:                    │  │
│  │  IDENTITY    │  │  DOCUMENT MGMT   │  │  SEARCH ENGINE           │  │
│  │  (Người dùng │  │  (Quản lý tài    │  │  (Tìm kiếm full-text)   │  │
│  │  & Phân quyền│  │   liệu - Core)   │  │                          │  │
│  └──────┬───────┘  └──────┬───────────┘  └──────────┬───────────────┘  │
│         │                 │                          │                   │
│  ┌──────┴───────┐  ┌──────┴───────────┐                                │
│  │  PH4:        │  │  PH5:            │                                │
│  │  MASTER DATA │  │  DASHBOARD &     │                                │
│  │  (Danh mục,  │  │  ANALYTICS       │                                │
│  │  Phòng ban,  │  │  (Thống kê)      │                                │
│  │  Tags)       │  │                   │                                │
│  └──────────────┘  └──────────────────┘                                │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## PH1: Identity — Quản lý Người dùng & Phân quyền

### Mô tả
Quản lý xác thực (authentication) và phân quyền (authorization) cho toàn bộ hệ thống.

### Entities
| Entity | Mô tả |
|--------|-------|
| `User` | Thông tin người dùng (name, email, role, department, status) |
| `RefreshToken` | Token làm mới phiên đăng nhập |

### Chức năng chính
- Đăng nhập / Đăng xuất (JWT + Refresh Token)
- Quản lý user (Admin CRUD)
- Xem / Sửa profile cá nhân
- Phân quyền RBAC (ADMIN, USER)

### API Endpoints
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/auth/login` | Đăng nhập |
| POST | `/auth/register` | Admin tạo tài khoản |
| POST | `/auth/refresh` | Refresh token |
| POST | `/auth/logout` | Đăng xuất |
| GET | `/users/me` | Xem profile |
| PUT | `/users/me` | Sửa profile |
| GET/POST/PUT/DELETE | `/users`, `/users/{id}` | Admin quản lý user |

---

## PH2: Document Management — Quản lý Tài liệu (Core Domain)

### Mô tả
Phân hệ cốt lõi — quản lý toàn bộ vòng đời tài liệu: upload → xử lý → lưu trữ → preview → download.

### Entities
| Entity | Mô tả |
|--------|-------|
| `Document` | Metadata tài liệu (title, slug, file info, status, counters) |
| `DocumentContent` | Nội dung text đã trích xuất từ file (tách bảng riêng vì data lớn) |
| `DocumentVersion` | Lịch sử phiên bản file |

### Chức năng chính
- Upload tài liệu (multipart/form-data, max 50MB)
- Trích xuất nội dung file (Content Extraction Pipeline)
- Cập nhật metadata tài liệu
- Xóa tài liệu (soft delete)
- Preview tài liệu (PDF stream, convert Word/Excel → PDF)
- Download file gốc
- Quản lý phiên bản (upload version mới, xem lịch sử)

### API Endpoints
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/documents` | Upload tài liệu |
| GET | `/documents` | Danh sách (pagination, filters) |
| GET | `/documents/{id}` | Chi tiết tài liệu |
| PUT | `/documents/{id}` | Cập nhật metadata |
| DELETE | `/documents/{id}` | Xóa (soft) |
| GET | `/documents/{id}/preview` | Preview |
| GET | `/documents/{id}/download` | Download |
| GET | `/documents/{id}/versions` | Lịch sử phiên bản |
| POST | `/documents/{id}/versions` | Upload version mới |

### Sub-components

```text
Document Management
  ├── FileUploadHandler          — Validate file type, size
  ├── StorageService             — Lưu/xóa file (Local / S3)
  ├── ContentExtractorService    — Trích xuất text từ file
  │     ├── PdfTextExtractor     (Apache PDFBox)
  │     ├── DocxExtractor        (Apache POI - XWPF)
  │     ├── DocExtractor         (Apache POI - HWPF)
  │     ├── ExcelExtractor       (Apache POI)
  │     └── ImageOcrExtractor    (Tesseract - Phase 2)
  ├── PreviewService             — Convert & stream file preview
  └── VersionService             — Quản lý phiên bản
```

---

## PH3: Search Engine — Tìm kiếm Full-text (Core Feature)

### Mô tả
Cho phép User tìm kiếm tài liệu theo từ khóa, tìm trong tiêu đề + mô tả + nội dung file đã trích xuất.

### Chức năng chính
- Full-text search (Natural Language Mode / Boolean Mode)
- Filter kết quả theo: danh mục, phòng ban, loại file, tags, khoảng thời gian
- Sắp xếp: relevance, date, views, downloads
- Highlight matched text (đánh dấu vị trí match trong kết quả)
- Tính toán relevance score

### Phân pha

| Phase | Search Engine | Mô tả |
|-------|---------------|-------|
| Phase 1 | MySQL FULLTEXT Index | MATCH AGAINST, đơn giản, < 10k docs |
| Phase 2 | Elasticsearch | Fuzzy, Synonym, Faceted, Vietnamese Analyzer |

### API Endpoints
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/documents/search` | Tìm kiếm full-text với filters |

### Sub-components

```text
Search Engine
  ├── SearchService              — Xây dựng & thực thi query
  ├── SearchEngine (Interface)   — Abstraction cho search engine
  │     ├── MySqlSearchEngine    (Phase 1)
  │     └── ElasticsearchEngine  (Phase 2)
  └── SearchIndexService         — Đồng bộ index khi create/update/delete
```

---

## PH4: Master Data — Dữ liệu danh mục

### Mô tả
Quản lý dữ liệu danh mục dùng chung cho toàn hệ thống: danh mục tài liệu, phòng ban, tags.

### Entities
| Entity | Mô tả |
|--------|-------|
| `Category` | Danh mục phân loại tài liệu (hỗ trợ cây phân cấp parent-child) |
| `Department` | Phòng ban sở hữu tài liệu |
| `Tag` | Nhãn gắn cho tài liệu (N:N qua `document_tags`) |

### Chức năng chính
- CRUD Category (hỗ trợ cây phân cấp, sắp xếp thứ tự)
- CRUD Department
- CRUD Tag (slug tự động sinh từ name)
- Soft delete cho tất cả entity

### API Endpoints
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET/POST/PUT/DELETE | `/categories`, `/categories/{id}` | Quản lý danh mục |
| GET/POST/PUT/DELETE | `/departments`, `/departments/{id}` | Quản lý phòng ban |
| GET/POST/PUT/DELETE | `/tags`, `/tags/{id}` | Quản lý tags |

---

## PH5: Dashboard & Analytics — Thống kê

### Mô tả
Dashboard thống kê tổng quan cho Admin.

### Chức năng chính
- Tổng số tài liệu, users, categories, departments
- Phân bổ tài liệu theo trạng thái (INDEXED, PROCESSING, EXTRACTION_FAILED)
- Phân bổ tài liệu theo loại file (PDF, DOCX, XLSX...)
- Top tài liệu xem nhiều nhất
- Top tài liệu tải nhiều nhất
- Tài liệu upload gần đây

### API Endpoints
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/admin/dashboard` | Thống kê tổng quan |

---

## Dependency Graph — Quan hệ phụ thuộc

```text
                    ┌──────────────┐
                    │  PH1:        │
                    │  IDENTITY    │
                    └──────┬───────┘
                           │ (User là owner/uploader)
                           ▼
┌──────────────┐   ┌──────────────────┐   ┌──────────────────┐
│  PH4:        │──→│  PH2:            │←──│  PH3:            │
│  MASTER DATA │   │  DOCUMENT MGMT   │   │  SEARCH ENGINE   │
│ (Category,   │   │  (Core Domain)   │   │  (Index & Query) │
│  Dept, Tag)  │   └──────┬───────────┘   └──────────────────┘
└──────────────┘          │
                          ▼
                   ┌──────────────────┐
                   │  PH5:            │
                   │  DASHBOARD       │
                   │  (Aggregation)   │
                   └──────────────────┘
```

### Quy tắc phụ thuộc

| Từ | Đến | Quan hệ |
|----|-----|---------|
| Document → | Identity | Document thuộc về User (uploaded_by) |
| Document → | Master Data | Document gắn với Category, Department, Tags |
| Search → | Document | Search index nội dung & metadata của Document |
| Dashboard → | Document | Aggregate thống kê từ Document data |
| Dashboard → | Identity | Đếm số users |
| All → | Identity | Mọi module đều cần User để xác thực |

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
└── common/                      ← Shared utilities
    ├── config/
    ├── exception/
    ├── security/
    └── dto/
```
