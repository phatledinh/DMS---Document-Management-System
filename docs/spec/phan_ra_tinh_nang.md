# Phân Rã Tính Năng — DMS

> Phân rã chi tiết tất cả tính năng (features) của hệ thống DMS, tổ chức theo phân hệ.

---

## Tổng quan tính năng

| Phân hệ | Số tính năng | Ưu tiên |
|----------|:---:|:---:|
| PH1: Identity | 11 | Cao |
| PH2: Document Management | 20 | Cao (Core) |
| PH3: Search Engine | 8 | Cao (Core) |
| PH4: Master Data | 11 | Cao |
| PH5: Dashboard | 8 | Thấp |
| PH6: Audit & Access Log | 8 | Trung bình |
| **Tổng** | **66** | |

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
| Mô tả | Xem thông tin cá nhân (name, email, phone, avatar, departmentIds, role) |
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
| Mô tả | Danh sách, tạo, sửa, xóa mềm hoặc deactivate user |
| Input tạo user | `name`, `email`, `password`, `phone`, `role`, `departmentIds[]` |
| Chức năng con | - Xem danh sách user (pagination, filter theo role, department, status)<br>- Xem chi tiết user<br>- Tạo user mới, không mở public register<br>- Cập nhật user (bao gồm đổi role, danh sách phòng ban, status)<br>- Xóa mềm/deactivate user |
| Business Rules | - Email phải unique<br>- Mỗi department trong `departmentIds[]` phải tồn tại và active<br>- User có thể thuộc nhiều phòng ban<br>- Chỉ Admin được tạo user, đổi role và đổi danh sách phòng ban |
| API | `GET/POST/PUT/DELETE /users`, `/users/{id}` 👑 |

### F1.7: Quản lý phòng ban của user

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin |
| Mô tả | Gán, thay đổi hoặc xóa nhiều phòng ban cho một user |
| Input | `departmentIds[]`, `primaryDepartmentId` optional nếu cần đánh dấu phòng ban chính |
| Output | Danh sách phòng ban hiện tại của user |
| Business Rules | - User có thể thuộc nhiều phòng ban<br>- Quyền tài liệu thay đổi ngay theo category permission ở request tiếp theo<br>- Không cần refresh search index khi user đổi phòng ban<br>- Ghi audit log thay đổi membership |
| API | `PUT /users/{id}/departments` 👑 |

### F1.8: User dashboard cá nhân

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin, User |
| Mô tả | Hiển thị tổng quan thông tin user, phòng ban, quyền hiệu lực tóm tắt và hoạt động gần đây |
| Output | `profile`, `departments`, `recentDocuments`, `recentActivities`, `stats` |
| Business Rules | - User chỉ xem dashboard của chính mình<br>- Admin có thể xem dashboard của user khi đi từ màn quản lý user<br>- Không hiển thị metadata tài liệu nếu user hiện tại không còn `VIEW` |
| API | `GET /users/me/dashboard` 🔒, `GET /users/{id}/dashboard` 👑 |

### F1.9: Tài liệu của tôi

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin, User |
| Mô tả | Xem danh sách tài liệu do user upload hoặc từng thao tác |
| Filters | `type=uploaded|updated|downloaded|previewed`, `categoryId`, `status`, `dateFrom/To`, pagination |
| Business Rules | - User chỉ xem tài liệu liên quan đến chính mình và vẫn phải có `VIEW` trên category hiện tại<br>- Admin có thể xem danh sách tài liệu của một user bất kỳ để hỗ trợ audit/vận hành |
| API | `GET /users/me/documents` 🔒, `GET /users/{id}/documents` 👑 |

### F1.10: Version của tôi

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin, User |
| Mô tả | Xem các version do user upload hoặc version thuộc tài liệu user được phép xem |
| Filters | `documentId`, `categoryId`, `status`, `dateFrom/To`, pagination |
| Business Rules | - User chỉ thấy version nếu có `VIEW` trên category của tài liệu<br>- Download version vẫn yêu cầu `DOWNLOAD` tại endpoint download |
| API | `GET /users/me/versions` 🔒, `GET /users/{id}/versions` 👑 |

### F1.11: Lịch sử thao tác cá nhân

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin, User |
| Mô tả | User xem timeline thao tác của chính mình: search, preview, download, upload, update, delete attempt |
| Filters | `action`, `categoryId`, `requiredPermission`, `accessGranted`, `dateFrom/To`, pagination |
| Business Rules | - User chỉ xem activity của chính mình<br>- Có thể hiển thị denied action của chính user với `denialReason` nhưng không lộ metadata tài liệu ngoài quyền `VIEW` hiện tại<br>- Admin có thể xem activity của user bất kỳ qua màn audit/admin user detail |
| API | `GET /users/me/activity` 🔒, `GET /users/{id}/activity` 👑 |

---

