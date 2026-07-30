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
| `INDEXING_FAILED` | Refresh PostgreSQL search vector thất bại |
| `INVALID_CREDENTIALS` | Email hoặc mật khẩu sai |
| `TOKEN_EXPIRED` | JWT đã hết hạn |
| `ACCESS_DENIED` | Không có quyền truy cập |
| `INVALID_ACCESS_LEVEL` | `accessLevel` không hợp lệ |
| `INVALID_ACL_RULE` | Thiếu department/user ACL tương ứng `accessLevel` |
| `VERSION_NOT_FOUND` | Phiên bản tài liệu không tồn tại |
| `VERSION_DUPLICATE` | Số phiên bản đã tồn tại |
| `BATCH_OPERATION_PARTIAL_FAILED` | Batch operation có một phần item thất bại |
| `DOCUMENT_ALREADY_DELETED` | Tài liệu đã nằm trong Thùng rác |
| `TRASH_ITEM_EXPIRED` | Tài liệu trong Thùng rác đã quá hạn hoặc đã bị purge |
| `UPLOAD_NOT_COMPLETED` | Gọi complete nhưng object chưa tồn tại trên storage |
| `UPLOAD_SIZE_MISMATCH` | Size object thực tế khác size đã khai/ký |
| `PRESIGN_FAILED` | Không ký được presigned URL do lỗi cấu hình storage/credential |
| `DOCUMENT_NOT_READY` | Xin download/preview URL khi document chưa sẵn sàng theo policy |

### Supported File Types & Upload Validation

| MIME Type | Extension | Extraction | Preview |
|-----------|-----------|:---:|:---:|
| `application/pdf` | `.pdf` | PDFBox cho PDF text; Tesseract OCR cho scan | Presigned inline PDF |
| `application/msword` | `.doc` | POI HWPF | Convert PDF/HTML |
| `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | `.docx` | POI XWPF | Convert PDF/HTML |
| `application/vnd.ms-excel` | `.xls` | POI | HTML table/PDF |
| `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | `.xlsx` | POI | HTML table/PDF |
| `image/jpeg` | `.jpg`, `.jpeg` | Tesseract OCR | Image stream |
| `image/png` | `.png` | Tesseract OCR | Image stream |
| `image/tiff` | `.tiff` | Tesseract OCR | Image stream |

Upload rules:

- Upload dùng flow presigned URL: backend ký URL, client PUT file trực tiếp lên object storage, rồi gọi complete.
- Mỗi flow upload xử lý đúng 1 file, file size tối đa `50MB`.
- `upload-init` validate sơ bộ extension, MIME khai báo, kích thước và metadata; backend sinh `storage_path` UUID/generated key, client không được chọn object key.
- `upload-complete` HEAD object, kiểm tra size thực tế và validate MIME thực tế bằng Apache Tika trước khi chuyển sang `PROCESSING`.
- Chặn `.exe`, `.sh`, `.bat`, `.cmd`, `.js`, `.html`, `.htm`, `.jar`, `.msi`, `.ps1`, `.vbs`.
- `file_name` là tên gốc đã sanitize để hiển thị/download, không dùng để tạo path lưu trữ.
- Upload version mới phải đi qua cùng flow init/complete và validation như upload tài liệu lần đầu.

### Shared Enums

| Enum | Values |
|------|--------|
| `Role` | `ADMIN`, `USER` |
| `UserStatus` | `ACTIVE`, `INACTIVE`, `BANNED` |
| `DocumentStatus` | `AWAITING_UPLOAD`, `PROCESSING`, `INDEXED`, `EXTRACTION_FAILED`, `ARCHIVED`, `DELETED` |
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

**Token Storage & Browser Flow:**

- Frontend lưu access token trong memory, không lưu LocalStorage/SessionStorage.
- Khi reload tab, access token trong memory mất; frontend gọi `POST /auth/refresh` để khôi phục session.
- Nếu refresh thất bại do cookie hết hạn/revoked/user inactive, frontend redirect về login.

**Cookie, CORS & CSRF Decisions:**

