# Đặc tả Yêu cầu Hệ thống — Quản Lý Tài Liệu Nội Bộ (DMS)

> Tài liệu tổng quan yêu cầu phần mềm (SRS) cho hệ thống Quản lý & Tìm kiếm Tài liệu Doanh nghiệp.

---

## 1. Mục tiêu dự án

Xây dựng hệ thống quản lý tài liệu nội bộ cho doanh nghiệp, cho phép:

- **Admin**: Upload, phân loại, quản lý tài liệu nội bộ (SOP, quy trình, biểu mẫu, hướng dẫn...).
- **User (Nhân viên)**: Tìm kiếm, đọc online (preview) và tải tài liệu.
- **Chức năng cốt lõi**: **Search Engine** mạnh mẽ, hỗ trợ tìm kiếm full-text nội dung bên trong file.

---

## 2. Phạm vi hệ thống

### Trong phạm vi (In Scope)

| #   | Chức năng               | Mô tả                                                                             |
| --- | ----------------------- | --------------------------------------------------------------------------------- |
| 1   | Quản lý tài liệu        | CRUD tài liệu (upload, sửa metadata, xóa mềm)                                     |
| 2   | Phân loại tài liệu      | Quản lý danh mục (cây phân cấp), phòng ban, tags                                  |
| 3   | Tìm kiếm full-text      | Tìm kiếm qua PostgreSQL FTS trong tiêu đề + mô tả + nội dung file                  |
| 4   | Permission-aware Search | Kết quả tìm kiếm chỉ bao gồm tài liệu user hiện tại có quyền xem                  |
| 5   | Preview tài liệu        | Xem trực tiếp PDF; Word/Excel được convert sang PDF hoặc HTML preview bởi backend |
| 6   | Download tài liệu       | Tải file gốc theo quyền truy cập                                                  |
| 7   | Quản lý phiên bản       | Lịch sử phiên bản, upload version mới, chọn version hiện hành                     |
| 8   | Quản lý người dùng      | CRUD user, phân quyền Admin/User                                                  |
| 9   | Dashboard thống kê      | Thống kê tài liệu, lượt xem, lượt tải, từ khóa tìm kiếm                           |
| 10  | Xác thực & Phân quyền   | JWT + Refresh Token, RBAC (Admin/User), phân quyền truy cập tài liệu              |
| 11  | Audit & Access Log      | Ghi nhận upload, update metadata, delete, preview, download và search keyword     |

### Ngoài phạm vi (Out of Scope)

Hiện tại chưa loại trừ hạng mục chức năng hoặc hạ tầng nào khỏi phạm vi thiết kế. Các năng lực OCR, S3-compatible object storage và hardening production vẫn được xem là một phần của thiết kế hệ thống.

Quy ước môi trường lưu trữ:

- Dev/local dùng MinIO.
- Production dùng Cloudflare R2 qua S3-compatible API.

### MVP Cut & Milestones

Tài liệu này mô tả phạm vi đầy đủ của hệ thống DMS. Khi triển khai, hệ thống được cắt theo milestone để ưu tiên hoàn thành luồng cốt lõi upload → xử lý → search → preview/download trước các năng lực nâng cao.

#### Milestone 1 — MVP Core Search

Mục tiêu: chứng minh luồng quản lý tài liệu và tìm kiếm full-text có phân quyền hoạt động end-to-end.

| Nhóm | Bao gồm |
| ---- | ------- |
| Auth | Login, refresh token, RBAC `ADMIN`/`USER` |
| User/Department | CRUD user, CRUD department mức cơ bản, mỗi user thuộc một department chính |
| Document Upload | Admin khởi tạo presigned upload 1 file/request, client PUT trực tiếp vào MinIO/dev object storage, complete validate size/MIME thực tế và lưu metadata PostgreSQL |
| File support | PDF text và DOCX; chưa bắt buộc OCR scan/image và Excel preview |
| Processing | RabbitMQ worker extraction, lưu extracted content, tạo preview artifact khi cần và refresh PostgreSQL search vector |
| Search | Search title/description/content/document code/tags, filter `status = INDEXED`, permission-aware filter |
| Preview/Download | Preview/download bằng presigned GET URL; PDF/image dùng object gốc, DOCX có thể download bản gốc và preview nâng cao để milestone sau |
| Lifecycle | `AWAITING_UPLOAD`, `PROCESSING`, `INDEXED`, `EXTRACTION_FAILED`, `DELETED`; soft delete cơ bản |
| Audit | Ghi log upload, search, preview, download ở mức tối thiểu |

