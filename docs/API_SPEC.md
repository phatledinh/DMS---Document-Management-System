# API Specification — Hệ Thống Quản Lý Tài Liệu Nội Bộ (DMS)

> API Documentation cho hệ thống Quản lý & Tìm kiếm Tài liệu Doanh nghiệp.
> Designed for OpenAPI 3 / Swagger integration.
>
> Ký hiệu: 🔓 Public (không cần JWT) | 🔒 Authenticated (cần JWT) | 👑 Admin only

---

## 1. Global Standards & Conventions

### Base URL & Versioning

```text
Development: http://localhost:8080/api/v1
Production:  https://api.qlktl.example.com/api/v1
```

Không thay đổi breaking changes trong `v1`. Mọi thay đổi lớn phải tạo `v2`.

### Authentication

- Tất cả API trừ `POST /auth/login` và `POST /auth/refresh` yêu cầu JWT Access Token.
- Access Token gửi qua header `Authorization: Bearer <token>`.
- Refresh Token lưu trong HttpOnly Cookie, không trả cho JavaScript đọc trực tiếp.
- Endpoint 👑 yêu cầu user có role `ADMIN`.
- Endpoint 🔒 vẫn phải áp dụng quyền tài liệu bằng `DocumentAccessPolicyService` khi đọc tài liệu.

### HTTP Status Codes

| Code | Meaning | Usage |
|------|---------|-------|
| `200` | OK | Successful GET, PUT, action POST |
| `201` | Created | Successful POST tạo resource/upload |
| `204` | No Content | Successful DELETE |
| `400` | Bad Request | Validation errors, ACL input không hợp lệ |
| `401` | Unauthorized | Missing/invalid/expired JWT |
| `403` | Forbidden | JWT valid nhưng không đủ quyền |
| `404` | Not Found | Resource không tồn tại hoặc không được tiết lộ do policy |
| `409` | Conflict | Duplicate email/document_code/slug/versionNumber |
| `413` | Payload Too Large | File upload vượt quá 50MB |
| `415` | Unsupported Media Type | File type không được hỗ trợ |
| `500` | Server Error | Internal exceptions |

### Response Wrapper (`ApiResponse<T>`)

Tất cả JSON endpoint trả về format thống nhất.

**Success Response:**
```json
{
  "success": true,
  "message": "Operation successful",
  "data": {}
}
```

**Pagination Response:**
```json
{
  "success": true,
  "data": {
    "content": [],
    "page": 0,
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

### Common Error Codes

| Code | Mô tả |
|------|------|
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
| `INVALID_ACCESS_LEVEL` | `accessLevel` không hợp lệ |
| `INVALID_ACL_RULE` | Thiếu department/user ACL tương ứng `accessLevel` |
| `VERSION_NOT_FOUND` | Phiên bản tài liệu không tồn tại |
| `VERSION_DUPLICATE` | Số phiên bản đã tồn tại |

### Supported File Types & Upload Validation

| MIME Type | Extension | Extraction | Preview |
|-----------|-----------|:---:|:---:|
| `application/pdf` | `.pdf` | PDFBox cho PDF text; Tesseract OCR cho scan | PDF stream |
| `application/msword` | `.doc` | POI HWPF | Convert PDF/HTML |
| `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | `.docx` | POI XWPF | Convert PDF/HTML |
| `application/vnd.ms-excel` | `.xls` | POI | HTML table/PDF |
| `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | `.xlsx` | POI | HTML table/PDF |
| `image/jpeg` | `.jpg`, `.jpeg` | Tesseract OCR | Image stream |
| `image/png` | `.png` | Tesseract OCR | Image stream |
| `image/tiff` | `.tiff` | Tesseract OCR | Image stream |

Upload rules:

- Mỗi request upload đúng 1 file.
- File size tối đa `50MB`.
- Validate cả extension và MIME thực tế bằng Apache Tika.
- Chặn `.exe`, `.sh`, `.bat`, `.cmd`, `.js`, `.html`, `.htm`, `.jar`, `.msi`, `.ps1`, `.vbs`.
- `storage_path` dùng UUID/generated key; `file_name` chỉ là tên gốc đã sanitize để hiển thị/download.
- Upload version mới phải đi qua cùng validation như upload tài liệu lần đầu.

### Shared Enums

| Enum | Values |
|------|--------|
| `Role` | `ADMIN`, `USER` |
| `UserStatus` | `ACTIVE`, `INACTIVE`, `BANNED` |
| `DocumentStatus` | `PROCESSING`, `INDEXED`, `EXTRACTION_FAILED`, `ARCHIVED`, `DELETED` |
| `AccessLevel` | `PUBLIC`, `DEPARTMENT`, `RESTRICTED` |
| `AccessLogAction` | `VIEW`, `PREVIEW`, `DOWNLOAD`, `VERSION_DOWNLOAD` |
| `AuditTargetType` | `DOCUMENT`, `USER`, `CATEGORY`, `DEPARTMENT`, `TAG` |

---

## 2. Authentication & Identity

### `POST /auth/login` 🔓

Đăng nhập bằng email/password. Trả Access Token trong JSON và set Refresh Token vào HttpOnly Cookie.

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
    "tokenType": "Bearer",
    "expiresIn": 900,
    "user": {
      "id": 1,
      "name": "Nguyễn Văn A",
      "email": "user@company.com",
      "role": "USER",
      "department": { "id": 1, "name": "Phòng Kỹ thuật", "code": "IT" },
      "avatar": null
    }
  }
}
```

