# Phân Rã Tính Năng — DMS

> Phân rã chi tiết tất cả tính năng (features) của hệ thống DMS, tổ chức theo phân hệ.

---

## Tổng quan tính năng

| Phân hệ | Số tính năng | Ưu tiên |
|----------|:---:|:---:|
| PH1: Identity | 6 | Cao |
| PH2: Document Management | 20 | Cao (Core) |
| PH3: Search Engine | 8 | Cao (Core) |
| PH4: Master Data | 9 | Trung bình |
| PH5: Dashboard | 8 | Thấp |
| PH6: Audit & Access Log | 5 | Trung bình |
| **Tổng** | **56** | |

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
| Mô tả | Danh sách, tạo, sửa, xóa mềm hoặc deactivate user |
| Input tạo user | `name`, `email`, `password`, `phone`, `role`, `departmentId` |
| Chức năng con | - Xem danh sách user (pagination, filter theo role, department, status)<br>- Xem chi tiết user<br>- Tạo user mới, không mở public register<br>- Cập nhật user (bao gồm đổi role, department, status)<br>- Xóa mềm/deactivate user |
| Business Rules | - Email phải unique<br>- Phải chọn department tồn tại<br>- Chỉ Admin được tạo user và đổi role |
| API | `GET/POST/PUT/DELETE /users`, `/users/{id}` 👑 |

---

## PH2: Document Management — Quản lý Tài liệu

### F2.1: Upload tài liệu

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin, User có `UPLOAD` trên category qua phòng ban |
| Mô tả | Khởi tạo upload bằng presigned URL, client PUT file trực tiếp lên object storage, complete để validate và tạo version đầu tiên |
| Input | `fileName`, `fileSize`, `contentType`, `title`, `description`, `categoryId`, `tagIds`, `ownerId`, `effectiveDate`, `expiryDate`; byte file gửi trực tiếp tới object storage bằng presigned PUT |
| Output | `upload-init` trả document `AWAITING_UPLOAD` + presigned PUT URL; `upload-complete` chuyển document sang `PROCESSING` |
| Business Rules | - Mỗi request chỉ upload 1 file<br>- `upload-init` validate sơ bộ extension/MIME khai báo/size ≤ 50MB và kiểm tra user có `UPLOAD` trên category qua một trong các phòng ban của user; Admin luôn được phép<br>- `upload-complete` validate MIME thực tế bằng Tika<br>- Cho phép pdf, doc, docx, xls, xlsx, jpg, png, tiff<br>- Chặn `.exe`, `.sh`, `.bat`, `.cmd`, `.js`, `.html`<br>- Tên file lưu trữ dùng UUID-based path, không dùng trực tiếp tên file user nhập<br>- `documentCode` do backend tự sinh, request không nhận/sửa field này<br>- `title` tự động tạo `slug`<br>- Tự động tạo version 1.0<br>- Tài liệu kế thừa quyền từ danh mục; upload không nhận visibility/audience riêng theo tài liệu |
| API | `POST /documents/upload-init` 🔒, `POST /documents/{id}/upload-complete` 🔒 |

### F2.2: Trích xuất nội dung file (Content Extraction)

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | System (Background) |
| Mô tả | Tự động trích xuất text từ file sau khi upload |
| Processing | - PDF text → PDFBox<br>- DOCX → POI (XWPF)<br>- DOC → POI (HWPF)<br>- XLS/XLSX → POI<br>- Image/PDF scan → VietOCR |
| Output | `extracted_content` lưu trong `document_contents` |
| Business Rules | - Chạy trong RabbitMQ worker, không chạy in-process trong API server<br>- Cập nhật status: `PROCESSING` → `INDEXED` / `EXTRACTION_FAILED`<br>- Tài liệu ảnh/PDF scan gọi OCR service trong extract worker hiện tại; `dms.ocr` là queue planned khi cần scale OCR riêng<br>- Retry qua RabbitMQ delay queues `30s -> 5m -> 30m`, vượt `maxAttempts = 3` thì vào DLQ và alert |