- Production ưu tiên deploy frontend/backend cùng site/domain và dùng `SameSite=Strict; Secure; HttpOnly`.
- Nếu frontend/backend khác site, chỉ cho phép credentialed CORS với allowlist origin cụ thể, không dùng wildcard `*`, và refresh cookie phải dùng `SameSite=None; Secure`.
- `POST /auth/refresh` và `POST /auth/logout` phải có CSRF protection khi cookie refresh token được gửi cross-site. Cơ chế đề xuất: double-submit CSRF token hoặc custom CSRF header.
- Logout phải revoke refresh token phía server và xóa cookie bằng `Set-Cookie` có cùng `Path`, `SameSite`, `Secure` với cookie đã set.

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


### Document Code Generation

`documentCode` là mã tài liệu do backend tự sinh, không phải field Admin nhập khi upload.

Recommended format:

```text
DMS-{yyyyMM}-{sequence6}
Ví dụ: DMS-202607-000001
```

Rules:

- Sinh trong transaction khi tạo document metadata.
- Sequence tăng đơn điệu theo tháng hoặc toàn hệ thống, miễn đảm bảo unique.
- `document_code` vẫn có unique index để chống trùng khi concurrent upload.
- Frontend hiển thị mã tài liệu sau khi upload thành công hoặc trong detail/list.
- Admin không được sửa `documentCode` qua form upload/edit metadata; nếu sau này cần chỉnh mã thủ công phải là tính năng riêng có audit chặt.
- Search vẫn exact/boosted match theo `documentCode` vì đây là mã tra cứu chính thức của hệ thống.

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

### `POST /documents/upload-init` 👑

Admin khởi tạo upload tài liệu mới. Backend validate metadata và thông tin file khai báo, tạo row `documents` với `status = AWAITING_UPLOAD`, sinh `storage_path` UUID/generated key và trả presigned PUT URL để client upload byte trực tiếp lên object storage.

**Request Body:**
```json
{
  "fileName": "ISO_9001_QA_Process.pdf",
  "fileSize": 2048576,
  "contentType": "application/pdf",
  "title": "Quy trình ISO 9001 - Quản lý chất lượng",
  "description": "Tài liệu mô tả quy trình quản lý chất lượng",
  "categoryId": 1,
  "departmentId": 3,
  "tagIds": [1, 5],
  "accessLevel": "DEPARTMENT",
  "departmentIds": [3],
  "ownerId": 10,
  "sharedUserIds": [],
  "effectiveDate": "2026-01-01",
  "expiryDate": null
}
```

**ACL Rules:**

- `PUBLIC`: bỏ qua `departmentIds` và `sharedUserIds`; mọi user đăng nhập được xem sau khi tài liệu `INDEXED`.
- `DEPARTMENT`: `departmentIds` phải có ít nhất 1 phần tử.
- `RESTRICTED`: `ownerId` hoặc `sharedUserIds` phải có ít nhất một user; owner luôn có quyền xem.

**Success Response (201):**
```json
{
  "success": true,
  "message": "Upload URL created",
  "data": {
    "documentId": 42,
    "status": "AWAITING_UPLOAD",
    "objectKey": "8f3b7b0c-uuid",
    "uploadUrl": "https://storage.example.com/dms-documents/8f3b7b0c-uuid?X-Amz-Signature=...",
    "method": "PUT",
    "requiredHeaders": {
      "Content-Type": "application/pdf"
    },
    "expiresIn": 300
  }
}
```

Client phải PUT đúng file lên `uploadUrl` trong vòng 5 phút với `Content-Type` và `Content-Length` khớp thông tin đã khai báo. Bucket object storage là private; credential ký URL chỉ nằm ở backend.

### `POST /documents/{id}/upload-complete` 👑

Admin xác nhận client đã PUT file xong. Backend HEAD object để xác nhận tồn tại và đúng size, đọc object để Tika detect MIME thực tế, validate extension/MIME/dangerous type, rồi chuyển document sang `PROCESSING`. Sau transaction commit, backend publish message `EXTRACT` vào RabbitMQ queue `dms.extract`; API không chờ extraction/index hoàn tất.

**Success Response (200):**
```json
{
  "success": true,
  "message": "Document upload accepted",
  "data": {
    "id": 42,
    "status": "PROCESSING",
    "documentCode": "DMS-202607-000001",
    "versionId": 101,
    "versionNumber": "1.0",
    "createdAt": "2026-07-21T10:30:00"
  }
}
```