Done criteria:

1. Admin upload được PDF text/DOCX hợp lệ qua flow `upload-init -> PUT object storage -> upload-complete` và tài liệu chuyển từ `AWAITING_UPLOAD` sang `PROCESSING` rồi `INDEXED`.
2. User chỉ search/preview/download được tài liệu có quyền theo `PUBLIC`, `DEPARTMENT`, `RESTRICTED`.
3. Search trả kết quả từ PostgreSQL FTS với highlight cơ bản và P95 < 500ms với bộ dữ liệu MVP dưới 10k documents.
4. File sai định dạng, vượt 50 MB hoặc thuộc extension bị chặn bị từ chối ở `upload-init` hoặc `upload-complete` sau khi Tika validate MIME thực tế.
5. Tài liệu `DELETED` không xuất hiện trong search và không preview/download được bởi User.

#### Milestone 2 — Document Experience & Admin Operations

Mục tiêu: hoàn thiện trải nghiệm quản trị và đọc tài liệu sau khi search core ổn định.

| Nhóm | Bao gồm |
| ---- | ------- |
| File support | PDF scanned/image OCR, XLS/XLSX extraction, DOC/DOCX/XLS/XLSX preview qua PDF/HTML đã sanitize |
| Versioning | Upload version mới, version history, chọn current version, refresh search vector khi current version đổi |
| Lifecycle | Archive/restore, retry thủ công cho `EXTRACTION_FAILED`, rule rõ cho trạng thái sau restore |
| Metadata | Quản lý category tree, tags, filter nâng cao |
| Dashboard | Thống kê cơ bản số tài liệu, lượt preview/download, top search keywords |
| Audit | Mở rộng audit log cho update metadata, delete/restore, version changes |

Done criteria:

1. Admin xem được lịch sử version và đổi current version mà không mất version cũ.
2. Office/image/scanned PDF có extraction hoặc preview theo rule đã định, failure được ghi nhận và retry được.
3. Dashboard lấy số liệu từ log/aggregate phù hợp, không query trực tiếp log thô cho thống kê nặng.
4. Archive/restore có rule trạng thái rõ và nhất quán với search/preview/download.

#### Milestone 3 — Production Readiness

Mục tiêu: chuẩn bị vận hành production và khả năng phục hồi dữ liệu.

| Nhóm | Bao gồm |
| ---- | ------- |
| Object storage | Cloudflare R2 qua S3-compatible API, presigned URL, private bucket/CORS và lifecycle cleanup orphan object |
| Security | CORS/CSRF decision, cookie SameSite theo deployment topology, malware scan, hardening headers |
| Reliability | RabbitMQ retry queues/DLQ rõ ràng, batch search refresh nightly, rebuild `document_search_index` từ PostgreSQL/object storage |
| Observability | Metrics, structured logs, alert cho extraction/search refresh failure |
| Performance | Dashboard aggregation, search suggestion cache, tuning PostgreSQL FTS analyzer/index |

Done criteria:

1. `document_search_index` được xem là derived search table và có quy trình rebuild từ PostgreSQL + object/content.
2. Upload/object/DB/index failure có cleanup hoặc retry path rõ ràng.
3. Auth cookie, CORS và CSRF được cấu hình theo môi trường dev/prod.
4. Production deployment dùng R2 và có rule cleanup object không còn được DB tham chiếu.

#### Thứ tự triển khai khuyến nghị

1. Backend auth/RBAC và data model user/department/document/version tối thiểu.
2. Object storage dev + presigned upload init/complete + metadata transaction.
3. RabbitMQ worker extraction/search refresh pipeline cho PDF text/DOCX.
4. Permission-aware PostgreSQL FTS query.
5. Frontend presigned upload/search/result/detail/preview-url/download-url golden path.
6. Audit log tối thiểu và dashboard đơn giản.
7. Versioning, OCR, Office preview nâng cao, archive/restore.
8. Production hardening và R2.

---

## 3. Đối tượng sử dụng (Actors)

| Actor     | Vai trò       | Quyền hạn                                                                                                       |
| --------- | ------------- | --------------------------------------------------------------------------------------------------------------- |
| **ADMIN** | Quản trị viên | Upload, Edit, Delete tài liệu; Quản lý categories/tags/departments/users; Xem dashboard thống kê; xem audit log |
| **USER**  | Nhân viên     | Tìm kiếm, Đọc (preview), Tải (download) tài liệu được cấp quyền; Xem & sửa profile cá nhân                      |