### F2.3: Danh sách tài liệu

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin, User |
| Mô tả | Xem danh sách tài liệu với pagination và filters |
| Filters | `categoryId`, `departmentId`, `fileType`, `status`, `tagIds`, `ownerId`, `effectiveDateFrom/To` |
| Sort | `created_at_desc` (default), `created_at_asc`, `updated_at_desc`, `title_asc`, `view_count_desc`, `download_count_desc` |
| Pagination | `page` (default: 0), `size` (default: 20, max: 100) |
| Business Rules | - Danh sách đi qua resource access policy theo category-department; User thường chỉ thấy tài liệu `INDEXED` thuộc category mà một trong các phòng ban của user có `VIEW`<br>- Admin có thể lọc theo lifecycle/status phù hợp |
| API | `GET /documents` 🔒 |

### F2.4: Chi tiết tài liệu

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin, User |
| Mô tả | Xem chi tiết metadata tài liệu |
| Business Rules | - Kiểm tra quyền trước khi trả metadata và endpoint lấy `preview-url`/`download-url`; không trả object key thô<br>- User không có quyền không được thấy title, snippet, metadata hoặc URL tải file<br>- Tài liệu `DELETED` không được trả cho User<br>- Chỉ tăng `view_count` khi người dùng preview, không tăng khi chỉ xem metadata |
| API | `GET /documents/{id}` 🔒 |

### F2.5: Cập nhật metadata tài liệu

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin |
| Mô tả | Cập nhật tiêu đề, mô tả, danh mục, tags và ngày hiệu lực |
| Input | `title`, `description`, `categoryId`, `tagIds`, `ownerId`, `effectiveDate`, `expiryDate` |
| Business Rules | - Không cập nhật file, dùng F2.9 để upload version mới<br>- Không cho sửa `documentCode` qua metadata endpoint<br>- Cập nhật metadata phải refresh PostgreSQL search row nếu field search thay đổi<br>- Quyền truy cập được quản lý ở danh mục, không qua metadata tài liệu<br>- Ghi audit log các field thay đổi |
| API | `PUT /documents/{id}` 👑 |

### F2.6: Xóa tài liệu

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin |
| Mô tả | Xóa mềm tài liệu, đưa vào Thùng rác và đặt lịch purge sau 30 ngày |
| Business Rules | - Soft delete, có thể restore trước `purge_after`<br>- Set `status = DELETED`, `deleted_at = now()`, `deleted_by = current_user`, `purge_after = now() + 30 ngày`, lưu `previous_status`<br>- Tài liệu `DELETED` không xuất hiện trong search, preview, download hoặc danh sách User<br>- Xóa khỏi search index hoặc cập nhật index để loại khỏi kết quả<br>- Không xóa file vật lý ngay lập tức<br>- Ghi audit log |
| API | `DELETE /documents/{id}` 👑 |

### F2.7: Preview tài liệu

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin, User |
| Mô tả | Xem tài liệu trực tiếp trên trình duyệt |
| Processing | - PDF/image → presigned GET URL inline tới object gốc<br>- DOCX/DOC → worker convert preview artifact PDF/HTML rồi presigned GET URL inline<br>- XLS/XLSX → worker convert HTML/PDF preview artifact rồi presigned GET URL inline |
| Business Rules | - Kiểm tra quyền bằng cùng logic với search/detail/download<br>- User chỉ preview tài liệu `INDEXED` và không `DELETED`<br>- HTML preview phải sanitize để tránh XSS<br>- Tăng `view_count` và ghi access log preview tại thời điểm cấp presigned URL |
| API | `GET /documents/{id}/preview-url` 🔒 |

### F2.8: Download tài liệu

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin, User |
| Mô tả | Tải file gốc về máy |
| Business Rules | - Kiểm tra quyền bằng cùng logic với search/detail/preview<br>- User chỉ download tài liệu `INDEXED` và không `DELETED`<br>- Tự động tăng `download_count` tại thời điểm cấp presigned URL<br>- Presigned URL set `Content-Disposition: attachment`<br>- Ghi access log download tại thời điểm cấp URL |
| API | `GET /documents/{id}/download-url` 🔒 |