## PH2: Document Management — Quản lý Tài liệu

### F2.1: Upload tài liệu

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin |
| Mô tả | Khởi tạo upload bằng presigned URL, client PUT file trực tiếp lên object storage, complete để validate và tạo version đầu tiên |
| Input | `fileName`, `fileSize`, `contentType`, `title`, `description`, `categoryId`, `tagIds`, `effectiveDate`, `expiryDate`; byte file gửi trực tiếp tới object storage bằng presigned PUT |
| Output | `upload-init` trả document `AWAITING_UPLOAD` + presigned PUT URL; `upload-complete` chuyển document sang `PROCESSING` |
| Business Rules | - Mỗi request chỉ upload 1 file<br>- User/Admin phải có `UPLOAD` trên category đã chọn<br>- `upload-init` validate sơ bộ extension/MIME khai báo/size ≤ 50MB; `upload-complete` validate MIME thực tế bằng Tika<br>- Cho phép pdf, doc, docx, xls, xlsx, jpg, png, tiff<br>- Chặn `.exe`, `.sh`, `.bat`, `.cmd`, `.js`, `.html`<br>- Tên file lưu trữ dùng UUID-based path, không dùng trực tiếp tên file user nhập<br>- `documentCode` do backend tự sinh, request không nhận/sửa field này<br>- `title` tự động tạo `slug`<br>- Tự động tạo version 1.0<br>- Tài liệu không lưu ACL riêng; quyền truy cập ăn theo category hiện tại |
| API | `POST /documents/upload-init` 👑, `POST /documents/{id}/upload-complete` 👑 |

### F2.2: Trích xuất nội dung file (Content Extraction)

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | System (Background) |
| Mô tả | Tự động trích xuất text từ file sau khi upload |
| Processing | - PDF text → PDFBox<br>- DOCX → POI (XWPF)<br>- DOC → POI (HWPF)<br>- XLS/XLSX → POI<br>- Image/PDF scan → Tesseract OCR |
| Output | `extracted_content` lưu trong `document_contents` |
| Business Rules | - Chạy trong RabbitMQ worker, không chạy in-process trong API server<br>- Cập nhật status: `PROCESSING` → `INDEXED` / `EXTRACTION_FAILED`<br>- Tài liệu ảnh/PDF scan publish task `dms.ocr` để tạo `extracted_content` khi có thể<br>- Retry qua RabbitMQ delay queues `30s -> 5m -> 30m`, vượt `maxAttempts = 3` thì vào DLQ và alert |

### F2.3: Danh sách tài liệu

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin, User |
| Mô tả | Xem danh sách tài liệu với pagination và filters |
| Filters | `categoryId`, `departmentId`, `fileType`, `status`, `tagIds`, `effectiveDateFrom/To` |
| Sort | `created_at_desc` (default), `created_at_asc`, `updated_at_desc`, `title_asc`, `view_count_desc`, `download_count_desc` |
| Pagination | `page` (default: 0), `size` (default: 20, max: 100) |
| Business Rules | - User thường chỉ thấy tài liệu `INDEXED` mà user có `VIEW` trên category<br>- Admin có thể xem theo quyền quản trị và filter lifecycle/status phù hợp<br>- Facets/count nếu có phải tính trên tập kết quả đã áp category permission |
| API | `GET /documents` 🔒 |

### F2.4: Chi tiết tài liệu

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin, User |
| Mô tả | Xem chi tiết metadata tài liệu |
| Business Rules | - Kiểm tra `VIEW` trên category trước khi trả metadata; không trả object key thô<br>- User không có `VIEW` không được thấy title, snippet, metadata hoặc preview URL<br>- Download URL yêu cầu `DOWNLOAD` riêng, không suy ra từ `VIEW`<br>- Tài liệu `DELETED` không được trả cho User<br>- Chỉ tăng `view_count` khi người dùng preview, không tăng khi chỉ xem metadata |
| API | `GET /documents/{id}` 🔒 |

### F2.5: Cập nhật metadata tài liệu

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin hoặc user có quyền |
| Mô tả | Cập nhật tiêu đề, mô tả, danh mục, tags và ngày hiệu lực |
| Input | `title`, `description`, `categoryId`, `tagIds`, `effectiveDate`, `expiryDate` |
| Business Rules | - Yêu cầu `UPDATE` trên category hiện tại<br>- Nếu đổi category, yêu cầu `UPDATE` trên category nguồn và `UPLOAD` hoặc `UPDATE` trên category đích<br>- Không cập nhật file, dùng F2.9 để upload version mới<br>- Không cho sửa `documentCode` qua metadata endpoint<br>- Cập nhật metadata/category/tags phải refresh PostgreSQL search row nếu field search/filter thay đổi<br>- Ghi audit log các field thay đổi |
| API | `PUT /documents/{id}` 👑 |