Nếu object chưa tồn tại, size lệch, MIME thực tế không khớp hoặc thuộc loại nguy hiểm, backend xóa object nếu cần, giữ/xóa row theo cleanup policy và trả lỗi tương ứng (`UPLOAD_NOT_COMPLETED`, `UPLOAD_SIZE_MISMATCH`, `MIME_TYPE_MISMATCH`, `DANGEROUS_FILE_TYPE`).

Sau khi complete thành công, extraction, preview artifact generation và refresh PostgreSQL search vector chạy trong worker RabbitMQ. `status` chuyển `INDEXED` hoặc `EXTRACTION_FAILED`. Các field phụ thuộc xử lý async như preview artifact, extracted content hoặc searchable chỉ sẵn sàng sau khi status chuyển `INDEXED`.

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
    "previewUrlEndpoint": "/api/v1/documents/42/preview-url",
    "downloadUrlEndpoint": "/api/v1/documents/42/download-url",
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
  "tagIds": [1, 5, 8],
  "accessLevel": "RESTRICTED",
  "ownerId": 10,
  "departmentIds": [],
  "sharedUserIds": [12, 15],
  "effectiveDate": "2026-07-01",
  "expiryDate": "2027-07-01"
}
```

**Success Response (200):** trả `DocumentDetailDto` đã cập nhật. Metadata/ACL thay đổi phải refresh PostgreSQL search row và ghi `audit_logs`. `documentCode` là mã hệ thống tự sinh, không cho sửa qua endpoint metadata.

### `DELETE /documents/{id}` 👑

Soft delete tài liệu: set `status = DELETED`, `deleted_at`, `deleted_by`, `purge_after = deleted_at + 30 ngày`, lưu `previous_status`, cập nhật PostgreSQL FTS để loại khỏi search mặc định và đưa tài liệu vào Thùng rác.

**Success Response (204):** No Content

### `POST /documents/{id}/archive` 👑

Archive tài liệu đang sử dụng: set `status = ARCHIVED`, `archived_at`; search query mặc định tự loại khỏi kết quả.

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

Retry extraction hoặc refresh search vector cho tài liệu `EXTRACTION_FAILED` hoặc tài liệu có lỗi refresh search gần nhất.

**Success Response (200):**
```json
{
  "success": true,
  "message": "Retry search refresh started",
  "data": {
    "id": 42,
    "status": "PROCESSING",
    "retryCount": 2
  }
}
```


### `POST /documents/batch-upload-init` 👑

Admin khởi tạo upload nhiều file bằng presigned URL. Backend validate metadata chung và thông tin khai báo của từng file, tạo document/version riêng cho từng item hợp lệ, trả danh sách presigned PUT URL để client upload từng file trực tiếp lên object storage. Không có endpoint multipart upload qua Spring.

**Request Body:**
```json
{
  "files": [
    { "clientItemId": "item-1", "fileName": "policy.pdf", "fileSize": 2048576, "contentType": "application/pdf", "title": "Chính sách nội bộ" },
    { "clientItemId": "item-2", "fileName": "manual.docx", "fileSize": 1048576, "contentType": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "title": "Hướng dẫn vận hành" }
  ],
  "categoryId": 1,
  "departmentId": 3,
  "tagIds": [1, 5],
  "accessLevel": "DEPARTMENT",
  "departmentIds": [3],
  "ownerId": 10,
  "sharedUserIds": [],
  "effectiveDate": "2026-01-01",
  "expiryDate": null
}
```

**Business Rules:**

- Validate extension, MIME khai báo và size theo từng item ở init; `batch-upload-complete` validate object thực tế bằng HEAD + Tika.
- Cho phép partial success; item lỗi không rollback item hợp lệ.
- Mỗi item hợp lệ nhận `documentId`, `documentCode` tự sinh và presigned PUT URL riêng.
- Client PUT từng file bằng URL tương ứng, rồi gọi `POST /documents/batch-upload-complete` với danh sách item đã upload.
- Ghi audit log cho từng document upload complete thành công.

**Success Response (200):**
```json
{
  "success": true,
  "message": "Batch upload URLs created",
  "data": {
    "total": 3,
    "succeeded": 2,
    "failed": 1,
    "items": [
      { "clientItemId": "item-1", "fileName": "policy.pdf", "success": true, "documentId": 101, "documentCode": "DMS-202607-000001", "status": "AWAITING_UPLOAD", "uploadUrl": "https://storage.example.com/dms-documents/uuid-101?X-Amz-Signature=...", "method": "PUT", "requiredHeaders": { "Content-Type": "application/pdf" }, "expiresIn": 300 },
      { "clientItemId": "item-2", "fileName": "manual.docx", "success": true, "documentId": 102, "documentCode": "DMS-202607-000002", "status": "AWAITING_UPLOAD", "uploadUrl": "https://storage.example.com/dms-documents/uuid-102?X-Amz-Signature=...", "method": "PUT", "requiredHeaders": { "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }, "expiresIn": 300 },
      { "clientItemId": "item-3", "fileName": "script.exe", "success": false, "errorCode": "DANGEROUS_FILE_TYPE", "message": "File type is blocked" }
    ]
  }
}
```

### `POST /documents/batch-upload-complete` 👑

Xác nhận nhiều item đã PUT xong. Backend xử lý từng item như `upload-complete`: HEAD object, validate size/MIME thực tế bằng Tika, chuyển item hợp lệ sang `PROCESSING`, commit rồi publish RabbitMQ task riêng.

**Request Body:**
```json
{
  "items": [
    { "documentId": 101 },
    { "documentId": 102 }
  ]
}
```

Response dùng cùng partial success format; item thành công trả `status = PROCESSING`.

### `POST /documents/batch-delete` 👑

Soft delete nhiều tài liệu và đưa vào Thùng rác.

**Request Body:**
```json
{
  "documentIds": [42, 43, 44],
  "reason": "Remove outdated files"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Batch delete completed",
  "data": {
    "total": 3,
    "succeeded": 2,
    "failed": 1,
    "items": [
      { "documentId": 42, "success": true, "status": "DELETED" },
      { "documentId": 43, "success": true, "status": "DELETED" },
      { "documentId": 44, "success": false, "errorCode": "DOCUMENT_NOT_FOUND" }
    ]
  }
}
```

### `POST /documents/{id}/move` 👑

Chuyển một tài liệu sang category/folder khác. Đây là thao tác nghiệp vụ riêng dù về dữ liệu là cập nhật `documents.category_id`.

**Request Body:**
```json
{
  "targetCategoryId": 8
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Document moved successfully",
  "data": {
    "id": 42,
    "previousCategory": { "id": 1, "name": "Quy trình ISO" },
    "category": { "id": 8, "name": "Biểu mẫu QA" }
  }
}
```

Business rules: target category phải tồn tại, active và chưa soft delete; backend ghi audit log category cũ/mới và re-index metadata.

### `POST /documents/batch-move` 👑

Chuyển nhiều tài liệu sang cùng một category/folder.

**Request Body:**
```json
{
  "documentIds": [42, 43, 44],
  "targetCategoryId": 8
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Batch move completed",
  "data": {
    "total": 3,
    "succeeded": 3,
    "failed": 0,
    "targetCategory": { "id": 8, "name": "Biểu mẫu QA" },
    "items": [
      { "documentId": 42, "success": true },
      { "documentId": 43, "success": true },
      { "documentId": 44, "success": true }
    ]
  }
}
```

### Trash / Recycle Bin APIs 👑

Trash list chỉ lấy từ PostgreSQL vì tài liệu `DELETED` bị loại khỏi PostgreSQL FTS search mặc định.

#### `GET /documents/trash`

**Query Params:**

| Param | Type | Description |
|-------|------|-------------|
| `categoryId` | Long | Lọc theo danh mục/folder |
| `deletedBy` | Long | Lọc theo người xóa |
| `deletedFrom` | DateTime | Xóa từ thời điểm |
| `deletedTo` | DateTime | Xóa đến thời điểm |
| `fileType` | String | Lọc theo loại file |
| `page` | Int | Default `0` |
| `size` | Int | Default `20`, max `100` |

**Success Response item:**
```json
{
  "id": 42,
  "title": "Quy trình ISO 9001",
  "fileName": "ISO_9001.pdf",
  "fileType": "PDF",
  "fileSize": 2048576,
  "fileSizeMb": 1.95,
  "status": "DELETED",
  "category": { "id": 1, "name": "Quy trình ISO" },
  "deletedBy": { "id": 1, "name": "Admin" },
  "deletedAt": "2026-07-21T15:00:00",
  "purgeAfter": "2026-08-20T15:00:00",
  "daysUntilPurge": 30
}
```

#### `POST /documents/trash/restore`

```json
{
  "documentIds": [42, 43]
}
```

Response dùng cùng partial success format như batch delete. Restore clear `deleted_at`, `deleted_by`, `purge_after`; status trở về `previous_status` nếu an toàn, hoặc `PROCESSING` nếu cần re-index.

#### `DELETE /documents/trash/permanent-delete`

```json
{
  "documentIds": [42, 43]
}
```

Xóa vĩnh viễn file hiện tại, version files, extracted content và PostgreSQL search row; audit logs vẫn được giữ. Endpoint này chỉ dành cho Admin.

### Internal scheduled job: `purgeDeletedDocuments`

- Frequency: daily.
- Condition: `documents.status = DELETED AND documents.purge_after <= now()`.
- Action: permanent delete storage/content/search artifacts theo cùng rule với `DELETE /documents/trash/permanent-delete`.
- Job phải idempotent; lỗi xóa object storage được log và retry ở lần chạy sau.

---

## 4. Preview, Download & Versions

### `GET /documents/{id}/preview-url` 🔒

Trả presigned GET URL để preview tài liệu trên trình duyệt. Backend kiểm tra quyền bằng cùng logic với detail/search/download, chỉ cấp URL khi tài liệu đủ điều kiện preview. User chỉ được cấp URL cho tài liệu `INDEXED`; Admin được preview thêm `ARCHIVED` nếu policy quản trị cho phép. Không cấp URL cho `AWAITING_UPLOAD`, `PROCESSING`, `EXTRACTION_FAILED` hoặc `DELETED`.

Backend tăng `view_count` và ghi `access_logs` action `PREVIEW` tại thời điểm cấp URL thành công. Với presigned URL, log này mang nghĩa “đã cấp quyền preview”, không đảm bảo browser tải artifact thành công.

**Response:**

| File | Presigned target | Content-Disposition |
|------|------------------|---------------------|
| PDF | Object gốc | `inline` |
| DOC/DOCX | Preview artifact PDF/HTML đã sanitize | `inline` |
| XLS/XLSX | Preview artifact PDF/HTML đã sanitize | `inline` |
| Image | Object gốc | `inline` |

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "url": "https://storage.example.com/dms-documents/preview/8f3b7b0c.pdf?X-Amz-Signature=...",
    "fileName": "ISO_9001_QA_Process.pdf",
    "contentType": "application/pdf",
    "expiresIn": 300
  }
}
```

### `GET /documents/{id}/download-url` 🔒

Trả presigned GET URL để tải file gốc. Backend kiểm tra quyền, kiểm tra trạng thái, tăng `download_count` và ghi `access_logs` action `DOWNLOAD` tại thời điểm cấp URL thành công. Với presigned URL, `download_count` mang nghĩa “lượt cấp URL tải”, không phải “lượt tải hoàn tất”.

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "url": "https://storage.example.com/dms-documents/8f3b7b0c-uuid?X-Amz-Signature=...&response-content-disposition=attachment",
    "fileName": "ISO_9001_QA_Process.pdf",
    "contentType": "application/pdf",
    "expiresIn": 300
  }
}
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