### F2.9: Upload phiên bản mới

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin |
| Mô tả | Khởi tạo presigned upload cho file phiên bản mới và complete sau khi client PUT xong |
| Input | `fileName`, `fileSize`, `contentType`, `versionNumber`, `changelog` |
| Business Rules | - File/version cũ giữ lại trong lịch sử, không ghi đè<br>- Version mới trở thành current version mặc định<br>- Cập nhật `version_number` trong documents<br>- Trích xuất nội dung mới và refresh PostgreSQL search vector<br>- Ghi audit log |
| API | `POST /documents/{id}/versions/init` 👑, `POST /documents/{id}/versions/{versionId}/complete` 👑 |

### F2.10: Xem lịch sử phiên bản

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin, User |
| Mô tả | Danh sách các phiên bản của tài liệu |
| Business Rules | - Kiểm tra quyền truy cập tài liệu trước khi trả version history<br>- Trả thông tin version, uploader, thời gian upload, changelog, current flag |
| API | `GET /documents/{id}/versions` 🔒 |

### F2.11: Tải phiên bản cũ

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin, User |
| Mô tả | Tải file của một phiên bản cụ thể |
| Business Rules | - Kiểm tra quyền truy cập tài liệu trước khi tải<br>- Ghi access log download version nếu cần thống kê chi tiết |
| API | `GET /documents/{id}/versions/{versionId}/download-url` 🔒 |

### F2.12: Khôi phục phiên bản cũ làm current version

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin |
| Mô tả | Chọn một phiên bản cũ làm phiên bản hiện hành |
| Business Rules | - Không xóa version hiện tại<br>- Cập nhật current version<br>- Trích xuất lại nội dung và refresh PostgreSQL search vector theo version được restore<br>- Ghi audit log |
| API | `POST /documents/{id}/versions/{versionId}/restore` 👑 |

### F2.13: Archive tài liệu

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin |
| Mô tả | Đưa tài liệu sang trạng thái `ARCHIVED` khi ngưng sử dụng |
| Business Rules | - Tài liệu `ARCHIVED` không hiển thị mặc định với User<br>- Admin có thể filter và xem tài liệu archived<br>- Cập nhật search index để loại khỏi search mặc định<br>- Ghi audit log |
| API | `POST /documents/{id}/archive` 👑 |

### F2.14: Restore tài liệu

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin |
| Mô tả | Khôi phục tài liệu đã archive/delete |
| Business Rules | - Restore từ `ARCHIVED` hoặc `DELETED` về `PROCESSING` hoặc `INDEXED` tùy trạng thái file/index<br>- Nếu cần, chạy lại extraction/search refresh trước khi tài liệu xuất hiện với User<br>- Ghi audit log |
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
| Mô tả | Upload nhiều file trong một thao tác với metadata/audience mặc định dùng chung |
| Input | `files[]` (required, mỗi file max 50MB), `categoryId`, `tagIds`, `visibility`, `departmentIds`, `ownerId`, `sharedUserIds`, `effectiveDate`, `expiryDate`, `titlePattern` |
| Output | Kết quả tổng hợp gồm `total`, `succeeded`, `failed` và danh sách kết quả theo từng file |
| Business Rules | - Init validate size/type khai báo từng file, complete validate object thực tế bằng Tika từng item<br>- Mỗi file hợp lệ tạo một document record, một `documentCode` tự sinh và version 1.0 riêng<br>- Cho phép partial success: file lỗi không làm rollback các file hợp lệ<br>- Extraction/indexing chạy độc lập theo từng document<br>- Ghi audit log cho từng document upload thành công |
| API | `POST /documents/batch-upload-init`, `POST /documents/batch-upload-complete` 👑 |

### F2.17: Xóa nhiều tài liệu cùng lúc

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin |
| Mô tả | Chọn nhiều tài liệu và đưa vào Thùng rác trong một thao tác |
| Input | `documentIds[]`, `reason` |
| Output | Kết quả partial success theo từng document |
| Business Rules | - Dùng cùng semantics với F2.6 cho từng tài liệu<br>- Tài liệu đã xóa hoặc không tồn tại trả lỗi theo item, không chặn toàn bộ batch<br>- Cập nhật search index để loại khỏi kết quả mặc định<br>- Ghi audit log cho từng document |
| API | `POST /documents/batch-delete` 👑 |