### F2.6: Xóa tài liệu

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin |
| Mô tả | Xóa mềm tài liệu, đưa vào Thùng rác và đặt lịch purge sau 30 ngày |
| Business Rules | - Yêu cầu `DELETE` trên category hiện tại<br>- Soft delete, có thể restore trước `purge_after`<br>- Set `status = DELETED`, `deleted_at = now()`, `deleted_by = current_user`, `purge_after = now() + 30 ngày`, lưu `previous_status`<br>- Tài liệu `DELETED` không xuất hiện trong search, preview, download hoặc danh sách User<br>- Xóa khỏi search index hoặc cập nhật index để loại khỏi kết quả<br>- Không xóa file vật lý ngay lập tức<br>- Ghi audit log |
| API | `DELETE /documents/{id}` 👑 |

### F2.7: Preview tài liệu

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin, User |
| Mô tả | Xem tài liệu trực tiếp trên trình duyệt |
| Processing | - PDF/image → presigned GET URL inline tới object gốc<br>- DOCX/DOC → worker convert preview artifact PDF/HTML rồi presigned GET URL inline<br>- XLS/XLSX → worker convert HTML/PDF preview artifact rồi presigned GET URL inline |
| Business Rules | - Yêu cầu `VIEW` trên category<br>- User chỉ preview tài liệu `INDEXED` và không `DELETED`<br>- HTML preview phải sanitize để tránh XSS<br>- Tăng `view_count` và ghi access log preview tại thời điểm cấp presigned URL |
| API | `GET /documents/{id}/preview-url` 🔒 |

### F2.8: Download tài liệu

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin, User |
| Mô tả | Tải file gốc về máy |
| Business Rules | - Yêu cầu `DOWNLOAD` trên category<br>- User chỉ download tài liệu `INDEXED` và không `DELETED`<br>- Tự động tăng `download_count` tại thời điểm cấp presigned URL<br>- Presigned URL set `Content-Disposition: attachment`<br>- Ghi access log download tại thời điểm cấp URL |
| API | `GET /documents/{id}/download-url` 🔒 |

### F2.9: Upload phiên bản mới

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin |
| Mô tả | Khởi tạo presigned upload cho file phiên bản mới và complete sau khi client PUT xong |
| Input | `fileName`, `fileSize`, `contentType`, `versionNumber`, `changelog` |
| Business Rules | - Yêu cầu `UPLOAD` trên category hiện tại<br>- File/version cũ giữ lại trong lịch sử, không ghi đè<br>- Version mới trở thành current version sau khi xử lý thành công<br>- Cập nhật `version_number` trong documents<br>- Trích xuất nội dung mới và refresh PostgreSQL search vector<br>- Ghi audit log |
| API | `POST /documents/{id}/versions/init` 👑, `POST /documents/{id}/versions/{versionId}/complete` 👑 |

### F2.10: Xem lịch sử phiên bản

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin, User |
| Mô tả | Danh sách các phiên bản của tài liệu |
| Business Rules | - Yêu cầu `VIEW` trên category trước khi trả version history<br>- Trả thông tin version, uploader, thời gian upload, changelog, current flag |
| API | `GET /documents/{id}/versions` 🔒 |

### F2.11: Tải phiên bản cũ

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin, User |
| Mô tả | Tải file của một phiên bản cụ thể |
| Business Rules | - Yêu cầu `DOWNLOAD` trên category trước khi tải<br>- Ghi access log download version nếu cần thống kê chi tiết |
| API | `GET /documents/{id}/versions/{versionId}/download-url` 🔒 |

### F2.12: Khôi phục phiên bản cũ làm current version

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin |
| Mô tả | Chọn một phiên bản cũ làm phiên bản hiện hành |
| Business Rules | - Yêu cầu `UPDATE` trên category hiện tại<br>- Không xóa version hiện tại<br>- Cập nhật current version<br>- Trích xuất lại nội dung và refresh PostgreSQL search vector theo version được restore<br>- Ghi audit log |
| API | `POST /documents/{id}/versions/{versionId}/restore` 👑 |

### F2.13: Archive tài liệu

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin |
| Mô tả | Đưa tài liệu sang trạng thái `ARCHIVED` khi ngưng sử dụng |
| Business Rules | - Yêu cầu `DELETE` trên category hiện tại<br>- Tài liệu `ARCHIVED` không hiển thị mặc định với User<br>- Admin có thể filter và xem tài liệu archived<br>- Cập nhật search index để loại khỏi search mặc định<br>- Ghi audit log |
| API | `POST /documents/{id}/archive` 👑 |

### F2.14: Restore tài liệu

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin |
| Mô tả | Khôi phục tài liệu đã archive/delete |
| Business Rules | - Yêu cầu `DELETE` trên category hiện tại<br>- Restore từ `ARCHIVED` hoặc `DELETED` về `PROCESSING` hoặc `INDEXED` tùy trạng thái file/index<br>- Nếu cần, chạy lại extraction/search refresh trước khi tài liệu xuất hiện với User<br>- Ghi audit log |
| API | `POST /documents/{id}/restore` 👑 |