### `POST /documents/{id}/versions/init` 👑

Admin khởi tạo upload phiên bản mới. Backend validate `versionNumber`, `changelog` và thông tin file khai báo, tạo `document_versions` ở trạng thái chờ complete theo policy version, sinh object key riêng và trả presigned PUT URL. Version mới chưa trở thành current version ở bước này.

**Request Body:**
```json
{
  "fileName": "ISO_9001_v1.3.pdf",
  "fileSize": 2200000,
  "contentType": "application/pdf",
  "versionNumber": "1.3",
  "changelog": "Cập nhật biểu mẫu kiểm tra"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "Version upload URL created",
  "data": {
    "documentId": 42,
    "versionId": 4,
    "objectKey": "version/8f3b7b0c-uuid",
    "uploadUrl": "https://storage.example.com/dms-documents/version/8f3b7b0c-uuid?X-Amz-Signature=...",
    "method": "PUT",
    "requiredHeaders": {
      "Content-Type": "application/pdf"
    },
    "expiresIn": 300
  }
}
```

### `POST /documents/{id}/versions/{versionId}/complete` 👑

Xác nhận file version đã PUT xong. Backend HEAD object, validate size/MIME thực tế bằng Tika, chuyển tài liệu sang `PROCESSING` và publish `EXTRACT` vào RabbitMQ. Version mới chỉ được set làm current sau khi extraction, preview artifact cần thiết và refresh search vector thành công; nếu xử lý thất bại, current version cũ vẫn phục vụ User.