### F2.18: Chuyển tài liệu giữa danh mục/folder

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin |
| Mô tả | Chuyển một hoặc nhiều tài liệu từ category/folder hiện tại sang category/folder khác |
| Input | `documentIds[]` hoặc `{id}`, `targetCategoryId` |
| Output | Category cũ/mới với kết quả theo từng document nếu batch |
| Business Rules | - Category hiện có được dùng như folder, không tạo entity folder riêng<br>- Validate target category tồn tại, active và chưa soft delete<br>- Cập nhật `documents.category_id` và refresh PostgreSQL search row metadata category<br>- Ghi audit log với category cũ và mới |
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
| Input | `q` (required), `categoryId`, `departmentId`, `fileType`, `tagIds`, `dateFrom/To`, `status`, `visibility`, `ownerId`, `sort`, `page`, `size` |
| Output | Danh sách kết quả, highlight, relevance score, facets, search time |
| Business Rules | - Multi-match trên `title`, `description`, `extracted_content`, `tags`<br>- Exact/boosted match cho `documentCode`<br>- Mặc định chỉ trả tài liệu `INDEXED`<br>- Ghi search log qua PH6 |
| API | `GET /documents/search` 🔒 |

### F3.2: Permission-aware Search

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | System |
| Mô tả | Lọc quyền truy cập ngay trong PostgreSQL FTS query |
| Business Rules | - Search query phải filter theo quyền trước khi trả kết quả<br>- User không có quyền không được thấy title, snippet, metadata hoặc download URL<br>- Search, metadata detail, preview và download dùng cùng logic phân quyền |

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
| Filters | Category, department, tag, file type, owner/uploader, date range, document status, access level |

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
| Business Rules | - Gán phòng ban cho user phục vụ department audience của tài liệu/danh mục<br>- Refresh search row cho tài liệu bị ảnh hưởng khi department audience/filter thay đổi nếu cần |
| API | `GET/POST/PUT/DELETE /departments`, `/departments/{id}` |

### F4.7–F4.9: CRUD Tag (Nhãn)

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | Admin (write), User (read) |
| Mô tả | Quản lý nhãn gắn cho tài liệu |
| Đặc biệt | - `slug` tự động sinh từ `name`<br>- Trả về `documentCount` theo quyền người xem nếu dùng cho User |
| Business Rules | - Soft delete tag<br>- Refresh search row cho tài liệu bị ảnh hưởng khi tag metadata thay đổi |
| API | `GET/POST/PUT/DELETE /tags`, `/tags/{id}` |

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
| Metrics | `totalLogins`, `activeUsers`, `uniqueAccessUsers`, `previewCount`, `downloadCount`, `viewCount`, `searchCount`, `deniedAccessCount`, `accessByAction`, `accessTrend`, `topUsersByAccess` |
| Filters | `dateFrom`, `dateTo`, `granularity=day|week|month`, `departmentId`, `userId`, `action` |
| Business Rules | - Login/logout lấy từ `audit_logs`<br>- Preview/download/view/denied access lấy từ `access_logs`<br>- Search count lấy từ `search_logs`<br>- Chỉ Admin được xem dữ liệu tổng hợp; không expose chi tiết nhạy cảm không cần thiết như token/cookie/IP nếu không phục vụ audit |
| API | `GET /admin/dashboard/system-access` 👑 |

---

## PH6: Audit & Access Log

### F6.1: Ghi audit log quản trị tài liệu

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | System |
| Mô tả | Ghi nhận các hành động upload, update metadata, archive, delete, restore, upload/restore version |
| Data | `userId`, `documentId`, `action`, `changedFields`, `timestamp` |