### F2.15: Retry extraction/search refresh thủ công

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin |
| Mô tả | Cho phép Admin retry xử lý tài liệu đang `EXTRACTION_FAILED` |
| Business Rules | - Chỉ áp dụng cho lỗi extraction/search refresh có thể retry<br>- Cập nhật status sang `PROCESSING` trong lúc chạy lại<br>- Thành công chuyển `INDEXED`, thất bại giữ `EXTRACTION_FAILED`<br>- Ghi audit log |
| API | `POST /documents/{id}/retry-indexing` 👑 |


### F2.16: Upload nhiều tài liệu cùng lúc

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin |
| Mô tả | Upload nhiều file trong một thao tác với metadata mặc định dùng chung |
| Input | `files[]` (required, mỗi file max 50MB), `categoryId`, `tagIds`, `effectiveDate`, `expiryDate`, `titlePattern` |
| Output | Kết quả tổng hợp gồm `total`, `succeeded`, `failed` và danh sách kết quả theo từng file |
| Business Rules | - Yêu cầu `UPLOAD` trên category dùng chung<br>- Init validate size/type khai báo từng file, complete validate object thực tế bằng Tika từng item<br>- Mỗi file hợp lệ tạo một document record, một `documentCode` tự sinh và version 1.0 riêng<br>- Cho phép partial success: file lỗi không làm rollback các file hợp lệ<br>- Extraction/indexing chạy độc lập theo từng document<br>- Ghi audit log cho từng document upload thành công |
| API | `POST /documents/batch-upload-init`, `POST /documents/batch-upload-complete` 👑 |

### F2.17: Xóa nhiều tài liệu cùng lúc

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin |
| Mô tả | Chọn nhiều tài liệu và đưa vào Thùng rác trong một thao tác |
| Input | `documentIds[]`, `reason` |
| Output | Kết quả partial success theo từng document |
| Business Rules | - Yêu cầu `DELETE` trên category của từng tài liệu<br>- Dùng cùng semantics với F2.6 cho từng tài liệu<br>- Tài liệu đã xóa, không tồn tại hoặc thiếu quyền trả lỗi theo item, không chặn toàn bộ batch<br>- Cập nhật search index để loại khỏi kết quả mặc định<br>- Ghi audit log cho từng document |
| API | `POST /documents/batch-delete` 👑 |

### F2.18: Chuyển tài liệu giữa danh mục/folder

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin |
| Mô tả | Chuyển một hoặc nhiều tài liệu từ category/folder hiện tại sang category/folder khác |
| Input | `documentIds[]` hoặc `{id}`, `targetCategoryId` |
| Output | Category cũ/mới với kết quả theo từng document nếu batch |
| Business Rules | - Category hiện có được dùng như folder, không tạo entity folder riêng<br>- Validate target category tồn tại, active và chưa soft delete<br>- Yêu cầu `UPDATE` trên category nguồn và `UPLOAD` hoặc `UPDATE` trên target category<br>- Cập nhật `documents.category_id` và refresh PostgreSQL search row metadata category<br>- Ghi audit log với category cũ và mới |
| API | `POST /documents/{id}/move`, `POST /documents/batch-move` 👑 |

### F2.19: Thùng rác tài liệu

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin |
| Mô tả | Xem, lọc, khôi phục hoặc xóa vĩnh viễn tài liệu đã soft delete |
| Filters | `categoryId`, `deletedBy`, `deletedFrom`, `deletedTo`, `fileType`, pagination |
| Output | Danh sách tài liệu `DELETED` kèm `deletedAt`, `purgeAfter`, `daysUntilPurge`, `fileSizeMb` |
| Business Rules | - Trash list lấy từ PostgreSQL, không lấy từ search index<br>- Admin có thể restore một/nhiều tài liệu trước hạn purge<br>- Permanent delete xóa object storage, extracted content và search index; audit logs vẫn được giữ<br>- Tài liệu quá hạn `purge_after` có thể không restore được nếu purge job đã xử lý |
| API | `GET /documents/trash`, `POST /documents/trash/restore`, `DELETE /documents/trash/permanent-delete` 👑 |

### F2.20: Tự động xóa vĩnh viễn sau 30 ngày

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | System (Scheduler) |
| Mô tả | Tự động purge tài liệu trong Thùng rác khi `purge_after <= now()` |
| Business Rules | - Job chạy hằng ngày, idempotent và ghi log kết quả<br>- Chỉ xử lý document `status = DELETED` đã quá hạn purge<br>- Xóa file hiện tại và version files trong object storage theo retention policy<br>- Xóa extracted content và PostgreSQL search row<br>- Nếu xóa object storage thất bại, ghi lỗi và retry ở lần chạy sau |
| API | Internal scheduled job `purgeDeletedDocuments` |

