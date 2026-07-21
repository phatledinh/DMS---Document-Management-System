# API Specification — Hệ Thống Quản Lý Tài Liệu Nội Bộ (DMS)

> API Documentation cho hệ thống Quản lý & Tìm kiếm Tài liệu Doanh nghiệp.
> Designed for OpenAPI 3 / Swagger integration.
>
> Ký hiệu: 🔓 Public (không cần JWT) | 🔒 Authenticated (cần JWT) | 👑 Admin only

---

## 1. Global Standards & Conventions

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
| `400` | Bad Request | Validation errors, file type không hợp lệ, file quá lớn |
| `401` | Unauthorized | Missing hoặc invalid JWT |
| `403` | Forbidden | JWT valid nhưng không đủ quyền (User gọi Admin-only API) |
| `404` | Not Found | Resource không tồn tại |
| `409` | Conflict | Duplicate data (email, document_code, slug...) |
| `413` | Payload Too Large | File upload vượt quá giới hạn (50MB) |
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

**Failure Response (Explicit Error Code):**
```json
{
  "success": false,
  "code": "DOCUMENT_NOT_FOUND",
  "message": "Document with id 123 not found",
  "data": null
}
```

**Common Error Codes:**
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

### RESTful Rules
- **Master Data** (Category, Department, Tag): Full CRUD (`GET`, `POST`, `PUT`, `DELETE`).
- **Document**: Full CRUD + các action bổ sung (`preview`, `download`, `versions`).
- **User**: Admin quản lý CRUD. User chỉ xem/sửa profile mình.

### Supported File Types
| MIME Type | Extension | Trích xuất nội dung |
|-----------|-----------|:---:|
| `application/pdf` | `.pdf` | ✅ (PDFBox / OCR Phase 2) |
| `application/msword` | `.doc` | ✅ (Apache POI - HWPF) |
| `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | `.docx` | ✅ (Apache POI - XWPF) |
| `application/vnd.ms-excel` | `.xls` | ✅ (Apache POI) |
| `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | `.xlsx` | ✅ (Apache POI) |
| `image/jpeg` | `.jpg` | 🔮 OCR (Phase 2) |
| `image/png` | `.png` | 🔮 OCR (Phase 2) |
| `image/tiff` | `.tiff` | 🔮 OCR (Phase 2) |

---

## 2. Authentication & Identity

### Auth (JWT & Refresh Token via HttpOnly Cookie)

#### `POST /auth/login` 🔓
Đăng nhập, trả Access Token trong JSON và Refresh Token trong HttpOnly Cookie.

**Request Body:**
```json
{
  "email": "user@company.com",
  "password": "password123"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": 1,
      "name": "Nguyễn Văn A",
      "email": "user@company.com",
      "role": "USER",
      "department": { "id": 1, "name": "Phòng Kỹ thuật" },
      "avatar": null
    }
  }
}
```

**Response Headers:**
```http
Set-Cookie: refresh_token=eyJ...; HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth; Max-Age=604800
```

---

#### `POST /auth/register` 👑
Admin tạo tài khoản cho nhân viên. Không mở public (tài liệu nội bộ).

**Request Body:**
```json
{
  "name": "Trần Thị B",
  "email": "tranthib@company.com",
  "password": "securepass123",
  "phone": "0912345678",
  "role": "USER",
  "departmentId": 2
}
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "User created successfully",
  "data": {
    "id": 5,
    "name": "Trần Thị B",
    "email": "tranthib@company.com",
    "role": "USER"
  }
}
```

---

#### `POST /auth/refresh` 🔓
Đọc Refresh Token từ HttpOnly Cookie, cấp Access Token mới.

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

---

#### `POST /auth/logout` 🔒
Thu hồi Refresh Token, xóa HttpOnly Cookie.

**Success Response (200):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

### Current User