### F6.2: Ghi access log preview/download

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | System |
| Mô tả | Ghi nhận hành động cấp presigned URL preview và download tài liệu |
| Data | `userId`, `documentId`, `action`, `timestamp` |

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
| Filters | Actor, action, documentId, keyword, date range |
| API | `GET /admin/audit-logs` 👑 |

### F6.5: Cung cấp dữ liệu log cho dashboard

| Thuộc tính | Chi tiết |
|------------|----------|
| Actor | System |
| Mô tả | Tổng hợp audit/access/search log thành metrics cho PH5 |
| Business Rules | - Dashboard chỉ đọc dữ liệu tổng hợp hoặc query tối ưu, không scan log lớn trực tiếp nếu dữ liệu tăng |

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
| | | **Document** | | |
| 11 | POST | `/documents/upload-init` | 👑 | F2.1 — Khởi tạo upload tài liệu |
| 12 | POST | `/documents/{id}/upload-complete` | 👑 | F2.1 — Xác nhận upload tài liệu |
| 12 | GET | `/documents` | 🔒 | F2.3 — Danh sách |
| 13 | GET | `/documents/{id}` | 🔒 | F2.4 — Chi tiết |
| 14 | PUT | `/documents/{id}` | 👑 | F2.5 — Cập nhật metadata và audience |
| 15 | DELETE | `/documents/{id}` | 👑 | F2.6 — Xóa mềm |
| 16 | GET | `/documents/{id}/preview-url` | 🔒 | F2.7 — Lấy URL preview |
| 17 | GET | `/documents/{id}/download-url` | 🔒 | F2.8 — Lấy URL download |
| 18 | GET | `/documents/{id}/versions` | 🔒 | F2.10 — Lịch sử phiên bản |
| 19 | POST | `/documents/{id}/versions/init` | 👑 | F2.9 — Khởi tạo upload version mới |
| 20 | GET | `/documents/{id}/versions/{versionId}/download-url` | 🔒 | F2.11 — Lấy URL tải version cũ |
| 21 | POST | `/documents/{id}/versions/{versionId}/complete` | 👑 | F2.9 — Xác nhận upload version mới |
| 22 | POST | `/documents/{id}/versions/{versionId}/restore` | 👑 | F2.12 — Restore version cũ |
| 22 | POST | `/documents/{id}/archive` | 👑 | F2.13 — Archive tài liệu |
| 23 | POST | `/documents/{id}/restore` | 👑 | F2.14 — Restore tài liệu |
| 24 | POST | `/documents/{id}/retry-indexing` | 👑 | F2.15 — Retry extraction/search refresh |
| | | **Search** | | |
| 25 | GET | `/documents/search` | 🔒 | F3.1 — Tìm kiếm full-text |
| 26 | GET | `/documents/search/suggestions` | 🔒 | F3.7 — Suggestions/autocomplete |
| | | **Master Data** | | |
| 27–31 | CRUD | `/categories` | 🔒/👑 | F4.1–F4.3 |
| 32–36 | CRUD | `/departments` | 🔒/👑 | F4.4–F4.6 |
| 37–41 | CRUD | `/tags` | 🔒/👑 | F4.7–F4.9 |
| | | **Dashboard** | | |
| 42 | GET | `/admin/dashboard` | 👑 | F5.1 — Dashboard tổng quan |
| 43 | GET | `/admin/dashboard/top-documents` | 👑 | F5.2 — Top tài liệu phổ biến |
| 44 | GET | `/admin/dashboard/recent-uploads` | 👑 | F5.3 — Tài liệu upload gần đây |
| 45 | GET | `/admin/dashboard/top-search-keywords` | 👑 | F5.4 — Top từ khóa tìm kiếm |
| 46 | GET | `/admin/dashboard/access-stats` | 👑 | F5.5 — Thống kê preview/download |
| 47 | GET | `/admin/dashboard/processing-errors` | 👑 | F5.6 — Lỗi processing/search refresh |
| | | **Audit & Access Log** | | |
| 48 | GET | `/admin/audit-logs` | 👑 | F6.4 — Xem audit/access log |

> Ký hiệu: 🔓 Public | 🔒 Authenticated | 👑 Admin only
