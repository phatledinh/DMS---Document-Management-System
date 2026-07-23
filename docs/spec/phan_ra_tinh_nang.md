# Phân Rã Tính Năng — DMS

> Phân rã chi tiết tất cả tính năng (features) của hệ thống DMS, tổ chức theo phân hệ.

---

## Tổng quan tính năng

| Phân hệ | Số tính năng | Ưu tiên |
|----------|:---:|:---:|
| PH1: Identity | 7 | Cao |
| PH2: Document Management | 11 | Cao (Core) |
| PH3: Search Engine | 4 | Cao (Core) |
| PH4: Master Data | 9 | Trung bình |
| PH5: Dashboard | 3 | Thấp |
| **Tổng** | **34** | |

---

## PH1: Identity — Quản lý Người dùng & Phân quyền

### F1.1: Đăng nhập (Login)

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin, User |
| Mô tả | Đăng nhập bằng email + password |
| Input | `email` (required), `password` (required) |
| Output | Access Token (JWT, 15 phút) + Refresh Token (HttpOnly Cookie, 7 ngày) |
| Business Rules | - Email phải tồn tại và active<br>- Password phải match (BCrypt)<br>- Cập nhật `last_login` |
| API | `POST /auth/login` 🔓 |

### F1.2: Refresh Token

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | System (Frontend interceptor) |
| Mô tả | Tự động refresh Access Token khi hết hạn |
| Input | Refresh Token từ HttpOnly Cookie |
| Output | Access Token mới |
| Business Rules | - Refresh Token phải chưa hết hạn và chưa bị revoke<br>- Nếu không hợp lệ → redirect Login |
| API | `POST /auth/refresh` 🔓 |

### F1.3: Đăng xuất (Logout)

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin, User |
| Mô tả | Đăng xuất, thu hồi Refresh Token |
| Business Rules | - Revoke Refresh Token trong DB<br>- Xóa HttpOnly Cookie |
| API | `POST /auth/logout` 🔒 |

### F1.4: Xem Profile cá nhân

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin, User |
| Mô tả | Xem thông tin cá nhân (name, email, phone, avatar, department, role) |
| API | `GET /users/me` 🔒 |

### F1.5: Sửa Profile cá nhân

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin, User |
| Mô tả | Cập nhật tên, phone, avatar |
| Business Rules | - Không được tự đổi role<br>- Không được tự đổi email |
| API | `PUT /users/me` 🔒 |

### F1.6: Quản lý User (Admin CRUD)

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin |
| Mô tả | Danh sách, tạo, sửa, xóa user |
| Chức năng con | - Xem danh sách user (pagination, filter theo role, department, status)<br>- Xem chi tiết user<br>- Tạo user mới<br>- Cập nhật user (bao gồm đổi role, department, status)<br>- Xóa user (soft delete) |
| API | `GET/POST/PUT/DELETE /users`, `/users/{id}` 👑 |

### F1.7: Tạo tài khoản (Admin Register)

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin |
| Mô tả | Admin tạo tài khoản cho nhân viên (không mở public) |
| Input | `name`, `email`, `password`, `phone`, `role`, `departmentId` |
| Business Rules | - Email phải unique<br>- Phải chọn department tồn tại |
| API | `POST /auth/register` 👑 |

---

## PH2: Document Management — Quản lý Tài liệu

### F2.1: Upload tài liệu

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin |
| Mô tả | Upload file tài liệu mới kèm metadata |
| Input | `file` (required, max 50MB), `title`, `description`, `categoryId`, `departmentId`, `documentCode`, `tagIds`, `isPublic`, `effectiveDate`, `expiryDate` |
| Output | Document record với status = PROCESSING |
| Business Rules | - Validate file type (pdf, doc, docx, xls, xlsx, jpg, png, tiff)<br>- Validate file size ≤ 50MB<br>- `documentCode` phải unique nếu có<br>- `title` tự động tạo `slug`<br>- Tự động tạo version 1.0 |
| API | `POST /documents` 👑 (multipart/form-data) |

### F2.2: Trích xuất nội dung file (Content Extraction)

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | System (Background) |
| Mô tả | Tự động trích xuất text từ file sau khi upload |
| Processing | - PDF → PDFBox<br>- DOCX → POI (XWPF)<br>- DOC → POI (HWPF)<br>- XLS/XLSX → POI<br>- Image → OCR (Phase 2) |
| Output | `extracted_text` lưu trong `document_contents` |
| Business Rules | - Chạy async/background<br>- Cập nhật status: PROCESSING → INDEXED / EXTRACTION_FAILED<br>- Retry tự động mỗi 30 phút cho documents bị lỗi |