**Response Headers:**
```http
Set-Cookie: refresh_token=eyJ...; HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth; Max-Age=604800
```

### `POST /auth/refresh` 🔓

Đọc Refresh Token từ HttpOnly Cookie và cấp Access Token mới.

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "tokenType": "Bearer",
    "expiresIn": 900
  }
}
```

### `POST /auth/logout` 🔒

Thu hồi Refresh Token và xóa HttpOnly Cookie.

**Success Response (200):**
```json
{
  "success": true,
  "message": "Logged out successfully",
  "data": null
}
```

### `POST /auth/register` 👑

Admin tạo tài khoản cho nhân viên. Không mở public register.

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
    "phone": "0912345678",
    "role": "USER",
    "department": { "id": 2, "name": "Phòng Nhân sự", "code": "HR" },
    "status": "ACTIVE",
    "createdAt": "2026-07-21T10:30:00"
  }
}
```

### `GET /users/me` 🔒

Lấy profile của user đang đăng nhập.

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
    "createdAt": "2026-01-15T08:30:00",
    "updatedAt": null
  }
}
```

### `PUT /users/me` 🔒

User cập nhật profile cá nhân. Không được tự đổi `email`, `role`, `departmentId`, `status`.

**Request Body:**
```json
{
  "name": "Nguyễn Văn A",
  "phone": "0987654321",
  "avatar": "https://cdn.example.com/avatars/1-new.jpg"
}
```

**Success Response (200):** trả `UserDto` đã cập nhật.

### User Management 👑

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| `GET` | `/users` | Danh sách users |
| `GET` | `/users/{id}` | Chi tiết user |
| `POST` | `/users` | Tạo user mới, tương đương `/auth/register` |
| `PUT` | `/users/{id}` | Cập nhật user, bao gồm role/department/status |
| `DELETE` | `/users/{id}` | Soft delete/deactivate user |

**`GET /users` Query Params:**

| Param | Type | Description |
|-------|------|-------------|
| `role` | String | `ADMIN`, `USER` |
| `departmentId` | Long | Lọc theo phòng ban |
| `status` | String | `ACTIVE`, `INACTIVE`, `BANNED` |
| `search` | String | Tìm theo name/email/phone |
| `page` | Int | Default `0` |
| `size` | Int | Default `20`, max `100` |
| `sort` | String | `created_at_desc`, `name_asc`, `email_asc` |

**`PUT /users/{id}` Request Body:**
```json
{
  "name": "Trần Thị B",
  "phone": "0912345678",
  "role": "USER",
  "departmentId": 2,
  "status": "ACTIVE"
}
```

---

## 3. Document Management

### Shared Document DTOs

**DocumentSummaryDto:**
```json
{
  "id": 42,
  "title": "Quy trình ISO 9001 - Quản lý chất lượng",
  "slug": "quy-trinh-iso-9001-quan-ly-chat-luong",
  "documentCode": "SOP-QA-001",
  "fileType": "PDF",
  "fileSize": 2048576,
  "pageCount": 25,
  "status": "INDEXED",
  "accessLevel": "DEPARTMENT",
  "versionNumber": "1.0",
  "viewCount": 150,
  "downloadCount": 45,
  "category": { "id": 1, "name": "Quy trình ISO", "slug": "quy-trinh-iso" },
  "department": { "id": 3, "name": "Phòng QA", "code": "QA" },
  "owner": { "id": 10, "name": "Nguyễn Văn C" },
  "uploadedBy": { "id": 1, "name": "Admin" },
  "tags": [ { "id": 1, "name": "ISO", "slug": "iso" } ],
  "effectiveDate": "2026-01-01",
  "expiryDate": null,
  "createdAt": "2026-07-21T10:30:00",
  "updatedAt": null
}
```

### `POST /documents` 👑

Admin upload tài liệu mới. Sử dụng `multipart/form-data`.

**Request Fields:**

| Field | Type | Required | Description |
|-------|------|:---:|-------------|
| `file` | File | Có | File tài liệu, max 50MB |
| `title` | String | Có | Tiêu đề tài liệu |
| `description` | String | Không | Mô tả ngắn |
| `categoryId` | Long | Có | ID danh mục |
| `departmentId` | Long | Không | Phòng ban sở hữu/chủ quản |
| `documentCode` | String | Không | Mã tài liệu, unique nếu có |
| `tagIds` | Long[] | Không | Danh sách tag IDs |
| `accessLevel` | String | Có | `PUBLIC`, `DEPARTMENT`, `RESTRICTED` |
| `departmentIds` | Long[] | Conditional | Bắt buộc nếu `accessLevel = DEPARTMENT` |
| `ownerId` | Long | Conditional | Bắt buộc nếu `accessLevel = RESTRICTED`; khuyến nghị có với mọi tài liệu |
| `sharedUserIds` | Long[] | Không | User được chia sẻ trực tiếp cho `RESTRICTED` |
| `effectiveDate` | Date | Không | Ngày hiệu lực |
| `expiryDate` | Date | Không | Ngày hết hiệu lực |

**ACL Rules:**

- `PUBLIC`: bỏ qua `departmentIds` và `sharedUserIds`; mọi user đăng nhập được xem.
- `DEPARTMENT`: `departmentIds` phải có ít nhất 1 phần tử.
- `RESTRICTED`: `ownerId` hoặc `sharedUserIds` phải có ít nhất một user; owner luôn có quyền xem.

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
    "mimeType": "application/pdf",
    "fileSize": 2048576,
    "status": "PROCESSING",
    "accessLevel": "DEPARTMENT",
    "versionNumber": "1.0",
    "category": { "id": 1, "name": "Quy trình ISO" },
    "department": { "id": 3, "name": "Phòng QA", "code": "QA" },
    "owner": { "id": 10, "name": "Nguyễn Văn C" },
    "departmentAccesses": [ { "id": 3, "name": "Phòng QA", "code": "QA" } ],
    "sharedUsers": [],
    "tags": [ { "id": 1, "name": "ISO" } ],
    "uploadedBy": { "id": 1, "name": "Admin" },
    "createdAt": "2026-07-21T10:30:00"
  }
}
```