---

## PH3: Search Engine — Tìm kiếm

### F3.1: Tìm kiếm full-text

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin, User |
| Mô tả | Tìm kiếm tài liệu theo từ khóa trong tiêu đề, mô tả, mã tài liệu, tags và nội dung file |
| Input | `q` (required), `categoryId`, `departmentId`, `fileType`, `tagIds`, `dateFrom/To`, `status`, `sort`, `page`, `size` |
| Output | Danh sách kết quả, highlight, relevance score, facets, search time |
| Business Rules | - Multi-match trên `title`, `description`, `extracted_content`, `tags`<br>- Exact/boosted match cho `documentCode`<br>- Mặc định chỉ trả tài liệu `INDEXED`<br>- User chỉ nhận kết quả có `VIEW` trên category<br>- Ghi search log qua PH6 |
| API | `GET /documents/search` 🔒 |

### F3.2: Permission-aware Search

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | System |
| Mô tả | Lọc category permission `VIEW` ngay trong PostgreSQL FTS query |
| Business Rules | - Search query phải filter theo `VIEW` trước khi trả kết quả<br>- Predicate dùng user identity, `user_departments` và `category_department_permissions`<br>- User không có `VIEW` không được thấy title, snippet, metadata hoặc preview URL<br>- Download vẫn kiểm tra `DOWNLOAD` ở download endpoint |

### F3.3: Highlight kết quả

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | System |
| Mô tả | Đánh dấu `<em>` tại vị trí match trong tiêu đề, mô tả và nội dung |
| Business Rules | - Sử dụng PostgreSQL ts_headline highlight cho `title`, `description`, `extracted_content`<br>- Backend sanitize highlight trước khi trả về frontend |

### F3.4: Sắp xếp kết quả

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin, User |
| Mô tả | Sắp xếp kết quả tìm kiếm theo nhiều tiêu chí |
| Options | `relevance` (default), `createdAt`, `updatedAt`, `viewCount`, `downloadCount`, `title` |

### F3.5: Lọc kết quả (Filters)

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin, User |
| Mô tả | Lọc kết quả theo nhiều tiêu chí kết hợp |
| Filters | Category, department, tag, file type, uploader, date range, document status |

### F3.6: Faceted Search / Aggregations

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin, User |
| Mô tả | Trả số lượng kết quả theo từng nhóm filter để hỗ trợ UI search |
| Facets | Category, department, file type, tag |
| Business Rules | - Facets phải tôn trọng permission filter và status filter hiện hành |

### F3.7: Suggestions / Autocomplete

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin, User |
| Mô tả | Gợi ý tìm kiếm theo title, document code và tags |
| Input | `q` hoặc `prefix` |
| Output | Danh sách suggestion có quyền xem |
| Business Rules | - Không gợi ý tài liệu hoặc tag dẫn tới tài liệu user không có quyền xem<br>- Có thể cache bằng Redis nếu cần hiệu năng |
| API | `GET /documents/search/suggestions` 🔒 |

### F3.8: Relevance, Fuzzy Search và Vietnamese Analyzer

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | System |
| Mô tả | Cải thiện chất lượng tìm kiếm tiếng Việt và lỗi chính tả |
| Business Rules | - Ưu tiên relevance: exact `document_code` → title → tags → description → extracted_content<br>- Hỗ trợ fuzzy search cho lỗi chính tả<br>- Hỗ trợ synonym và Vietnamese analyzer nếu cấu hình PostgreSQL FTS cho phép<br>- Boost nhẹ tài liệu mới hơn hoặc có lượt xem/tải cao hơn |

---

## PH4: Master Data — Dữ liệu danh mục

### F4.1–F4.3: CRUD Category (Danh mục)

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin (write), User (read) |
| Mô tả | Quản lý danh mục phân loại tài liệu |
| Đặc biệt | - Hỗ trợ cây phân cấp (parent_id)<br>- Có `sort_order` để sắp xếp<br>- Có `icon` hoặc class hiển thị<br>- Trả về `documentCount` theo quyền người xem nếu dùng cho User |
| Business Rules | - Soft delete category<br>- Refresh search row cho tài liệu bị ảnh hưởng khi metadata search/filter thay đổi |
| API | `GET/POST/PUT/DELETE /categories`, `/categories/{id}` |

### F4.4–F4.6: CRUD Department (Phòng ban)

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin (write), User (read) |
| Mô tả | Quản lý phòng ban |
| Đặc biệt | - Có `code` unique (HR, IT, FIN...)<br>- Có `is_active` flag |
| Business Rules | - Phòng ban dùng để gán membership cho user và cấp quyền theo category<br>- Khi user đổi phòng ban hoặc quyền phòng ban thay đổi, không cần refresh search row vì query dùng quyền hiện tại |
| API | `GET/POST/PUT/DELETE /departments`, `/departments/{id}` |