### F2.3: Danh sách tài liệu

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin, User |
| Mô tả | Xem danh sách tài liệu với pagination và filters |
| Filters | `categoryId`, `departmentId`, `fileType`, `status`, `tagIds`, `effectiveDateFrom/To` |
| Sort | `created_at_desc` (default), `created_at_asc`, `title_asc`, `view_count_desc`, `download_count_desc` |
| Pagination | `page` (default: 0), `size` (default: 20, max: 100) |
| API | `GET /documents` 🔒 |

### F2.4: Chi tiết tài liệu

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin, User |
| Mô tả | Xem chi tiết metadata tài liệu |
| Business Rules | - Tự động tăng `view_count`<br>- Trả về `previewUrl` và `downloadUrl` |
| API | `GET /documents/{id}` 🔒 |

### F2.5: Cập nhật metadata tài liệu

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin |
| Mô tả | Cập nhật tiêu đề, mô tả, danh mục, phòng ban, tags, ngày hiệu lực |
| Business Rules | - Không cập nhật file (dùng F2.9 để upload version mới)<br>- `documentCode` phải unique nếu thay đổi |
| API | `PUT /documents/{id}` 👑 |

### F2.6: Xóa tài liệu

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin |
| Mô tả | Xóa mềm tài liệu (set `deleted_at`) |
| Business Rules | - Soft delete, có thể restore<br>- Xóa khỏi search index |
| API | `DELETE /documents/{id}` 👑 |

### F2.7: Preview tài liệu

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin, User |
| Mô tả | Xem tài liệu trực tiếp trên trình duyệt |
| Processing | - PDF → Stream trực tiếp<br>- DOCX/DOC → Convert → PDF stream<br>- XLS/XLSX → Convert → PDF/HTML<br>- Image → Stream trực tiếp |
| API | `GET /documents/{id}/preview` 🔒 |

### F2.8: Download tài liệu

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin, User |
| Mô tả | Tải file gốc về máy |
| Business Rules | - Tự động tăng `download_count`<br>- Trả file với `Content-Disposition: attachment` |
| API | `GET /documents/{id}/download` 🔒 |

### F2.9: Upload phiên bản mới

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin |
| Mô tả | Upload file phiên bản mới cho tài liệu đã tồn tại |
| Input | `file` (required), `versionNumber` (required), `changelog` |
| Business Rules | - File cũ giữ lại trong lịch sử<br>- Cập nhật `version_number` trong documents<br>- Trích xuất nội dung mới & re-index |
| API | `POST /documents/{id}/versions` 👑 |

### F2.10: Xem lịch sử phiên bản

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin, User |
| Mô tả | Danh sách các phiên bản của tài liệu |
| API | `GET /documents/{id}/versions` 🔒 |

### F2.11: Tải phiên bản cũ

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin, User |
| Mô tả | Tải file của một phiên bản cụ thể |
| API | `GET /documents/{id}/versions/{versionId}/download` 🔒 |

---

## PH3: Search Engine — Tìm kiếm

### F3.1: Tìm kiếm full-text

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin, User |
| Mô tả | Tìm kiếm tài liệu theo từ khóa trong tiêu đề + mô tả + nội dung file |
| Input | `q` (required), `categoryId`, `departmentId`, `fileType`, `tagIds`, `dateFrom/To`, `sort`, `page`, `size` |
| Output | Danh sách kết quả + highlight + relevance score + search time |
| API | `GET /documents/search` 🔒 |

### F3.2: Highlight kết quả

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | System |
| Mô tả | Đánh dấu `<em>` tại vị trí match trong tiêu đề và nội dung |
| Business Rules | - Sử dụng Elasticsearch native highlight cho `title`, `description`, `extracted_text`<br>- Backend sanitize highlight trước khi trả về frontend |

### F3.3: Sắp xếp kết quả

| Thuộc tính | Chi tiết |
|------------|----------|
| Mô tả | Sắp xếp kết quả tìm kiếm theo nhiều tiêu chí |
| Options | `relevance` (default), `date_desc`, `date_asc`, `views`, `downloads` |

### F3.4: Lọc kết quả (Filters)

| Thuộc tính | Chi tiết |
|------------|----------|
| Mô tả | Lọc kết quả theo nhiều tiêu chí kết hợp |
| Filters | Danh mục, Phòng ban, Loại file, Tags, Khoảng thời gian |

---

## PH4: Master Data — Dữ liệu danh mục