---

## 4. Quyền truy cập tài liệu

| Access Level | Mô tả                                   | Ai có quyền xem                               |
| ------------ | --------------------------------------- | --------------------------------------------- |
| `PUBLIC`     | Tài liệu công khai nội bộ               | Tất cả user đã đăng nhập                      |
| `DEPARTMENT` | Tài liệu thuộc một hoặc nhiều phòng ban | User thuộc phòng ban được gán, Admin          |
| `RESTRICTED` | Tài liệu giới hạn                       | Owner, Admin hoặc user được chia sẻ trực tiếp |

Business rules:

- Search, preview và download phải áp dụng cùng một logic phân quyền.
- PostgreSQL FTS query phải filter theo quyền truy cập trước khi trả kết quả, không search xong rồi mới loại bỏ ở frontend.
- User không có quyền không được nhìn thấy title, snippet, metadata hoặc download URL của tài liệu.
- Admin có quyền quản trị toàn bộ metadata và lifecycle tài liệu.

### PostgreSQL ACL Query Model

Search query phải JOIN về bảng nguồn để áp quyền bằng SQL, không lưu ACL dạng array denormalized như search engine ngoài:

| Source | Mục đích |
| ----- | -------- |
| `documents.status` | Lọc lifecycle; User mặc định chỉ thấy `INDEXED` |
| `documents.access_level` | `PUBLIC`, `DEPARTMENT`, `RESTRICTED` |
| `documents.owner_id` | Chủ sở hữu/người chịu trách nhiệm tài liệu |
| `document_department_accesses` | Danh sách phòng ban được cấp quyền xem tài liệu |
| `document_user_accesses` | Danh sách user được chia sẻ trực tiếp |

Query cho User thường phải áp filter trước khi trả kết quả:

```text
d.status = 'INDEXED'
AND (
  d.access_level = 'PUBLIC'
  OR d.owner_id = current_user.id
  OR EXISTS (department ACL match any current_user.department_ids)
  OR EXISTS (user ACL match current_user.id)
)
```

Query cho Admin:

```text
Nếu current_user.role = ADMIN:
  - Không bắt buộc áp ACL filter theo access_level/owner/department/allowed_user_ids.
  - Vẫn áp filter status/access_level/department/category/tag/date nếu Admin truyền filter trên màn hình.
  - Mặc định không trả `DELETED` cho danh sách/search thông thường, trừ khi Admin filter rõ `status = DELETED`.
```

Business decisions:

- MVP giả định mỗi user có một department chính; query vẫn dùng `current_user.department_ids` để không phải đổi model nếu sau này user thuộc nhiều phòng ban.
- Chưa áp dụng kế thừa quyền theo department hierarchy trong MVP; nếu cần kế thừa, backend phải mở rộng `current_user.department_ids` thành toàn bộ department được thừa hưởng trước khi query PostgreSQL FTS.
- User bị deactivate không được cấp access token mới; nếu token hiện tại còn hạn, API authorization phải kiểm tra trạng thái user ở backend trước search/preview/download.
- Khi user đổi department, không cần refresh search vector vì search query JOIN ACL và dùng department hiện tại của user. Chỉ cần refresh search row khi metadata/content search của document thay đổi.
- Facet/aggregation cho User phải chạy trên cùng tập kết quả đã áp ACL filter để không lộ category/tag/department của tài liệu không có quyền.
- Search suggestions cũng phải áp cùng ACL filter; không gợi ý title/document code/tag chỉ tồn tại trong tài liệu user không có quyền.

---

## 5. Loại tài liệu hỗ trợ

| Loại          | Định dạng               | Trích xuất nội dung | Preview | Ghi chú                                          |
| ------------- | ----------------------- | :-----------------: | :-----: | ------------------------------------------------ |
| PDF (Text)    | `.pdf`                  |         ✅          |   ✅    | Apache PDFBox, browser render trực tiếp          |
| PDF (Scanned) | `.pdf`                  |         ✅          |   ✅    | OCR bằng Tesseract để search nội dung            |
| Word (mới)    | `.docx`                 |         ✅          |   ✅    | Apache POI - XWPF, convert sang PDF/HTML preview |
| Word (cũ)     | `.doc`                  |         ✅          |   ✅    | Apache POI - HWPF, convert sang PDF/HTML preview |
| Excel (mới)   | `.xlsx`                 |         ✅          |   ✅    | Apache POI, convert sang HTML table hoặc PDF     |
| Excel (cũ)    | `.xls`                  |         ✅          |   ✅    | Apache POI, convert sang HTML table hoặc PDF     |
| Ảnh           | `.jpg`, `.png`, `.tiff` |         ✅          |   ✅    | Preview trực tiếp, OCR bằng Tesseract            |