#### `GET /users/me` 🔒
Lấy thông tin profile của user đang đăng nhập.

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Nguyễn Văn A",
    "email": "user@company.com",
    "phone": "0901234567",
    "avatar": "https://cdn.example.com/avatars/1.jpg",
    "role": "USER",
    "department": { "id": 1, "name": "Phòng Kỹ thuật", "code": "IT" },
    "status": "ACTIVE",
    "lastLogin": "2026-07-21T10:00:00",
    "createdAt": "2026-01-15T08:30:00"
  }
}
```

---

#### `PUT /users/me` 🔒
User cập nhật profile cá nhân (tên, phone, avatar). Không được tự đổi role.

**Request Body:**
```json
{
  "name": "Nguyễn Văn A (updated)",
  "phone": "0987654321"
}
```

---

### User Management (Admin)

- `GET /users` 👑 — Danh sách users (có pagination, filter theo role, department, status)
  - *Query Params:* `role`, `departmentId`, `status`, `search`, `page`, `size`, `sort`
  - *Example:* `/users?role=USER&departmentId=1&status=ACTIVE&page=0&size=20`
- `GET /users/{id}` 👑 — Chi tiết 1 user
- `POST /users` 👑 — Tạo user mới (giống `/auth/register`)
- `PUT /users/{id}` 👑 — Cập nhật user (bao gồm đổi role, department, status)
- `DELETE /users/{id}` 👑 — Soft delete user

---

## 3. Document Management (Core)

### Documents — CRUD

#### `POST /documents` 👑
Admin upload tài liệu mới. Sử dụng `multipart/form-data`.

**Request (multipart/form-data):**
| Field | Type | Required | Description |
|-------|------|:---:|-------------|
| `file` | File | ✅ | File tài liệu (max 50MB) |
| `title` | String | ✅ | Tiêu đề tài liệu |
| `description` | String | ❌ | Mô tả ngắn |
| `categoryId` | Long | ✅ | ID danh mục |
| `departmentId` | Long | ❌ | ID phòng ban sở hữu |
| `documentCode` | String | ❌ | Mã tài liệu (VD: SOP-HR-001) |
| `tagIds` | Long[] | ❌ | Danh sách tag IDs |
| `isPublic` | Boolean | ❌ | Default: true |
| `effectiveDate` | Date | ❌ | Ngày hiệu lực |
| `expiryDate` | Date | ❌ | Ngày hết hiệu lực |

**Success Response (201):**
```json
{
  "success": true,
  "message": "Document uploaded successfully",
  "data": {
    "id": 42,
    "title": "Quy trình ISO 9001 - Quản lý chất lượng",
    "slug": "quy-trinh-iso-9001-quan-ly-chat-luong",
    "documentCode": "SOP-QA-001",
    "fileName": "ISO_9001_QA_Process.pdf",
    "fileType": "PDF",
    "fileSize": 2048576,
    "status": "PROCESSING",
    "versionNumber": "1.0",
    "category": { "id": 1, "name": "Quy trình ISO" },
    "department": { "id": 3, "name": "Phòng QA" },
    "tags": [
      { "id": 1, "name": "ISO" },
      { "id": 5, "name": "Chất lượng" }
    ],
    "uploadedBy": { "id": 1, "name": "Admin" },
    "createdAt": "2026-07-21T10:30:00"
  }
}
```

> **Lưu ý**: Sau khi upload, hệ thống sẽ tự động trích xuất nội dung file ở background. `status` ban đầu là `PROCESSING`, chuyển thành `INDEXED` khi hoàn tất hoặc `EXTRACTION_FAILED` nếu lỗi.

---

#### `GET /documents` 🔒
Danh sách tài liệu (có pagination, filtering, sorting).

**Query Params:**
| Param | Type | Description |
|-------|------|-------------|
| `categoryId` | Long | Lọc theo danh mục |
| `departmentId` | Long | Lọc theo phòng ban |
| `fileType` | String | Lọc theo loại file (PDF, DOCX, XLSX...) |
| `status` | String | Lọc theo trạng thái (PROCESSING, INDEXED, EXTRACTION_FAILED) |
| `tagIds` | Long[] | Lọc theo tags |
| `effectiveDateFrom` | Date | Lọc ngày hiệu lực từ |
| `effectiveDateTo` | Date | Lọc ngày hiệu lực đến |
| `sort` | String | Sắp xếp: `created_at_desc` (default), `created_at_asc`, `title_asc`, `view_count_desc`, `download_count_desc` |
| `page` | Int | Trang (default: 0) |
| `size` | Int | Kích thước trang (default: 20, max: 100) |

**Example:** `/documents?categoryId=1&fileType=PDF&sort=created_at_desc&page=0&size=20`

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "content": [
      {
        "id": 42,
        "title": "Quy trình ISO 9001 - Quản lý chất lượng",
        "slug": "quy-trinh-iso-9001-quan-ly-chat-luong",
        "documentCode": "SOP-QA-001",
        "fileType": "PDF",
        "fileSize": 2048576,
        "pageCount": 25,
        "status": "INDEXED",
        "versionNumber": "1.0",
        "viewCount": 150,
        "downloadCount": 45,
        "category": { "id": 1, "name": "Quy trình ISO" },
        "department": { "id": 3, "name": "Phòng QA" },
        "tags": [ { "id": 1, "name": "ISO" } ],
        "uploadedBy": { "id": 1, "name": "Admin" },
        "effectiveDate": "2026-01-01",
        "createdAt": "2026-07-21T10:30:00"
      }
    ],
    "page": 0,
    "size": 20,
    "totalElements": 150,
    "totalPages": 8
  }
}
```