### F4.1–F4.3: CRUD Category (Danh mục)

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin (write), User (read) |
| Mô tả | Quản lý danh mục phân loại tài liệu |
| Đặc biệt | - Hỗ trợ cây phân cấp (parent_id)<br>- Có `sort_order` để sắp xếp<br>- Có `icon` (emoji/class)<br>- Trả về `documentCount` |
| API | `GET/POST/PUT/DELETE /categories`, `/categories/{id}` |

### F4.4–F4.6: CRUD Department (Phòng ban)

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin (write), User (read) |
| Mô tả | Quản lý phòng ban |
| Đặc biệt | - Có `code` unique (HR, IT, FIN...)<br>- Có `is_active` flag |
| API | `GET/POST/PUT/DELETE /departments`, `/departments/{id}` |

### F4.7–F4.9: CRUD Tag (Nhãn)

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin (write), User (read) |
| Mô tả | Quản lý nhãn gắn cho tài liệu |
| Đặc biệt | - `slug` tự động sinh từ `name`<br>- Trả về `documentCount` |
| API | `GET/POST/PUT/DELETE /tags`, `/tags/{id}` |

---

## PH5: Dashboard & Analytics

### F5.1: Dashboard tổng quan

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin |
| Mô tả | Hiển thị thống kê tổng quan |
| Metrics | - Tổng documents, users, categories, departments<br>- Documents theo status<br>- Documents theo file type |
| API | `GET /admin/dashboard` 👑 |

### F5.2: Top tài liệu phổ biến

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin |
| Mô tả | Danh sách tài liệu xem nhiều nhất và tải nhiều nhất |

### F5.3: Tài liệu upload gần đây

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin |
| Mô tả | Danh sách tài liệu mới upload gần đây |

---

## Bảng tổng hợp API Endpoints

| # | Method | Endpoint | Auth | Tính năng |
|---|--------|----------|------|-----------|
| | | **Authentication** | | |
| 1 | POST | `/auth/login` | 🔓 | F1.1 — Đăng nhập |
| 2 | POST | `/auth/register` | 👑 | F1.7 — Admin tạo tài khoản |
| 3 | POST | `/auth/refresh` | 🔓 | F1.2 — Refresh token |
| 4 | POST | `/auth/logout` | 🔒 | F1.3 — Đăng xuất |
| | | **User** | | |
| 5 | GET | `/users/me` | 🔒 | F1.4 — Xem profile |
| 6 | PUT | `/users/me` | 🔒 | F1.5 — Sửa profile |
| 7 | GET | `/users` | 👑 | F1.6 — Danh sách users |
| 8 | GET | `/users/{id}` | 👑 | F1.6 — Chi tiết user |
| 9 | POST | `/users` | 👑 | F1.6 — Tạo user |
| 10 | PUT | `/users/{id}` | 👑 | F1.6 — Cập nhật user |
| 11 | DELETE | `/users/{id}` | 👑 | F1.6 — Xóa user |
| | | **Document** | | |
| 12 | POST | `/documents` | 👑 | F2.1 — Upload tài liệu |
| 13 | GET | `/documents` | 🔒 | F2.3 — Danh sách |
| 14 | GET | `/documents/{id}` | 🔒 | F2.4 — Chi tiết |
| 15 | PUT | `/documents/{id}` | 👑 | F2.5 — Cập nhật metadata |
| 16 | DELETE | `/documents/{id}` | 👑 | F2.6 — Xóa (soft) |
| 17 | GET | `/documents/{id}/preview` | 🔒 | F2.7 — Preview |
| 18 | GET | `/documents/{id}/download` | 🔒 | F2.8 — Download |
| 19 | GET | `/documents/{id}/versions` | 🔒 | F2.10 — Lịch sử phiên bản |
| 20 | POST | `/documents/{id}/versions` | 👑 | F2.9 — Upload version mới |
| 21 | GET | `/documents/{id}/versions/{vId}/download` | 🔒 | F2.11 — Tải version cũ |
| | | **Search** | | |
| 22 | GET | `/documents/search` | 🔒 | F3.1 — Tìm kiếm full-text |
| | | **Master Data** | | |
| 23–27 | CRUD | `/categories` | 🔒/👑 | F4.1–F4.3 |
| 28–32 | CRUD | `/departments` | 🔒/👑 | F4.4–F4.6 |
| 33–37 | CRUD | `/tags` | 🔒/👑 | F4.7–F4.9 |
| | | **Dashboard** | | |
| 38 | GET | `/admin/dashboard` | 👑 | F5.1 — Thống kê |

> Ký hiệu: 🔓 Public | 🔒 Authenticated | 👑 Admin only