Sau khi upload, extraction/indexing chạy background. `status` ban đầu là `PROCESSING`, chuyển sang `INDEXED` hoặc `EXTRACTION_FAILED`.

### `GET /documents` 🔒

Danh sách tài liệu theo quyền hiện tại. Admin có thể xem/filter toàn bộ; User mặc định chỉ thấy tài liệu `INDEXED` và có quyền.

**Query Params:**

| Param | Type | Description |
|-------|------|-------------|
| `categoryId` | Long | Lọc theo danh mục |
| `departmentId` | Long | Lọc theo phòng ban sở hữu/chủ quản |
| `fileType` | String | `PDF`, `DOC`, `DOCX`, `XLS`, `XLSX`, `JPG`, `PNG`, `TIFF` |
| `status` | String | Admin dùng để lọc status; User chỉ được `INDEXED` mặc định |
| `accessLevel` | String | `PUBLIC`, `DEPARTMENT`, `RESTRICTED` |
| `tagIds` | Long[] | Lọc theo tags |
| `ownerId` | Long | Lọc theo owner |
| `uploadedBy` | Long | Lọc theo uploader |
| `effectiveDateFrom` | Date | Ngày hiệu lực từ |
| `effectiveDateTo` | Date | Ngày hiệu lực đến |
| `sort` | String | `created_at_desc` default, `created_at_asc`, `updated_at_desc`, `title_asc`, `view_count_desc`, `download_count_desc` |
| `page` | Int | Default `0` |
| `size` | Int | Default `20`, max `100` |

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "content": [
      {
        "id": 42,
        "title": "Quy trình ISO 9001 - Quản lý chất lượng",
        "documentCode": "SOP-QA-001",
        "fileType": "PDF",
        "fileSize": 2048576,
        "status": "INDEXED",
        "accessLevel": "DEPARTMENT",
        "versionNumber": "1.0",
        "viewCount": 150,
        "downloadCount": 45,
        "category": { "id": 1, "name": "Quy trình ISO" },
        "department": { "id": 3, "name": "Phòng QA" },
        "owner": { "id": 10, "name": "Nguyễn Văn C" },
        "tags": [ { "id": 1, "name": "ISO" } ],
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

### `GET /documents/{id}` 🔒

Chi tiết tài liệu. Kiểm tra quyền trước khi trả metadata/URL. Không tăng `view_count`; chỉ preview mới tăng lượt xem.

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
    "accessLevel": "DEPARTMENT",
    "versionNumber": "1.0",
    "viewCount": 150,
    "downloadCount": 45,
    "category": { "id": 1, "name": "Quy trình ISO", "slug": "quy-trinh-iso" },
    "department": { "id": 3, "name": "Phòng QA", "code": "QA" },
    "owner": { "id": 10, "name": "Nguyễn Văn C" },
    "uploadedBy": { "id": 1, "name": "Admin" },
    "departmentAccesses": [ { "id": 3, "name": "Phòng QA", "code": "QA" } ],
    "sharedUsers": [],
    "tags": [
      { "id": 1, "name": "ISO", "slug": "iso" },
      { "id": 5, "name": "Chất lượng", "slug": "chat-luong" }
    ],
    "effectiveDate": "2026-01-01",
    "expiryDate": null,
    "previewUrl": "/api/v1/documents/42/preview",
    "downloadUrl": "/api/v1/documents/42/download",
    "createdAt": "2026-07-21T10:30:00",
    "updatedAt": null
  }
}
```

### `PUT /documents/{id}` 👑

Admin cập nhật metadata, tags và ACL. Không cập nhật file; dùng `POST /documents/{id}/versions` để upload phiên bản mới.

**Request Body:**
```json
{
  "title": "Quy trình ISO 9001:2015 - Quản lý chất lượng",
  "description": "Phiên bản cập nhật mới nhất",
  "categoryId": 1,
  "departmentId": 3,
  "documentCode": "SOP-QA-001",
  "tagIds": [1, 5, 8],
  "accessLevel": "RESTRICTED",
  "ownerId": 10,
  "departmentIds": [],
  "sharedUserIds": [12, 15],
  "effectiveDate": "2026-07-01",
  "expiryDate": "2027-07-01"
}
```

**Success Response (200):** trả `DocumentDetailDto` đã cập nhật. Metadata/ACL thay đổi phải re-index Elasticsearch và ghi `audit_logs`.

### `DELETE /documents/{id}` 👑

Soft delete tài liệu: set `status = DELETED` và `deleted_at`, cập nhật Elasticsearch để loại khỏi search mặc định.

**Success Response (204):** No Content

### `POST /documents/{id}/archive` 👑

Archive tài liệu đang sử dụng: set `status = ARCHIVED`, `archived_at`, cập nhật Elasticsearch.

**Success Response (200):**
```json
{
  "success": true,
  "message": "Document archived successfully",
  "data": {
    "id": 42,
    "status": "ARCHIVED",
    "archivedAt": "2026-07-21T15:00:00"
  }
}
```

### `POST /documents/{id}/restore` 👑

Restore tài liệu đã archive/delete. Nếu cần xử lý lại index/content, status có thể về `PROCESSING`; nếu index còn hợp lệ, có thể về `INDEXED` hoặc `ARCHIVED` theo trạng thái trước đó.

**Success Response (200):**
```json
{
  "success": true,
  "message": "Document restored successfully",
  "data": {
    "id": 42,
    "status": "PROCESSING"
  }
}
```

### `POST /documents/{id}/retry-indexing` 👑

Retry extraction/indexing cho tài liệu `EXTRACTION_FAILED` hoặc tài liệu có lỗi index gần nhất.

**Success Response (200):**
```json
{
  "success": true,
  "message": "Retry indexing started",
  "data": {
    "id": 42,
    "status": "PROCESSING",
    "retryCount": 2
  }
}
```

---

## 4. Preview, Download & Versions

### `GET /documents/{id}/preview` 🔒

Preview tài liệu trực tiếp trên trình duyệt. Kiểm tra quyền bằng cùng logic với detail/search/download. Chỉ tăng `view_count` và ghi `access_logs` khi truy cập thành công.

**Response:**

| File | Response |
|------|----------|
| PDF | `Content-Type: application/pdf`, inline stream |
| DOC/DOCX | Convert bằng LibreOffice/JODConverter sang PDF hoặc HTML đã sanitize |
| XLS/XLSX | HTML table đã sanitize hoặc PDF |
| Image | `Content-Type: image/*`, inline stream |

**Example Headers:**
```http
Content-Type: application/pdf
Content-Disposition: inline; filename="ISO_9001_QA_Process.pdf"
```

### `GET /documents/{id}/download` 🔒

Tải file gốc. Kiểm tra quyền, tăng `download_count`, ghi `access_logs`.

**Response Headers:**
```http
Content-Type: application/pdf
Content-Disposition: attachment; filename="ISO_9001_QA_Process.pdf"
Content-Length: 2048576
```

### `GET /documents/{id}/versions` 🔒

Lịch sử phiên bản. Kiểm tra quyền truy cập tài liệu trước khi trả version history.

**Success Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 3,
      "documentId": 42,
      "versionNumber": "1.2",
      "fileName": "ISO_9001_v1.2.pdf",
      "fileSize": 2150000,
      "mimeType": "application/pdf",
      "changelog": "Cập nhật quy trình kiểm tra chất lượng đầu vào",
      "current": true,
      "uploadedBy": { "id": 1, "name": "Admin" },
      "createdAt": "2026-07-20T14:00:00"
    }
  ]
}
```

### `POST /documents/{id}/versions` 👑

Admin upload phiên bản mới. File/version cũ giữ lại; version mới trở thành current version và trigger extraction/re-index.

**Request Fields:**

| Field | Type | Required | Description |
|-------|------|:---:|-------------|
| `file` | File | Có | File phiên bản mới, max 50MB |
| `versionNumber` | String | Có | Số phiên bản, unique trong document |
| `changelog` | String | Không | Ghi chú thay đổi |

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
    "mimeType": "application/pdf",
    "changelog": "Cập nhật biểu mẫu kiểm tra",
    "current": true,
    "documentStatus": "PROCESSING",
    "uploadedBy": { "id": 1, "name": "Admin" },
    "createdAt": "2026-07-21T15:00:00"
  }
}
```

### `GET /documents/{id}/versions/{versionId}/download` 🔒

Tải file của một version cụ thể. Kiểm tra quyền truy cập document và ghi access log action `VERSION_DOWNLOAD`.

**Response Headers:**
```http
Content-Type: application/pdf
Content-Disposition: attachment; filename="ISO_9001_v1.1.pdf"
```

### `POST /documents/{id}/versions/{versionId}/restore` 👑

Khôi phục một version cũ thành current version. Không xóa version hiện tại; cập nhật `documents.version_number`, trích xuất lại content và re-index.

**Success Response (200):**
```json
{
  "success": true,
  "message": "Document version restored successfully",
  "data": {
    "documentId": 42,
    "currentVersionId": 2,
    "versionNumber": "1.1",
    "status": "PROCESSING"
  }
}
```

---

## 5. Search Engine

### `GET /documents/search` 🔒

Full-text search qua Elasticsearch trên title, description, extracted content, document code và tags. Query phải áp permission filter trước khi trả kết quả.

**Query Params:**

| Param | Type | Required | Description |
|-------|------|:---:|-------------|
| `q` | String | Không | Từ khóa; có thể rỗng nếu chỉ filter/browse |
| `categoryId` | Long | Không | Lọc danh mục |
| `departmentId` | Long | Không | Lọc phòng ban |
| `fileType` | String | Không | Lọc loại file |
| `tagIds` | Long[] | Không | Lọc tags |
| `ownerId` | Long | Không | Lọc owner |
| `uploadedBy` | Long | Không | Lọc uploader |
| `status` | String | Không | Admin có thể filter; User mặc định `INDEXED` |
| `accessLevel` | String | Không | Admin có thể filter access level |
| `dateFrom` | Date | Không | Lọc created/effective date từ |
| `dateTo` | Date | Không | Lọc đến ngày |
| `sort` | String | Không | `relevance` default, `createdAt`, `updatedAt`, `viewCount`, `downloadCount`, `title` |
| `page` | Int | Không | Default `0` |
| `size` | Int | Không | Default `20`, max `100` |

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "content": [
      {
        "id": 42,
        "title": "Quy trình ISO 9001 - Quản lý chất lượng",
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
          "description": "Tài liệu mô tả <em>quy trình</em> quản lý chất lượng...",
          "content": "...theo tiêu chuẩn <em>ISO</em> 9001:2015..."
        },
        "createdAt": "2026-07-21T10:30:00"
      }
    ],
    "facets": {
      "categories": [ { "id": 1, "name": "Quy trình ISO", "count": 8 } ],
      "departments": [ { "id": 3, "name": "Phòng QA", "count": 5 } ],
      "fileTypes": [ { "value": "PDF", "count": 12 } ],
      "tags": [ { "id": 1, "name": "ISO", "count": 8 } ]
    },
    "page": 0,
    "size": 20,
    "totalElements": 12,
    "totalPages": 1,
    "query": "quy trình ISO",
    "searchTime": 45
  }
}
```

Backend phải sanitize highlight trước khi trả frontend. Search/suggestions phải ghi `search_logs`.

### `GET /documents/search/suggestions` 🔒

Autocomplete/suggestion cho title, document code và tags. Không gợi ý tài liệu/tag dẫn tới tài liệu user không có quyền.

**Query Params:**

| Param | Type | Required | Description |
|-------|------|:---:|-------------|
| `q` hoặc `prefix` | String | Có | Prefix cần gợi ý |
| `limit` | Int | Không | Default `10`, max `20` |

**Success Response (200):**
```json
{
  "success": true,
  "data": [
    { "type": "TITLE", "value": "Quy trình ISO 9001", "documentId": 42 },
    { "type": "DOCUMENT_CODE", "value": "SOP-QA-001", "documentId": 42 },
    { "type": "TAG", "value": "ISO", "tagId": 1 }
  ]
}
```

---

## 6. Master Data

### Categories

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| `GET` | `/categories` | 🔒 | Danh sách categories dạng cây |
| `GET` | `/categories/{id}` | 🔒 | Chi tiết category |
| `POST` | `/categories` | 👑 | Tạo category |
| `PUT` | `/categories/{id}` | 👑 | Cập nhật category |
| `DELETE` | `/categories/{id}` | 👑 | Soft delete category |

**`GET /categories` Query Params:** `activeOnly`, `includeDocumentCount`.

**Response Example:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Quy trình ISO",
      "slug": "quy-trinh-iso",
      "description": null,
      "icon": "file-text",
      "sortOrder": 1,
      "isActive": true,
      "documentCount": 25,
      "children": []
    }
  ]
}
```

**Create/Update Request:**
```json
{
  "name": "ISO 45001 - An toàn lao động",
  "parentId": 1,
  "description": "Tài liệu về hệ thống quản lý an toàn và sức khỏe nghề nghiệp",
  "icon": "safety",
  "sortOrder": 3,
  "isActive": true
}
```

### Departments

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| `GET` | `/departments` | 🔒 | Danh sách phòng ban |
| `GET` | `/departments/{id}` | 🔒 | Chi tiết phòng ban |
| `POST` | `/departments` | 👑 | Tạo phòng ban |
| `PUT` | `/departments/{id}` | 👑 | Cập nhật phòng ban |
| `DELETE` | `/departments/{id}` | 👑 | Soft delete phòng ban |

**Create/Update Request:**
```json
{
  "name": "Phòng Kỹ thuật",
  "code": "IT",
  "description": "Phòng ban phụ trách hệ thống công nghệ thông tin",
  "isActive": true
}
```

### Tags

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| `GET` | `/tags` | 🔒 | Danh sách tags |
| `GET` | `/tags/{id}` | 🔒 | Chi tiết tag |
| `POST` | `/tags` | 👑 | Tạo tag |
| `PUT` | `/tags/{id}` | 👑 | Cập nhật tag |
| `DELETE` | `/tags/{id}` | 👑 | Soft delete tag |

**Create/Update Request:**
```json
{
  "name": "An toàn lao động"
}
```

`slug` tự động sinh từ `name` ở server side.

---

## 7. Dashboard & Audit

Dashboard dùng convention `/admin/dashboard/summary` cho thống kê tổng quan; các số liệu chuyên biệt nằm ở endpoint con.

### `GET /admin/dashboard/summary` 👑

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
      "PROCESSING": 10,
      "INDEXED": 1180,
      "EXTRACTION_FAILED": 40,
      "ARCHIVED": 15,
      "DELETED": 5
    },
    "documentsByFileType": {
      "PDF": 800,
      "DOCX": 300,
      "XLSX": 100,
      "DOC": 30,
      "JPG": 20
    },
    "totalPreviewCount": 15000,
    "totalDownloadCount": 5200,
    "totalSearchCount": 8700,
    "processingErrorCount": 40
  }
}
```

### Dashboard endpoints 👑

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| `GET` | `/admin/dashboard/top-documents` | Tài liệu được xem/tải nhiều nhất |
| `GET` | `/admin/dashboard/recent-uploads` | Tài liệu upload gần đây |
| `GET` | `/admin/dashboard/top-search-keywords` | Từ khóa tìm kiếm phổ biến |
| `GET` | `/admin/dashboard/access-stats` | Thống kê preview/download/view theo thời gian |
| `GET` | `/admin/dashboard/processing-errors` | Danh sách lỗi extraction/indexing |

**Common Query Params:** `dateFrom`, `dateTo`, `limit`, `page`, `size` tùy endpoint.

### `GET /admin/dashboard/top-documents` 👑

**Query Params:** `metric=view|download`, `dateFrom`, `dateTo`, `limit`.

**Response Example:**
```json
{
  "success": true,
  "data": [
    {
      "id": 42,
      "title": "Quy trình ISO 9001",
      "documentCode": "SOP-QA-001",
      "viewCount": 500,
      "downloadCount": 120,
      "lastAccessedAt": "2026-07-21T10:00:00"
    }
  ]
}
```

### `GET /admin/dashboard/processing-errors` 👑

**Response Example:**
```json
{
  "success": true,
  "data": {
    "content": [
      {
        "documentId": 42,
        "title": "Quy trình ISO 9001",
        "fileType": "PDF",
        "status": "EXTRACTION_FAILED",
        "retryCount": 2,
        "errorMessage": "Unable to extract text",
        "updatedAt": "2026-07-21T10:30:00"
      }
    ],
    "page": 0,
    "size": 20,
    "totalElements": 1,
    "totalPages": 1
  }
}
```

### `GET /admin/audit-logs` 👑

Tra cứu audit/access/search log cho admin.

**Query Params:**

| Param | Type | Description |
|-------|------|-------------|
| `actorId` | Long | User thực hiện hành động |
| `action` | String | Action audit/access |
| `targetType` | String | `DOCUMENT`, `USER`, `CATEGORY`, `DEPARTMENT`, `TAG` |
| `targetId` | Long | ID đối tượng |
| `documentId` | Long | Lọc access log theo tài liệu |
| `keyword` | String | Lọc search log theo keyword |
| `dateFrom` | DateTime | Từ thời điểm |
| `dateTo` | DateTime | Đến thời điểm |
| `page` | Int | Default `0` |
| `size` | Int | Default `20`, max `100` |

**Response Example:**
```json
{
  "success": true,
  "data": {
    "content": [
      {
        "id": 1001,
        "logType": "AUDIT",
        "actor": { "id": 1, "name": "Admin" },
        "action": "UPDATE",
        "targetType": "DOCUMENT",
        "targetId": 42,
        "ipAddress": "192.168.1.10",
        "createdAt": "2026-07-21T10:30:00"
      }
    ],
    "page": 0,
    "size": 20,
    "totalElements": 200,
    "totalPages": 10
  }
}
```

---

## 8. API Documentation Generation

API spec tương thích OpenAPI 3 / Swagger. Khi triển khai, `@RestController` nên dùng `@Tag`, `@Operation`, `@Parameter`, `@Schema` để sinh Swagger UI tại `/swagger-ui.html`.

---

## 9. API Summary Table

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
| 11 | DELETE | `/users/{id}` | 👑 | Xóa user soft/deactivate |
| | | **Document** | | |
| 12 | POST | `/documents` | 👑 | Upload tài liệu |
| 13 | GET | `/documents` | 🔒 | Danh sách tài liệu theo quyền hiện tại |
| 14 | GET | `/documents/{id}` | 🔒 | Chi tiết tài liệu |
| 15 | PUT | `/documents/{id}` | 👑 | Cập nhật metadata, tags, ACL |
| 16 | DELETE | `/documents/{id}` | 👑 | Xóa tài liệu soft delete |
| 17 | POST | `/documents/{id}/archive` | 👑 | Archive tài liệu |
| 18 | POST | `/documents/{id}/restore` | 👑 | Restore tài liệu đã archive/delete |
| 19 | POST | `/documents/{id}/retry-indexing` | 👑 | Retry extraction/indexing |
| 20 | GET | `/documents/{id}/preview` | 🔒 | Preview tài liệu |
| 21 | GET | `/documents/{id}/download` | 🔒 | Tải tài liệu |
| 22 | GET | `/documents/{id}/versions` | 🔒 | Lịch sử phiên bản |
| 23 | POST | `/documents/{id}/versions` | 👑 | Upload phiên bản mới |
| 24 | GET | `/documents/{id}/versions/{versionId}/download` | 🔒 | Tải phiên bản cũ |
| 25 | POST | `/documents/{id}/versions/{versionId}/restore` | 👑 | Khôi phục version cũ làm current |
| | | **Search** | | |
| 26 | GET | `/documents/search` | 🔒 | Full-text search permission-aware |
| 27 | GET | `/documents/search/suggestions` | 🔒 | Suggestions/autocomplete |
| | | **Master Data** | | |
| 28 | GET | `/categories` | 🔒 | Danh sách danh mục |
| 29 | GET | `/categories/{id}` | 🔒 | Chi tiết danh mục |
| 30 | POST | `/categories` | 👑 | Tạo danh mục |
| 31 | PUT | `/categories/{id}` | 👑 | Cập nhật danh mục |
| 32 | DELETE | `/categories/{id}` | 👑 | Xóa mềm danh mục |
| 33 | GET | `/departments` | 🔒 | Danh sách phòng ban |
| 34 | GET | `/departments/{id}` | 🔒 | Chi tiết phòng ban |
| 35 | POST | `/departments` | 👑 | Tạo phòng ban |
| 36 | PUT | `/departments/{id}` | 👑 | Cập nhật phòng ban |
| 37 | DELETE | `/departments/{id}` | 👑 | Xóa mềm phòng ban |
| 38 | GET | `/tags` | 🔒 | Danh sách tags |
| 39 | GET | `/tags/{id}` | 🔒 | Chi tiết tag |
| 40 | POST | `/tags` | 👑 | Tạo tag |
| 41 | PUT | `/tags/{id}` | 👑 | Cập nhật tag |
| 42 | DELETE | `/tags/{id}` | 👑 | Xóa mềm tag |
| | | **Dashboard & Audit** | | |
| 43 | GET | `/admin/dashboard/summary` | 👑 | Thống kê tổng quan |
| 44 | GET | `/admin/dashboard/top-documents` | 👑 | Tài liệu được xem/tải nhiều nhất |
| 45 | GET | `/admin/dashboard/recent-uploads` | 👑 | Tài liệu upload gần đây |
| 46 | GET | `/admin/dashboard/top-search-keywords` | 👑 | Từ khóa tìm kiếm phổ biến |
| 47 | GET | `/admin/dashboard/access-stats` | 👑 | Thống kê preview/download/view |
| 48 | GET | `/admin/dashboard/processing-errors` | 👑 | Lỗi extraction/indexing |
| 49 | GET | `/admin/audit-logs` | 👑 | Tra cứu audit/access/search logs |

---

## 10. Tài Liệu Liên Quan

| Tài liệu | Đường dẫn |
|----------|-----------|
| Thiết kế chi tiết | [design.md](./design.md) |
| Database schema | [DATABASE.md](./DATABASE.md) |
| Architecture | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| System Architecture | [sa/sa.md](./sa/sa.md) |
| Đặc tả yêu cầu | [spec/specs.md](./spec/specs.md) |