### F4.7–F4.9: CRUD Tag (Nhãn)

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin (write), User (read) |
| Mô tả | Quản lý nhãn gắn cho tài liệu |
| Đặc biệt | - `slug` tự động sinh từ `name`<br>- Trả về `documentCount` theo quyền người xem nếu dùng cho User |
| Business Rules | - Soft delete tag<br>- Refresh search row cho tài liệu bị ảnh hưởng khi tag metadata thay đổi |
| API | `GET/POST/PUT/DELETE /tags`, `/tags/{id}` |

### F4.10: Quản lý ma trận quyền phòng ban theo danh mục

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin |
| Mô tả | Cấu hình phòng ban nào có quyền gì trong từng category |
| Input | `categoryId`, `departmentPermissions[]` gồm `departmentId` và `permissions[]` |
| Permission set | `VIEW`, `DOWNLOAD`, `UPLOAD`, `UPDATE`, `DELETE` |
| Business Rules | - Mỗi category có thể cấp quyền cho nhiều phòng ban<br>- Một phòng ban có thể có nhiều quyền trong cùng category<br>- User thuộc nhiều phòng ban được gộp quyền theo union<br>- Thay đổi permission có hiệu lực ở request tiếp theo<br>- Không cần refresh search index khi đổi permission<br>- Ghi audit log thay đổi permission |
| API | `GET/PUT /categories/{id}/permissions` 👑 |

### F4.11: Extension quyền riêng user trong danh mục

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin |
| Mô tả | Extension point để cấp hoặc chặn quyền riêng cho một user trong phạm vi category/phòng ban nếu sau này cần |
| Input | `categoryId`, `departmentId` optional, `userId`, `permission`, `effect=ALLOW/DENY` |
| Business Rules | - Không thay thế ma trận quyền phòng ban chính<br>- Pipeline tính quyền: union quyền phòng ban trước, sau đó áp user-specific override nếu feature được bật<br>- MVP có thể chỉ triển khai schema/service hook, chưa cần UI đầy đủ |
| API | `GET/PUT /categories/{id}/user-overrides` 👑 |

---

## PH5: Dashboard & Analytics

### F5.1: Dashboard tổng quan

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin |
| Mô tả | Hiển thị thống kê tổng quan cho Admin |
| Metrics | - Tổng documents, users, categories, departments<br>- Tổng dung lượng file toàn hệ thống theo MB<br>- Documents theo status/file type<br>- Tổng lượt preview/download/search/login và unique users |
| API | `GET /admin/dashboard/summary` 👑 |

### F5.2: Top tài liệu phổ biến

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin |
| Mô tả | Danh sách tài liệu xem nhiều nhất và tải nhiều nhất |
| Metrics | `viewCount`, `downloadCount`, thời gian gần nhất được truy cập |
| API | `GET /admin/dashboard/top-documents` 👑 |

### F5.3: Tài liệu upload gần đây

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin |
| Mô tả | Danh sách tài liệu mới upload gần đây |
| Filters | Khoảng thời gian, uploader, status, file type |
| API | `GET /admin/dashboard/recent-uploads` 👑 |

### F5.4: Top từ khóa tìm kiếm

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin |
| Mô tả | Thống kê từ khóa tìm kiếm phổ biến và số lượng kết quả trung bình |
| Metrics | Keyword, số lần tìm kiếm, resultCount trung bình, searchTime trung bình |
| API | `GET /admin/dashboard/top-search-keywords` 👑 |

### F5.5: Thống kê preview/download theo thời gian

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin |
| Mô tả | Biểu đồ lượt preview/download theo ngày/tuần/tháng |
| Metrics | Preview count, download count, unique users |
| API | `GET /admin/dashboard/access-stats` 👑 |

### F5.6: Thống kê lỗi processing/search refresh

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin |
| Mô tả | Theo dõi tài liệu `PROCESSING` lâu hoặc `EXTRACTION_FAILED` |
| Metrics | Số tài liệu lỗi, loại file lỗi, retry count, lỗi gần nhất |
| API | `GET /admin/dashboard/processing-errors` 👑 |


### F5.7: Thống kê dung lượng lưu trữ

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin |
| Mô tả | Hiển thị tổng dung lượng file/tài liệu trên toàn hệ thống theo MB |
| Output | `activeStorageMb`, `trashStorageMb`, `versionStorageMb`, `totalStorageMb`, `documentCount`, `trashDocumentCount` |
| Business Rules | - Active storage tính từ `documents.file_size` với `status != DELETED`<br>- Trash storage tính từ `documents.file_size` với `status = DELETED`<br>- Version storage tính từ `document_versions.file_size` nếu version lưu file riêng<br>- MB = bytes / 1024 / 1024, làm tròn 2 chữ số |
| API | `GET /admin/dashboard/storage` 👑 |