### Upload Constraints

| Ràng buộc              | Giá trị                                                              |
| ---------------------- | -------------------------------------------------------------------- |
| Kích thước file tối đa | 50 MB                                                                |
| Số file mỗi request    | 1                                                                    |
| Đặt tên file lưu trữ   | UUID-based, không dùng tên file user nhập làm storage path trực tiếp |
| Kiểm tra định dạng     | Validate MIME type thực tế và extension                              |
| File bị chặn           | Không cho phép upload `.exe`, `.sh`, `.bat`, `.cmd`, `.js`, `.html`  |
| Nội dung độc hại       | Virus/Malware scan nâng cao thuộc production hardening               |

---

## 6. Search Engine Requirements

Tìm kiếm là chức năng cốt lõi và được thực thi bởi PostgreSQL FTS.

| Nhóm yêu cầu  | Chi tiết                                                                                        |
| ------------- | ----------------------------------------------------------------------------------------------- |
| Search fields | `title`, `description`, `extracted_content`, `document_code`, `tags`                            |
| Query type    | Multi-match query, exact match cho mã tài liệu, fuzzy search cho lỗi chính tả                   |
| Filters       | Category, department, tag, file type, owner/uploader, date range, document status, access level |
| Sorting       | Relevance, createdAt, updatedAt, viewCount, downloadCount, title                                |
| Highlight     | PostgreSQL ts_headline highlight cho `title`, `description`, `extracted_content`                  |
| Facets        | Đếm kết quả theo category, department, file type, tag                                           |
| Permission    | Query phải filter theo quyền truy cập của current user                                          |
| Suggestions   | Autocomplete/suggestion cho title, document code, tags (có thể cache bằng Redis)                |

Relevance priority:

1. Exact match `document_code`.
2. Match trong `title`.
3. Match trong `tags`.
4. Match trong `description`.
5. Match trong `extracted_content`.
6. Boost nhẹ cho tài liệu mới hơn hoặc có lượt xem/tải cao hơn.

---

## 7. Trạng thái tài liệu

| Status              | Mô tả                                                                 | Hiển thị với User |
| ------------------- | --------------------------------------------------------------------- | :---------------: |
| `AWAITING_UPLOAD`   | Metadata đã tạo, đang chờ client PUT file qua presigned URL và gọi complete |       Không       |
| `PROCESSING`        | File đã upload và validate xong, worker đang trích xuất nội dung hoặc refresh PostgreSQL search vector |       Không       |
| `INDEXED`           | Tài liệu đã sẵn sàng để search, preview, download                     | Có, nếu có quyền  |
| `EXTRACTION_FAILED` | Lỗi trích xuất nội dung hoặc index                                    |       Không       |
| `ARCHIVED`          | Tài liệu ngưng sử dụng nhưng vẫn giữ lịch sử                          |  Không mặc định   |
| `DELETED`           | Xóa mềm, có thể restore bởi Admin                                     |       Không       |

Business rules:

- Search mặc định chỉ trả về tài liệu `INDEXED`.
- Tài liệu `AWAITING_UPLOAD` quá TTL phải được cleanup để không giữ metadata/upload object mồ côi.
- Tài liệu `DELETED` không xuất hiện trong search, preview hoặc download.
- Hệ thống tự động retry extraction/search refresh mỗi 30 phút cho tài liệu `EXTRACTION_FAILED` do lỗi xử lý/refresh search tạm thời.
- Admin có thể xem tài liệu lỗi xử lý để retry extraction/search refresh thủ công.
- Soft delete không xóa file vật lý ngay lập tức.

---

## 8. Quản lý phiên bản tài liệu

| Rule                 | Mô tả                                                                                                 |
| -------------------- | ----------------------------------------------------------------------------------------------------- |
| Không mất version cũ | Upload version mới không ghi đè file/version cũ                                                       |
| Current version      | Search, preview và download mặc định sử dụng version hiện hành                                        |
| Version history      | Admin có thể xem lịch sử version, uploader, thời gian upload và changelog                             |
| Refresh search vector | Khi version hiện hành thay đổi, hệ thống phải trích xuất lại nội dung và refresh PostgreSQL search vector |
| Restore              | Admin có thể chọn version cũ làm version hiện hành nếu cần                                            |