**Success Response (200):**
```json
{
  "success": true,
  "message": "New version upload accepted",
  "data": {
    "id": 4,
    "documentId": 42,
    "versionNumber": "1.3",
    "documentStatus": "PROCESSING",
    "createdAt": "2026-07-21T15:00:00"
  }
}
```

### `GET /documents/{id}/versions/{versionId}/download-url` 🔒

Trả presigned GET URL để tải file của một version cụ thể. Backend kiểm tra quyền truy cập document và ghi access log action `VERSION_DOWNLOAD` tại thời điểm cấp URL.

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "url": "https://storage.example.com/dms-documents/version/8f3b7b0c-uuid?X-Amz-Signature=...",
    "fileName": "ISO_9001_v1.1.pdf",
    "contentType": "application/pdf",
    "expiresIn": 300
  }
}
```

### `POST /documents/{id}/versions/{versionId}/restore` 👑

Khôi phục một version cũ thành current version. Không xóa version hiện tại; cập nhật `documents.version_number`, trích xuất lại content và refresh search vector.

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

Full-text search qua PostgreSQL `tsvector`/`tsquery` trên title, description, extracted content, document code và tags. Query phải áp permission filter ngay trong SQL trước khi trả kết quả.

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


### `GET /admin/dashboard/storage` 👑

Trả thống kê dung lượng lưu trữ cho dashboard Admin.

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "activeStorageBytes": 524288000,
    "activeStorageMb": 500.0,
    "trashStorageBytes": 104857600,
    "trashStorageMb": 100.0,
    "versionStorageBytes": 209715200,
    "versionStorageMb": 200.0,
    "totalStorageBytes": 838860800,
    "totalStorageMb": 800.0,
    "documentCount": 1200,
    "trashDocumentCount": 45
  }
}
```