### F5.8: Dữ liệu truy cập hệ thống

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin |
| Mô tả | Hiển thị dữ liệu truy cập hệ thống để Admin theo dõi mức độ sử dụng DMS |
| Metrics | `totalLogins`, `activeUsers`, `uniqueAccessUsers`, `previewCount`, `downloadCount`, `viewCount`, `searchCount`, `deniedAccessCount`, `accessByAction`, `deniedByPermission`, `accessTrend`, `topUsersByAccess` |
| Filters | `dateFrom`, `dateTo`, `granularity=day|week|month`, `departmentId`, `categoryId`, `userId`, `action`, `permission` |
| Business Rules | - Login/logout lấy từ `audit_logs`<br>- Preview/download/view/denied access lấy từ `access_logs`<br>- Search count lấy từ `search_logs`<br>- Chỉ Admin được xem dữ liệu tổng hợp; không expose chi tiết nhạy cảm không cần thiết như token/cookie/IP nếu không phục vụ audit |
| API | `GET /admin/dashboard/system-access` 👑 |

---

## PH6: Audit & Access Log

### F6.1: Ghi audit log quản trị tài liệu

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | System |
| Mô tả | Ghi nhận các hành động upload, update metadata, archive, delete, restore, upload/restore version |
| Data | `userId`, `documentId`, `categoryId`, `action`, `changedFields`, `timestamp` |

### F6.2: Ghi access log truy cập tài liệu

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | System |
| Mô tả | Ghi nhận hành động detail, preview, download, upload/update/delete attempt và kết quả cấp quyền |
| Data | `userId`, `documentId`, `categoryId`, `action`, `requiredPermission`, `accessGranted`, `denialReason`, `timestamp` |

### F6.3: Ghi search log

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | System |
| Mô tả | Ghi nhận lịch sử tìm kiếm phục vụ dashboard và phân tích hành vi |
| Data | `userId`, `keyword`, `filters`, `resultCount`, `searchTime`, `timestamp` |

### F6.4: Admin xem audit/access log

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin |
| Mô tả | Xem log hệ thống với pagination và filters |
| Filters | Actor, action, documentId, categoryId, requiredPermission, denialReason, keyword, date range |
| API | `GET /admin/audit-logs` 👑 |

### F6.5: Cung cấp dữ liệu log cho dashboard

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | System |
| Mô tả | Tổng hợp audit/access/search log thành metrics cho PH5 |
| Business Rules | - Dashboard chỉ đọc dữ liệu tổng hợp hoặc query tối ưu, không scan log lớn trực tiếp nếu dữ liệu tăng |

### F6.6: Ghi audit log thay đổi phân quyền

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | System |
| Mô tả | Ghi nhận thay đổi user-department memberships, category permissions và user-specific overrides |
| Data | `actorId`, `targetType`, `targetId`, `oldValue`, `newValue`, `timestamp` |
| Business Rules | - Mọi thay đổi quyền phải có audit log để truy vết ai cấp/thu hồi quyền<br>- Không ghi token, password hoặc dữ liệu nhạy cảm không phục vụ audit |

### F6.7: Admin audit action timeline

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin |
| Mô tả | Tra cứu timeline audit action chi tiết theo actor, target, category, permission và thời gian |
| Filters | `actorId`, `targetType`, `targetId`, `categoryId`, `action`, `requiredPermission`, `accessGranted`, `dateFrom/To` |
| Business Rules | - Chỉ Admin được xem toàn bộ audit action<br>- Hỗ trợ drill-down từ user, document, category hoặc permission change |
| API | `GET /admin/audit-actions` 👑 |

### F6.8: User activity timeline

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin, User |
| Mô tả | Cung cấp timeline hoạt động cá nhân cho màn User self-service |
| Filters | `action`, `categoryId`, `dateFrom/To`, pagination |
| Business Rules | - User chỉ thấy activity của chính mình<br>- Admin có thể xem activity theo user để hỗ trợ audit<br>- Không lộ thông tin tài liệu ngoài quyền `VIEW` hiện tại của viewer |
| API | `GET /users/me/activity` 🔒, `GET /users/{id}/activity` 👑 |

---

## Bảng tổng hợp API Endpoints