### Current Version Switch Rule

- Upload version mới tạo `document_versions` mới ở trạng thái `PROCESSING`; version hiện hành cũ vẫn tiếp tục phục vụ search, preview và download.
- Version mới chỉ được set làm `current_version_id` sau khi extraction, preview artifact cần thiết và refresh search vector thành công.
- Khi switch current version thành công, PostgreSQL search row phải phản ánh metadata và content của version mới trong cùng một after-commit/retry flow.
- Nếu extraction/refresh search của version mới thất bại, version mới chuyển `EXTRACTION_FAILED`, `current_version_id` không đổi và User vẫn thấy version hiện hành cũ.
- Admin có thể retry version lỗi hoặc xóa mềm version lỗi nếu version đó chưa từng là current.
- Khi Admin chọn version cũ làm current, hệ thống phải refresh search vector theo nội dung version được chọn trước khi User thấy kết quả search/preview/download mới.

---

## 9. Audit & Access Log

Hệ thống cần ghi nhận các hành động quan trọng để phục vụ dashboard, truy vết và kiểm toán nội bộ.

| Action                  | Actor      | Dữ liệu cần ghi nhận                                         |
| ----------------------- | ---------- | ------------------------------------------------------------ |
| Upload document         | Admin      | userId, documentId, fileName, fileType, fileSize, timestamp  |
| Update metadata         | Admin      | userId, documentId, changedFields, timestamp                 |
| Delete/Restore document | Admin      | userId, documentId, action, timestamp                        |
| Preview document        | Admin/User | userId, documentId, timestamp cấp presigned URL preview       |
| Download document       | Admin/User | userId, documentId, timestamp cấp presigned URL download      |
| Search                  | Admin/User | userId, keyword, filters, resultCount, searchTime, timestamp |

---

## 10. Yêu cầu phi chức năng

| #   | Yêu cầu                | Chi tiết                                                                                                     |
| --- | ---------------------- | ------------------------------------------------------------------------------------------------------------ |
| 1   | **Search Performance** | P95 search latency < 500ms với < 10k documents trên PostgreSQL FTS single-node                                |
| 2   | **Search Refresh SLA**       | Tài liệu upload thành công được trích xuất và refresh search vector trong vòng 60 giây với file hợp lệ                       |
| 3   | **Upload Performance** | File tối đa 50 MB upload không timeout trong điều kiện mạng nội bộ ổn định                                   |
| 4   | **Security**           | Tất cả API trừ login/refresh yêu cầu JWT; mật khẩu hash bằng BCrypt; Refresh Token lưu HttpOnly Cookie       |
| 5   | **Authorization**      | Search, preview, download và metadata detail phải kiểm tra quyền truy cập tài liệu                           |
| 6   | **Availability**       | Hệ thống hoạt động 99% uptime trong giờ làm việc                                                             |
| 7   | **Scalability**        | Kiến trúc PostgreSQL FTS-first, cho phép mở rộng cluster search và Cloudflare R2/S3-compatible object storage |
| 8   | **Data Integrity**     | Soft delete cho mọi entity chính, không mất dữ liệu; version cũ không bị ghi đè                              |
| 9   | **API Standard**       | RESTful API, OpenAPI 3 / Swagger documentation                                                               |
| 10  | **Response Format**    | Tất cả endpoint trả JSON thống nhất qua `ApiResponse<T>`                                                     |
| 11  | **Preview Safety**     | Nội dung preview phải được sanitize khi render HTML để tránh XSS                                             |

### Auth, CSRF & CORS Decisions

- Access token trả về trong response login/refresh và lưu trong memory của frontend, không lưu vào LocalStorage/SessionStorage.
- Khi reload tab, frontend gọi `POST /auth/refresh` để lấy access token mới; nếu refresh thất bại thì redirect về login.
- Refresh token lưu trong HttpOnly Cookie, path giới hạn ở `/api/v1/auth`, thời hạn mặc định 7 ngày.
- Deployment cùng site/domain dùng `SameSite=Strict`, `Secure`, `HttpOnly`; đây là cấu hình production ưu tiên.
- Nếu frontend/backend khác site trong dev hoặc production, phải cấu hình rõ allowed origins, bật credentialed CORS cho origin cụ thể, dùng `SameSite=None; Secure`, và không dùng wildcard origin.
- `POST /auth/refresh` và `POST /auth/logout` phải có CSRF protection nếu cookie refresh token được gửi cross-site. Cơ chế đề xuất là double-submit CSRF token hoặc custom CSRF header do frontend gửi kèm.
- Logout phải revoke refresh token phía server và trả `Set-Cookie` xóa cookie refresh token với cùng `Path`/`SameSite`/`Secure` tương ứng.