---

#### `GET /documents/{id}` 🔒
Chi tiết tài liệu. Tự động tăng `view_count`.

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 42,
    "title": "Quy trình ISO 9001 - Quản lý chất lượng",
    "slug": "quy-trinh-iso-9001-quan-ly-chat-luong",
    "description": "Tài liệu mô tả quy trình quản lý chất lượng theo tiêu chuẩn ISO 9001:2015",
    "documentCode": "SOP-QA-001",
    "fileName": "ISO_9001_QA_Process.pdf",
    "fileType": "PDF",
    "mimeType": "application/pdf",
    "fileSize": 2048576,
    "pageCount": 25,
    "status": "INDEXED",
    "isPublic": true,
    "versionNumber": "1.0",
    "viewCount": 151,
    "downloadCount": 45,
    "category": { "id": 1, "name": "Quy trình ISO", "slug": "quy-trinh-iso" },
    "department": { "id": 3, "name": "Phòng QA", "code": "QA" },
    "tags": [
      { "id": 1, "name": "ISO", "slug": "iso" },
      { "id": 5, "name": "Chất lượng", "slug": "chat-luong" }
    ],
    "uploadedBy": { "id": 1, "name": "Admin" },
    "effectiveDate": "2026-01-01",
    "expiryDate": null,
    "previewUrl": "/api/v1/documents/42/preview",
    "downloadUrl": "/api/v1/documents/42/download",
    "createdAt": "2026-07-21T10:30:00",
    "updatedAt": null
  }
}
```

---

#### `PUT /documents/{id}` 👑
Admin cập nhật metadata tài liệu (không cập nhật file — dùng `POST /documents/{id}/versions` để upload phiên bản mới).

**Request Body:**
```json
{
  "title": "Quy trình ISO 9001:2015 - Quản lý chất lượng (Cập nhật)",
  "description": "Phiên bản cập nhật mới nhất",
  "categoryId": 1,
  "departmentId": 3,
  "documentCode": "SOP-QA-001",
  "tagIds": [1, 5, 8],
  "isPublic": true,
  "effectiveDate": "2026-07-01",
  "expiryDate": "2027-07-01"
}
```

---

#### `DELETE /documents/{id}` 👑
Soft delete tài liệu.

**Success Response (204):** No Content

---

### Document Preview & Download

#### `GET /documents/{id}/preview` 🔒
Preview tài liệu trực tiếp trên trình duyệt.

**Response:**
- **PDF** → Trả stream PDF trực tiếp (`Content-Type: application/pdf`)
- **DOCX/DOC** → Convert sang PDF rồi stream (`Content-Type: application/pdf`)
- **XLS/XLSX** → Convert sang PDF hoặc HTML (`Content-Type: application/pdf`)
- **Image** → Trả stream trực tiếp (`Content-Type: image/*`)

**Response Headers:**
```http
Content-Type: application/pdf
Content-Disposition: inline; filename="ISO_9001_QA_Process.pdf"
```

---

#### `GET /documents/{id}/download` 🔒
Tải file gốc. Tự động tăng `download_count`.

**Response Headers:**
```http
Content-Type: application/pdf
Content-Disposition: attachment; filename="ISO_9001_QA_Process.pdf"
Content-Length: 2048576
```

---

### Document Versions

#### `GET /documents/{id}/versions` 🔒
Lịch sử các phiên bản của tài liệu.

**Success Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 3,
      "versionNumber": "1.2",
      "fileName": "ISO_9001_v1.2.pdf",
      "fileSize": 2150000,
      "changelog": "Cập nhật quy trình kiểm tra chất lượng đầu vào",
      "uploadedBy": { "id": 1, "name": "Admin" },
      "createdAt": "2026-07-20T14:00:00"
    },
    {
      "id": 2,
      "versionNumber": "1.1",
      "fileName": "ISO_9001_v1.1.pdf",
      "fileSize": 2100000,
      "changelog": "Bổ sung phụ lục B",
      "uploadedBy": { "id": 1, "name": "Admin" },
      "createdAt": "2026-05-10T09:00:00"
    },
    {
      "id": 1,
      "versionNumber": "1.0",
      "fileName": "ISO_9001_QA_Process.pdf",
      "fileSize": 2048576,
      "changelog": "Phiên bản đầu tiên",
      "uploadedBy": { "id": 1, "name": "Admin" },
      "createdAt": "2026-01-15T08:30:00"
    }
  ]
}
```

---

#### `POST /documents/{id}/versions` 👑
Admin upload phiên bản mới cho tài liệu đã tồn tại. File cũ được lưu lại trong lịch sử.

**Request (multipart/form-data):**
| Field | Type | Required | Description |
|-------|------|:---:|-------------|
| `file` | File | ✅ | File phiên bản mới (max 50MB) |
| `versionNumber` | String | ✅ | Số phiên bản (e.g. "1.1", "2.0") |
| `changelog` | String | ❌ | Ghi chú thay đổi |

**Success Response (201):**
```json
{
  "success": true,
  "message": "New version uploaded successfully",
  "data": {
    "id": 4,
    "documentId": 42,
    "versionNumber": "1.3",
    "fileName": "ISO_9001_v1.3.pdf",
    "fileSize": 2200000,
    "changelog": "Cập nhật biểu mẫu kiểm tra",
    "uploadedBy": { "id": 1, "name": "Admin" },
    "createdAt": "2026-07-21T15:00:00"
  }
}
```

---

#### `GET /documents/{id}/versions/{versionId}/download` 🔒
Tải file của một phiên bản cụ thể.

**Response Headers:**
```http
Content-Type: application/pdf
Content-Disposition: attachment; filename="ISO_9001_v1.1.pdf"
```

---

## 4. Search Engine (Core Feature) ⭐

### Full-text Search

#### `GET /documents/search` 🔒
Tìm kiếm tài liệu theo từ khóa (tìm trong tiêu đề + mô tả + nội dung file đã trích xuất).

**Query Params:**
| Param | Type | Required | Description |
|-------|------|:---:|-------------|
| `q` | String | ✅ | Từ khóa tìm kiếm |
| `categoryId` | Long | ❌ | Lọc theo danh mục |
| `departmentId` | Long | ❌ | Lọc theo phòng ban |
| `fileType` | String | ❌ | Lọc theo loại file |
| `tagIds` | Long[] | ❌ | Lọc theo tags |
| `dateFrom` | Date | ❌ | Lọc từ ngày |
| `dateTo` | Date | ❌ | Lọc đến ngày |
| `sort` | String | ❌ | `relevance` (default), `date_desc`, `date_asc`, `views`, `downloads` |
| `page` | Int | ❌ | Default: 0 |
| `size` | Int | ❌ | Default: 20, max: 100 |

**Example:** `/documents/search?q=quy trình ISO&categoryId=1&fileType=PDF&sort=relevance`

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "content": [
      {
        "id": 42,
        "title": "Quy trình ISO 9001 - Quản lý chất lượng",
        "slug": "quy-trinh-iso-9001-quan-ly-chat-luong",
        "description": "Tài liệu mô tả quy trình quản lý chất lượng...",
        "documentCode": "SOP-QA-001",
        "fileType": "PDF",
        "fileSize": 2048576,
        "versionNumber": "1.0",
        "viewCount": 150,
        "downloadCount": 45,
        "category": { "id": 1, "name": "Quy trình ISO" },
        "department": { "id": 3, "name": "Phòng QA" },
        "tags": [ { "id": 1, "name": "ISO" } ],
        "relevanceScore": 15.67,
        "highlight": {
          "title": "<em>Quy trình ISO</em> 9001 - Quản lý chất lượng",
          "extractedText": "...theo tiêu chuẩn <em>ISO</em> 9001:2015, <em>quy trình</em> này áp dụng cho toàn bộ..."
        },
        "createdAt": "2026-07-21T10:30:00"
      }
    ],
    "page": 0,
    "size": 20,
    "totalElements": 12,
    "totalPages": 1,
    "query": "quy trình ISO",
    "searchTime": 45
  }
}
```

> **`highlight`**: Trả về snippet nội dung có đánh dấu `<em>` tại vị trí match. Giúp frontend hiển thị preview kết quả tìm kiếm cho user.

> **`searchTime`**: Thời gian thực hiện search (ms). Phục vụ monitoring performance.

---

## 5. Master Data (Categories, Departments, Tags)

### Categories (Danh mục — hỗ trợ cây phân cấp)

- `GET /categories` 🔒 — Danh sách tất cả categories (dạng cây)
- `GET /categories/{id}` 🔒 — Chi tiết 1 category
- `POST /categories` 👑 — Tạo category mới
- `PUT /categories/{id}` 👑 — Cập nhật category
- `DELETE /categories/{id}` 👑 — Soft delete category

#### `GET /categories` Response (dạng cây):
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Quy trình ISO",
      "slug": "quy-trinh-iso",
      "icon": "📋",
      "sortOrder": 1,
      "isActive": true,
      "documentCount": 25,
      "children": [
        {
          "id": 2,
          "name": "ISO 9001 - Quản lý chất lượng",
          "slug": "iso-9001-quan-ly-chat-luong",
          "sortOrder": 1,
          "isActive": true,
          "documentCount": 10,
          "children": []
        },
        {
          "id": 3,
          "name": "ISO 14001 - Môi trường",
          "slug": "iso-14001-moi-truong",
          "sortOrder": 2,
          "isActive": true,
          "documentCount": 8,
          "children": []
        }
      ]
    },
    {
      "id": 10,
      "name": "Biểu mẫu",
      "slug": "bieu-mau",
      "icon": "📄",
      "sortOrder": 2,
      "isActive": true,
      "documentCount": 50,
      "children": [ ... ]
    }
  ]
}
```

#### `POST /categories` Request Body:
```json
{
  "name": "ISO 45001 - An toàn lao động",
  "parentId": 1,
  "description": "Tài liệu về hệ thống quản lý an toàn và sức khỏe nghề nghiệp",
  "icon": "🦺",
  "sortOrder": 3
}
```

---

### Departments (Phòng ban)

- `GET /departments` 🔒 — Danh sách phòng ban
- `GET /departments/{id}` 🔒 — Chi tiết phòng ban
- `POST /departments` 👑 — Tạo phòng ban
- `PUT /departments/{id}` 👑 — Cập nhật phòng ban
- `DELETE /departments/{id}` 👑 — Soft delete phòng ban

#### `POST /departments` Request Body:
```json
{
  "name": "Phòng Kỹ thuật",
  "code": "IT",
  "description": "Phòng ban phụ trách hệ thống công nghệ thông tin"
}
```

---

### Tags (Nhãn)

- `GET /tags` 🔒 — Danh sách tags (kèm document count)
- `GET /tags/{id}` 🔒 — Chi tiết tag
- `POST /tags` 👑 — Tạo tag
- `PUT /tags/{id}` 👑 — Cập nhật tag
- `DELETE /tags/{id}` 👑 — Soft delete tag

#### `POST /tags` Request Body:
```json
{
  "name": "An toàn lao động"
}
```
*`slug` được tự động sinh từ `name` ở server side.*

---

## 6. Dashboard & Analytics (Admin) 👑

#### `GET /admin/dashboard` 👑
Thống kê tổng quan cho trang quản trị.

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "totalDocuments": 1250,
    "totalUsers": 85,
    "totalCategories": 15,
    "totalDepartments": 8,
    "documentsByStatus": {
      "INDEXED": 1200,
      "PROCESSING": 10,
      "EXTRACTION_FAILED": 40
    },
    "documentsByFileType": {
      "PDF": 800,
      "DOCX": 300,
      "XLSX": 100,
      "DOC": 30,
      "IMAGE": 20
    },
    "topViewedDocuments": [
      { "id": 42, "title": "Quy trình ISO 9001", "viewCount": 500 },
      { "id": 15, "title": "Biểu mẫu đánh giá nhân sự", "viewCount": 350 }
    ],
    "topDownloadedDocuments": [
      { "id": 7, "title": "Mẫu hợp đồng lao động", "viewCount": 280 }
    ],
    "recentUploads": [
      {
        "id": 1250,
        "title": "SOP vận hành máy CNC",
        "uploadedBy": "Admin",
        "createdAt": "2026-07-21T09:00:00"
      }
    ]
  }
}
```

---

## 7. API Documentation Generation

This API Spec follows standards fully compatible with **OpenAPI 3 / Swagger**. In the implementation phase, `@RestController` classes MUST be annotated with `@Tag` and `@Operation` to generate live Swagger documentation at `/swagger-ui.html`.

---

## API Summary Table

| # | Method | Endpoint | Auth | Description |
|---|--------|----------|------|-------------|
| | | **Authentication** | | |
| 1 | POST | `/auth/login` | 🔓 | Đăng nhập |
| 2 | POST | `/auth/register` | 👑 | Admin tạo tài khoản |
| 3 | POST | `/auth/refresh` | 🔓 | Refresh Access Token |
| 4 | POST | `/auth/logout` | 🔒 | Đăng xuất |
| | | **User** | | |
| 5 | GET | `/users/me` | 🔒 | Xem profile cá nhân |
| 6 | PUT | `/users/me` | 🔒 | Cập nhật profile |
| 7 | GET | `/users` | 👑 | Danh sách users |
| 8 | GET | `/users/{id}` | 👑 | Chi tiết user |
| 9 | POST | `/users` | 👑 | Tạo user |
| 10 | PUT | `/users/{id}` | 👑 | Cập nhật user |
| 11 | DELETE | `/users/{id}` | 👑 | Xóa user (soft) |
| | | **Document** | | |
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
| | | **Search** | | |
| 22 | GET | `/documents/search` | 🔒 | Tìm kiếm full-text |
| | | **Master Data** | | |
| 23 | GET | `/categories` | 🔒 | Danh sách danh mục (cây) |
| 24 | GET | `/categories/{id}` | 🔒 | Chi tiết danh mục |
| 25 | POST | `/categories` | 👑 | Tạo danh mục |
| 26 | PUT | `/categories/{id}` | 👑 | Cập nhật danh mục |
| 27 | DELETE | `/categories/{id}` | 👑 | Xóa danh mục (soft) |
| 28 | GET | `/departments` | 🔒 | Danh sách phòng ban |
| 29 | GET | `/departments/{id}` | 🔒 | Chi tiết phòng ban |
| 30 | POST | `/departments` | 👑 | Tạo phòng ban |
| 31 | PUT | `/departments/{id}` | 👑 | Cập nhật phòng ban |
| 32 | DELETE | `/departments/{id}` | 👑 | Xóa phòng ban (soft) |
| 33 | GET | `/tags` | 🔒 | Danh sách tags |
| 34 | GET | `/tags/{id}` | 🔒 | Chi tiết tag |
| 35 | POST | `/tags` | 👑 | Tạo tag |
| 36 | PUT | `/tags/{id}` | 👑 | Cập nhật tag |
| 37 | DELETE | `/tags/{id}` | 👑 | Xóa tag (soft) |
| | | **Dashboard** | | |
| 38 | GET | `/admin/dashboard` | 👑 | Thống kê tổng quan |