| # | Method | Endpoint | Auth | Tính năng |
|---|--------|----------|------|-----------|
| | | **Authentication** | | |
| 1 | POST | `/auth/login` | 🔓 | F1.1 — Đăng nhập |
| 2 | POST | `/auth/refresh` | 🔓 | F1.2 — Refresh token |
| 3 | POST | `/auth/logout` | 🔒 | F1.3 — Đăng xuất |
| | | **User** | | |
| 4 | GET | `/users/me` | 🔒 | F1.4 — Xem profile |
| 5 | PUT | `/users/me` | 🔒 | F1.5 — Sửa profile |
| 6 | GET | `/users` | 👑 | F1.6 — Danh sách users |
| 7 | GET | `/users/{id}` | 👑 | F1.6 — Chi tiết user |
| 8 | POST | `/users` | 👑 | F1.6 — Tạo user |
| 9 | PUT | `/users/{id}` | 👑 | F1.6 — Cập nhật user |
| 10 | DELETE | `/users/{id}` | 👑 | F1.6 — Xóa mềm/deactivate user |
| 11 | PUT | `/users/{id}/departments` | 👑 | F1.7 — Quản lý phòng ban của user |
| 12 | GET | `/users/me/dashboard` | 🔒 | F1.8 — User dashboard cá nhân |
| 13 | GET | `/users/me/documents` | 🔒 | F1.9 — Tài liệu của tôi |
| 14 | GET | `/users/me/versions` | 🔒 | F1.10 — Version của tôi |
| 15 | GET | `/users/me/activity` | 🔒 | F1.11/F6.8 — Lịch sử thao tác cá nhân |
| | | **Document** | | |
| 16 | POST | `/documents/upload-init` | 👑 | F2.1 — Khởi tạo upload tài liệu |
| 17 | POST | `/documents/{id}/upload-complete` | 👑 | F2.1 — Xác nhận upload tài liệu |
| 18 | GET | `/documents` | 🔒 | F2.3 — Danh sách |
| 19 | GET | `/documents/{id}` | 🔒 | F2.4 — Chi tiết |
| 20 | PUT | `/documents/{id}` | 👑 | F2.5 — Cập nhật metadata |
| 21 | DELETE | `/documents/{id}` | 👑 | F2.6 — Xóa mềm |
| 22 | GET | `/documents/{id}/preview-url` | 🔒 | F2.7 — Lấy URL preview |
| 23 | GET | `/documents/{id}/download-url` | 🔒 | F2.8 — Lấy URL download |
| 24 | GET | `/documents/{id}/versions` | 🔒 | F2.10 — Lịch sử phiên bản |
| 25 | POST | `/documents/{id}/versions/init` | 👑 | F2.9 — Khởi tạo upload version mới |
| 26 | GET | `/documents/{id}/versions/{versionId}/download-url` | 🔒 | F2.11 — Lấy URL tải version cũ |
| 27 | POST | `/documents/{id}/versions/{versionId}/complete` | 👑 | F2.9 — Xác nhận upload version mới |
| 28 | POST | `/documents/{id}/versions/{versionId}/restore` | 👑 | F2.12 — Restore version cũ |
| 29 | POST | `/documents/{id}/archive` | 👑 | F2.13 — Archive tài liệu |
| 30 | POST | `/documents/{id}/restore` | 👑 | F2.14 — Restore tài liệu |
| 31 | POST | `/documents/{id}/retry-indexing` | 👑 | F2.15 — Retry extraction/search refresh |
| | | **Search** | | |
| 32 | GET | `/documents/search` | 🔒 | F3.1 — Tìm kiếm full-text |
| 33 | GET | `/documents/search/suggestions` | 🔒 | F3.7 — Suggestions/autocomplete |
| | | **Master Data** | | |
| 34–38 | CRUD | `/categories` | 🔒/👑 | F4.1–F4.3 |
| 39–43 | CRUD | `/departments` | 🔒/👑 | F4.4–F4.6 |
| 44–48 | CRUD | `/tags` | 🔒/👑 | F4.7–F4.9 |
| 49 | GET/PUT | `/categories/{id}/permissions` | 👑 | F4.10 — Ma trận quyền danh mục |
| 50 | GET/PUT | `/categories/{id}/user-overrides` | 👑 | F4.11 — Extension quyền riêng user |
| | | **Dashboard** | | |
| 51 | GET | `/admin/dashboard` | 👑 | F5.1 — Dashboard tổng quan |
| 52 | GET | `/admin/dashboard/top-documents` | 👑 | F5.2 — Top tài liệu phổ biến |
| 53 | GET | `/admin/dashboard/recent-uploads` | 👑 | F5.3 — Tài liệu upload gần đây |
| 54 | GET | `/admin/dashboard/top-search-keywords` | 👑 | F5.4 — Top từ khóa tìm kiếm |
| 55 | GET | `/admin/dashboard/access-stats` | 👑 | F5.5 — Thống kê preview/download |
| 56 | GET | `/admin/dashboard/processing-errors` | 👑 | F5.6 — Lỗi processing/search refresh |
| | | **Audit & Access Log** | | |
| 57 | GET | `/admin/audit-logs` | 👑 | F6.4 — Xem audit/access log |
| 58 | GET | `/admin/audit-actions` | 👑 | F6.7 — Audit action timeline |

> Ký hiệu: 🔓 Public | 🔒 Authenticated | 👑 Admin only