### DB/Object Storage/Search Consistency Pattern

- PostgreSQL là source of truth cho metadata, ACL, document lifecycle, version hiện hành, extracted content, search vector và object key đang được tham chiếu.
- Object storage chỉ lưu binary/artifact theo object key UUID-based; không dùng object storage làm nguồn sự thật cho quyền hoặc lifecycle.
- Search data nằm trong PostgreSQL (`document_search_index`) và có thể rebuild từ các bảng nguồn + extracted content.
- Upload tạo object key và row `AWAITING_UPLOAD`, trả presigned PUT URL để client upload binary trực tiếp vào object storage; `upload-complete` validate object rồi chuyển `PROCESSING`. Row quá TTL hoặc object không còn được PostgreSQL tham chiếu phải được cleanup.
- Extraction/preview conversion/refresh search chỉ chạy sau khi PostgreSQL commit thành công bằng RabbitMQ message publish after-commit.
- Nếu extraction hoặc refresh search fail sau khi DB commit, document/version giữ trạng thái `PROCESSING` hoặc chuyển `EXTRACTION_FAILED`; không rollback metadata đã commit.
- Delete/archive/restore cập nhật PostgreSQL trước; search query tự loại theo `status`/ACL mặc định. Soft delete không xóa object vật lý ngay.
- Object deletion vật lý chạy bằng cleanup job theo retention policy và chỉ xóa object không còn được PostgreSQL tham chiếu.
- Batch reindex nightly dùng để self-heal `document_search_index`; job này đọc PostgreSQL/document content làm nguồn chính và refresh search vector.

---

## 11. Acceptance Criteria

| #   | Tiêu chí nghiệm thu                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------ |
| 1   | Admin có thể upload file hợp lệ, metadata được lưu và tài liệu được refresh PostgreSQL search vector.           |
| 2   | User có thể tìm tài liệu theo từ khóa trong title, description và extracted content.                   |
| 3   | Kết quả search trả về trong P95 < 500ms với dưới 10k documents.                                        |
| 4   | User không thấy tài liệu không có quyền truy cập trong search, preview, download hoặc metadata detail. |
| 5   | Search result có highlight snippet cho nội dung khớp nếu PostgreSQL FTS trả về highlight.               |
| 6   | File không hợp lệ, file vượt quá 50 MB hoặc file thuộc extension bị chặn phải bị từ chối.              |
| 7   | Tài liệu bị xóa mềm không xuất hiện trong search và không thể preview/download bởi User.               |
| 8   | Upload version mới không làm mất version cũ và search mặc định dùng version hiện hành.                 |
| 9   | Preview PDF hoạt động trực tiếp trên browser; Word/Excel có preview qua bản convert PDF/HTML.          |
| 10  | Hệ thống ghi access log khi cấp preview/download presigned URL và ghi search history cho truy vấn tìm kiếm.                  |
| 11  | Admin có thể xem dashboard thống kê số tài liệu, lượt xem, lượt tải và từ khóa tìm kiếm.               |

---

## 12. Tài liệu liên quan

| Tài liệu              | Đường dẫn                                                    |
| --------------------- | ------------------------------------------------------------ |
| Luồng nghiệp vụ chính | [buss_mainflow.md](./buss_mainflow.md)                       |
| Phân rã phân hệ       | [phan_ra_phan_he_he_thong.md](./phan_ra_phan_he_he_thong.md) |
| Phân rã tính năng     | [phan_ra_tinh_nang.md](./phan_ra_tinh_nang.md)               |
| Phân rã màn hình      | [phan_ra_man_hinh.md](./phan_ra_man_hinh.md)                 |
| Thiết kế chi tiết     | [../design.md](../design.md)                                 |
| System Architecture   | [../sa/sa.md](../sa/sa.md)                                   |
| Tech Stack            | [../sa/techstack.md](../sa/techstack.md)                     |
| Server & Deployment   | [../sa/server.md](../sa/server.md)                           |