Calculation rules:

- `activeStorageBytes`: `SUM(documents.file_size)` với `status != DELETED`.
- `trashStorageBytes`: `SUM(documents.file_size)` với `status = DELETED`.
- `versionStorageBytes`: `SUM(document_versions.file_size)` nếu historical versions lưu file riêng.
- MB = bytes / 1024 / 1024, làm tròn 2 chữ số.


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
    "totalStorageMb": 800.0,
    "totalPreviewCount": 15000,
    "totalDownloadCount": 5200,
    "totalSearchCount": 8700,
    "totalLoginCount": 2400,
    "activeUserCount": 65,
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
| `GET` | `/admin/dashboard/system-access` | Tổng quan dữ liệu truy cập hệ thống |
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


### `GET /admin/dashboard/system-access` 👑

Trả dữ liệu truy cập hệ thống cho Admin, phục vụ dashboard tổng quan mức độ sử dụng DMS.

**Query Params:**

| Param | Type | Description |
|-------|------|-------------|
| `dateFrom` | DateTime | Bắt đầu khoảng thống kê |
| `dateTo` | DateTime | Kết thúc khoảng thống kê |
| `granularity` | String | `day`, `week`, `month`; default `day` |
| `departmentId` | Long | Lọc user theo phòng ban |
| `userId` | Long | Lọc theo user cụ thể |
| `action` | String | `LOGIN`, `VIEW`, `PREVIEW`, `DOWNLOAD`, `VERSION_DOWNLOAD`, `SEARCH`, `DENIED` |

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "totalLogins": 2400,
    "activeUsers": 65,
    "uniqueAccessUsers": 58,
    "viewCount": 3200,
    "previewCount": 15000,
    "downloadCount": 5200,
    "searchCount": 8700,
    "deniedAccessCount": 34,
    "accessByAction": {
      "VIEW": 3200,
      "PREVIEW": 15000,
      "DOWNLOAD": 5200,
      "VERSION_DOWNLOAD": 310,
      "SEARCH": 8700
    },
    "accessTrend": [
      { "date": "2026-07-21", "logins": 120, "previews": 820, "downloads": 240, "searches": 410, "uniqueUsers": 38 }
    ],
    "topUsersByAccess": [
      { "userId": 12, "name": "Nguyễn Văn A", "department": "QA", "accessCount": 420 }
    ]
  }
}
```

Data sources:

- `audit_logs`: login/logout và hành động quản trị.
- `access_logs`: metadata view, preview, download, version download, denied access.
- `search_logs`: search/suggestions usage.

Không trả token/cookie hoặc dữ liệu nhạy cảm trong dashboard; IP/User-Agent chỉ dùng ở màn Audit nếu Admin cần điều tra chi tiết.

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
| 12 | POST | `/documents/upload-init` | 👑 | Khởi tạo upload tài liệu, trả presigned PUT URL |
| 13 | GET | `/documents` | 🔒 | Danh sách tài liệu theo quyền hiện tại |
| 14 | GET | `/documents/{id}` | 🔒 | Chi tiết tài liệu |
| 15 | PUT | `/documents/{id}` | 👑 | Cập nhật metadata, tags, ACL |
| 16 | DELETE | `/documents/{id}` | 👑 | Xóa tài liệu soft delete |
| 17 | POST | `/documents/{id}/archive` | 👑 | Archive tài liệu |
| 18 | POST | `/documents/{id}/restore` | 👑 | Restore tài liệu đã archive/delete |
| 19 | POST | `/documents/{id}/retry-indexing` | 👑 | Retry extraction/search refresh |
| 20 | GET | `/documents/{id}/preview-url` | 🔒 | Lấy presigned URL preview |
| 21 | GET | `/documents/{id}/download-url` | 🔒 | Lấy presigned URL tải tài liệu |
| 22 | GET | `/documents/{id}/versions` | 🔒 | Lịch sử phiên bản |
| 23 | POST | `/documents/{id}/versions/init` | 👑 | Khởi tạo upload phiên bản mới |
| 24 | GET | `/documents/{id}/versions/{versionId}/download-url` | 🔒 | Lấy presigned URL tải phiên bản cũ |
| 25 | POST | `/documents/{id}/versions/{versionId}/complete` | 👑 | Xác nhận upload version xong |
| 26 | POST | `/documents/{id}/versions/{versionId}/restore` | 👑 | Khôi phục version cũ làm current |
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
| 49 | GET | `/admin/dashboard/system-access` | 👑 | Dữ liệu truy cập hệ thống |
| 50 | GET | `/admin/audit-logs` | 👑 | Tra cứu audit/access/search logs |
| | | **Batch & Trash** | | |
| 51 | POST | `/documents/batch-upload-init` | 👑 | Khởi tạo upload nhiều file, trả presigned PUT URL theo item |
| 52 | POST | `/documents/batch-upload-complete` | 👑 | Xác nhận nhiều item đã PUT xong |
| 53 | POST | `/documents/batch-delete` | 👑 | Xóa mềm nhiều tài liệu vào Thùng rác |
| 53 | POST | `/documents/{id}/move` | 👑 | Chuyển một tài liệu sang category/folder khác |
| 54 | POST | `/documents/batch-move` | 👑 | Chuyển nhiều tài liệu sang category/folder khác |
| 55 | GET | `/documents/trash` | 👑 | Danh sách tài liệu trong Thùng rác |
| 56 | POST | `/documents/trash/restore` | 👑 | Restore nhiều tài liệu từ Thùng rác |
| 57 | DELETE | `/documents/trash/permanent-delete` | 👑 | Xóa vĩnh viễn tài liệu trong Thùng rác |
| 58 | GET | `/admin/dashboard/storage` | 👑 | Thống kê dung lượng lưu trữ theo MB |

---

## 10. Tài Liệu Liên Quan

| Tài liệu | Đường dẫn |
|----------|-----------|
| Thiết kế chi tiết | [design.md](./design.md) |
| Database schema | [DATABASE.md](./DATABASE.md) |
| Architecture | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| System Architecture | [sa/sa.md](./sa/sa.md) |
| Đặc tả yêu cầu | [spec/specs.md](./spec/specs.md) |
