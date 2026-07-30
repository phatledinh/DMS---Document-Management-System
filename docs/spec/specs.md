# Đặc tả Yêu cầu Hệ thống — Quản Lý Tài Liệu Nội Bộ (DMS)

> Tài liệu tổng quan yêu cầu phần mềm (SRS) cho hệ thống Quản lý & Tìm kiếm Tài liệu Doanh nghiệp.

---

## 1. Mục tiêu dự án

Xây dựng hệ thống quản lý tài liệu nội bộ cho doanh nghiệp, cho phép:

- **Admin**: Upload một/nhiều tài liệu, phân loại theo danh mục/folder, quản lý metadata/audience/version/lifecycle, theo dõi dashboard, xử lý tài liệu lỗi và thùng rác.
- **User (Nhân viên)**: Tìm kiếm, đọc online (preview) và tải tài liệu được cấp quyền.
- **Chức năng cốt lõi**: **Search Engine** mạnh mẽ, hỗ trợ tìm kiếm full-text nội dung bên trong file và luôn áp dụng permission filter trước khi trả kết quả.
- **Vận hành tài liệu**: Tự sinh mã tài liệu, thống kê dung lượng theo MB, ghi nhận dữ liệu truy cập, tự purge tài liệu trong thùng rác sau 30 ngày.

---

## 2. Phạm vi hệ thống

### Trong phạm vi (In Scope)

| #   | Chức năng               | Mô tả                                                                             |
| --- | ----------------------- | --------------------------------------------------------------------------------- |
| 1   | Quản lý tài liệu        | Upload, sửa metadata/audience, archive, restore, move, soft delete và permanent delete |
| 2   | Phân loại tài liệu      | Quản lý danh mục (cây phân cấp), phòng ban, tags                                  |
| 3   | Tìm kiếm full-text      | Tìm kiếm qua PostgreSQL FTS trong tiêu đề + mô tả + nội dung file                  |
| 4   | Permission-aware Search | Kết quả tìm kiếm chỉ bao gồm tài liệu user hiện tại có quyền xem                  |
| 5   | Preview tài liệu        | Xem trực tiếp PDF; Word/Excel được convert sang PDF hoặc HTML preview bởi backend |
| 6   | Download tài liệu       | Tải file gốc theo quyền truy cập                                                  |
| 7   | Quản lý phiên bản       | Lịch sử phiên bản, upload version mới, chọn version hiện hành                     |
| 8   | Quản lý người dùng      | CRUD user, phân quyền Admin/User                                                  |
| 9   | Dashboard thống kê      | Thống kê tài liệu, tổng MB lưu trữ, dữ liệu truy cập, lỗi xử lý, từ khóa tìm kiếm |
| 10  | Xác thực & Resource Access | JWT + Refresh Token, user identity và quyền truy cập theo tài liệu/danh mục       |
| 11  | Audit & Access Log      | Ghi nhận upload, update metadata, delete, restore, move, batch action và search   |
| 12  | Thùng rác tài liệu      | Quản lý tài liệu đã xóa mềm, restore hoặc xóa vĩnh viễn sau thời hạn              |
| 13  | Batch operations        | Upload nhiều file, xóa nhiều file, chuyển nhiều file giữa các danh mục/folder     |
| 14  | Mã tài liệu tự sinh     | Backend tự sinh `document_code` unique khi upload, không nhập/sửa thủ công        |
| 15  | Theo dõi lỗi xử lý      | Admin xem tài liệu lỗi kèm lý do lỗi, retry extraction/indexing                   |

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
| Auth | Login, refresh token, user identity; role chỉ phục vụ thao tác quản trị nếu cần |
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
2. Search/preview/download đi qua resource access policy; hiện tại permissive mặc định `PUBLIC`, sau này bật enforcement theo audience `RESTRICTED`.
3. Search trả kết quả từ PostgreSQL FTS với highlight cơ bản và P95 < 500ms với bộ dữ liệu MVP dưới 10k documents.
4. File sai định dạng, vượt 50 MB hoặc thuộc extension bị chặn bị từ chối ở `upload-init` hoặc `upload-complete` sau khi Tika validate MIME thực tế.
5. Tài liệu `DELETED` không xuất hiện trong search và không preview/download được bởi User.

#### Milestone 2 — Document Experience & Admin Operations

Mục tiêu: hoàn thiện trải nghiệm quản trị và đọc tài liệu sau khi search core ổn định.

| Nhóm | Bao gồm |
| ---- | ------- |
| File support | PDF scanned/image OCR, XLS/XLSX extraction, DOC/DOCX/XLS/XLSX preview qua PDF/HTML đã sanitize |
| Versioning | Upload version mới, version history, chọn current version, refresh search row khi current version đổi |
| Lifecycle | Archive/restore, retry thủ công cho `EXTRACTION_FAILED`, thùng rác, permanent delete và tự purge sau 30 ngày |
| Metadata | Quản lý category tree như folder, tags, filter nâng cao, chuyển tài liệu giữa danh mục |
| Batch operations | Upload nhiều file, xóa nhiều file, chuyển nhiều file với partial success theo từng item |
| Dashboard | Thống kê số tài liệu, tổng dung lượng active/trash/version/total theo MB, dữ liệu truy cập hệ thống, lỗi xử lý, top search keywords |
| Audit | Mở rộng audit log cho update metadata, delete/restore, permanent delete, move, batch action, version changes |

Done criteria:

1. Admin xem được lịch sử version và đổi current version mà không mất version cũ.
2. Office/image/scanned PDF có extraction hoặc preview theo rule đã định, failure được ghi nhận và retry được.
3. Dashboard hiển thị tổng dung lượng file toàn hệ thống theo MB, dữ liệu truy cập hệ thống và lấy số liệu từ log/aggregate phù hợp, không query trực tiếp log thô cho thống kê nặng.
4. Archive/restore/delete có rule trạng thái rõ và nhất quán với search/preview/download.
5. Tài liệu bị xóa mềm xuất hiện trong Thùng rác, có `purgeAfter`, restore được trước hạn và bị purge vĩnh viễn sau 30 ngày.
6. Admin upload/xóa/chuyển nhiều tài liệu cùng lúc và nhận kết quả partial success theo từng file/tài liệu.
7. Admin xem được danh sách tài liệu lỗi xử lý kèm `errorCode`, `errorMessage`, stage lỗi và có thể retry.

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

1. Backend auth và data model user/department/document/version tối thiểu, kèm điểm móc resource access policy permissive.
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
| **ADMIN** | Quản trị viên | Upload/batch upload, edit metadata/audience, move, archive, delete/restore/permanent delete tài liệu; quản lý categories/tags/departments/users; xem dashboard dung lượng/truy cập/lỗi xử lý; xem audit log |
| **USER**  | Nhân viên     | Tìm kiếm, Đọc (preview), Tải (download) tài liệu được phép xem theo resource access policy; Xem & sửa profile cá nhân |

---

## 4. Quyền truy cập tài liệu/danh mục

DMS dùng quyền truy cập theo từng tài nguyên, không dùng RBAC để quyết định ai được xem tài liệu. Role nếu có chỉ phục vụ thao tác quản trị hệ thống; quyền xem trả lời câu hỏi user có nằm trong audience của tài liệu hoặc danh mục này không.

| Visibility | Mô tả | Ai có quyền xem khi enforcement bật |
| ---------- | ----- | ----------------------------------- |
| `PUBLIC` | Tài liệu/danh mục công khai nội bộ | Tất cả user đã đăng nhập |
| `RESTRICTED` | Tài liệu/danh mục giới hạn audience | Owner, user được chia sẻ trực tiếp, hoặc user thuộc department/group được cấp quyền |

Business rules:

- Giai đoạn hiện tại chạy permissive: mặc định `PUBLIC`, chưa chặn theo audience.
- Search, preview và download vẫn phải đi qua cùng resource access policy để sau này bật enforcement không cần đổi API/read-path.
- PostgreSQL FTS query phải áp resource access policy trước khi trả kết quả, không search xong rồi mới loại bỏ ở frontend.
- Khi enforcement bật, user không thuộc audience không được nhìn thấy title, snippet, metadata hoặc download URL của tài liệu.

### PostgreSQL Resource Access Query Model

Search query phải JOIN về bảng nguồn để áp quyền bằng SQL, không lưu audience dạng array denormalized như search engine ngoài:

| Source | Mục đích |
| ----- | -------- |
| `documents.status` | Lọc lifecycle; User mặc định chỉ thấy `INDEXED` |
| `documents.visibility` | `PUBLIC`, `RESTRICTED` |
| `documents.owner_id` | Chủ sở hữu/người chịu trách nhiệm tài liệu |
| `document_department_accesses` | Department audience của tài liệu |
| `document_user_accesses` | User audience của tài liệu |
| `category_department_accesses` | Department audience của danh mục |
| `category_user_accesses` | User audience của danh mục |

Query khi bật enforcement:

```text
d.status = 'INDEXED'
AND (
  d.visibility = 'PUBLIC'
  OR d.owner_id = current_user.id
  OR EXISTS (document department audience match any current_user.department_ids)
  OR EXISTS (document user audience match current_user.id)
  OR EXISTS (category department audience match any current_user.department_ids)
  OR EXISTS (category user audience match current_user.id)
)
```

Query cho Admin:

```text
Nếu current_user có quyền quản trị metadata/lifecycle:
  - Hiện tại resource access policy permissive nên chưa bắt buộc lọc theo audience.
  - Vẫn áp filter status/visibility/department/category/tag/date nếu người dùng truyền filter trên màn hình.
  - Mặc định không trả `DELETED` cho danh sách/search thông thường, trừ khi filter rõ `status = DELETED`.
```

Business decisions:

- MVP giả định mỗi user có một department chính; query vẫn dùng `current_user.department_ids` để không phải đổi model nếu sau này user thuộc nhiều phòng ban.
- Chưa áp dụng kế thừa quyền theo department hierarchy trong MVP; nếu cần kế thừa, backend phải mở rộng `current_user.department_ids` thành toàn bộ department được thừa hưởng trước khi query PostgreSQL FTS.
- User bị deactivate không được cấp access token mới; nếu token hiện tại còn hạn, API authorization phải kiểm tra trạng thái user ở backend trước search/preview/download.
- Khi user đổi department, không cần refresh search vector vì search query JOIN audience và dùng department hiện tại của user. Chỉ cần refresh search row khi metadata/content search của document thay đổi.
- Facet/aggregation cho User phải chạy trên cùng tập kết quả đã áp resource access filter để không lộ category/tag/department của tài liệu không có quyền khi enforcement bật.
- Search suggestions cũng phải áp cùng resource access filter; không gợi ý title/document code/tag chỉ tồn tại trong tài liệu user không có quyền khi enforcement bật.

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
| Số file mỗi request    | `upload-init` nhận 1 file; `batch-upload-init` nhận nhiều file và trả presigned PUT URL theo item, mỗi file tối đa 50 MB |
| Metadata bắt buộc      | File, title, category, visibility; audience tùy chọn; `document_code` do backend tự sinh |
| Đặt tên file lưu trữ   | UUID-based, không dùng tên file user nhập làm storage path trực tiếp |
| Kiểm tra định dạng     | Validate MIME type thực tế và extension                              |
| File bị chặn           | Không cho phép upload `.exe`, `.sh`, `.bat`, `.cmd`, `.js`, `.html`  |
| Nội dung độc hại       | Virus/Malware scan nâng cao thuộc production hardening               |

---


### Quy tắc mã tài liệu

- `document_code` là mã tài liệu chính thức do backend tự sinh khi upload, không nhập thủ công trên form.
- Format đề xuất: `DMS-{yyyyMM}-{sequence6}`, ví dụ `DMS-202607-000001`.
- Upload nhiều file tạo nhiều document và mỗi document có mã riêng.
- Mã tài liệu là immutable trong luồng metadata thông thường; Admin chỉ xem, không nhập/sửa trên form upload/edit.
- Mã tài liệu vẫn là field search quan trọng, được ưu tiên exact match/boost trong PostgreSQL FTS.
- Backend phải xử lý concurrency bằng transaction/sequence và unique index để không sinh trùng mã khi nhiều Admin upload cùng lúc.

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
| `DELETED`           | Xóa mềm trong Thùng rác, có thể restore trước `purge_after`           |       Không       |

Business rules:

- Search mặc định chỉ trả về tài liệu `INDEXED`.
- Tài liệu `DELETED` nằm trong Thùng rác, có thể restore trước `purge_after`; hệ thống tự xóa vĩnh viễn sau 30 ngày.
- Khi soft delete, hệ thống lưu trạng thái trước đó để restore về trạng thái phù hợp hoặc chuyển `PROCESSING` nếu cần refresh search row.
- Tài liệu `DELETED` không xuất hiện trong search, preview hoặc download.
- Hệ thống tự động retry extraction/search refresh mỗi 30 phút cho tài liệu `EXTRACTION_FAILED` do lỗi xử lý/refresh search tạm thời.
- Admin có thể xem tài liệu lỗi xử lý để retry extraction/search refresh thủ công.
- Soft delete không xóa file vật lý ngay lập tức.

---


## 8. Thùng rác, batch operations và di chuyển tài liệu

### Thùng rác tài liệu

| Rule | Mô tả |
| ---- | ----- |
| Soft delete | Admin xóa tài liệu thì hệ thống set `status = DELETED`, `deleted_at`, `deleted_by`, `purge_after = deleted_at + 30 ngày`, lưu `previous_status`. |
| Visibility | Tài liệu `DELETED` không xuất hiện trong search/list/preview/download mặc định của User. |
| Trash list | Admin xem được danh sách tài liệu trong thùng rác với title/fileName/fileSize/category/deletedBy/deletedAt/purgeAfter/daysUntilPurge. |
| Restore | Admin có thể restore một/nhiều tài liệu trước khi purge; hệ thống clear deleted fields và refresh search row nếu cần. |
| Permanent delete | Admin có thể xóa vĩnh viễn thủ công; hệ thống xóa object storage, extracted content và PostgreSQL search row, giữ audit logs. |
| Auto purge | Scheduled job hằng ngày tự purge tài liệu `DELETED` khi `purge_after <= now()`. |

### Batch operations

| Operation | Rule |
| --------- | ---- |
| Batch upload | Nhận nhiều file, validate từng file, mỗi file hợp lệ tạo document/version/mã tài liệu riêng. |
| Batch delete | Nhận `documentIds[]`, đưa từng tài liệu hợp lệ vào thùng rác, trả kết quả theo từng item. |
| Batch move | Nhận `documentIds[]` và `targetCategoryId`, chuyển từng tài liệu hợp lệ sang danh mục/folder mới. |
| Error model | Batch operations dùng partial success; lỗi một item không rollback toàn bộ batch. |

### Di chuyển tài liệu giữa folder/danh mục

- Hệ thống dùng `categories.parent_id` như cây folder/danh mục, không tạo entity `folders` riêng.
- Move document là cập nhật `documents.category_id`, nhưng phải có API/action riêng để ghi audit rõ category cũ/mới.
- Khi move thành công, hệ thống refresh search row metadata category trong PostgreSQL FTS.
- Target category phải tồn tại, active và chưa soft delete.

---

## 9. Dashboard, dữ liệu truy cập và lỗi xử lý

### Dashboard dung lượng

| Metric | Công thức |
| ------ | --------- |
| Active storage | `SUM(documents.file_size)` với `status != DELETED` |
| Trash storage | `SUM(documents.file_size)` với `status = DELETED` |
| Version storage | `SUM(document_versions.file_size)` nếu version lưu object riêng |
| Total storage | Active + Trash + Version |

- Dashboard Admin phải hiển thị **Tổng MB** toàn hệ thống (`totalStorageMb`).
- MB = bytes / 1024 / 1024, làm tròn 2 chữ số.
- Dung lượng lấy từ PostgreSQL metadata, không lấy từ PostgreSQL FTS.

### Dữ liệu truy cập hệ thống

Admin dashboard cần hiển thị dữ liệu truy cập tổng hợp:

| Metric | Nguồn |
| ------ | ----- |
| `totalLogins`, active users | `audit_logs` |
| `viewCount`, `previewCount`, `downloadCount`, `deniedAccessCount` | `access_logs` |
| `searchCount`, top keywords | `search_logs` |
| `accessTrend`, `topUsersByAccess` | Aggregate từ audit/access/search logs |

- Chỉ Admin được xem dữ liệu tổng hợp này.
- Dashboard không trả token/cookie hoặc dữ liệu nhạy cảm không cần thiết.
- IP/User-Agent chỉ dùng ở màn audit chi tiết khi cần điều tra.

### Tài liệu lỗi xử lý

Admin phải xem được danh sách tài liệu `PROCESSING` quá lâu hoặc `EXTRACTION_FAILED` với các thông tin:

| Field | Mô tả |
| ----- | ----- |
| Document/file | Title, fileName, fileType, documentCode |
| Error reason | `errorCode`, `errorMessage`, stage lỗi: upload validation, extraction, OCR, preview conversion hoặc indexing |
| Retry info | `retryCount`, updatedAt, last error time |
| Action | Retry extraction/indexing, xem chi tiết, tải file gốc để kiểm tra nếu có quyền |

---

## 10. Quản lý phiên bản tài liệu

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

## 11. Audit & Access Log

Hệ thống cần ghi nhận các hành động quan trọng để phục vụ dashboard, truy vết và kiểm toán nội bộ.

| Action                  | Actor      | Dữ liệu cần ghi nhận                                         |
| ----------------------- | ---------- | ------------------------------------------------------------ |
| Upload document         | Admin      | userId, documentId, documentCode, fileName, fileType, fileSize, timestamp |
| Update metadata         | Admin      | userId, documentId, changedFields, timestamp                 |
| Delete/Restore/Move/Permanent delete document | Admin | userId, documentId, action, old/new category nếu move, timestamp |
| Preview document        | Admin/User | userId, documentId, timestamp                                |
| Download document       | Admin/User | userId, documentId, timestamp                                |
| Delete/Restore document | Admin      | userId, documentId, action, timestamp                        |
| Preview document        | Admin/User | userId, documentId, timestamp cấp presigned URL preview       |
| Download document       | Admin/User | userId, documentId, timestamp cấp presigned URL download      |
| Search                  | Admin/User | userId, keyword, filters, resultCount, searchTime, timestamp |
| Batch action            | Admin      | batchId, action, total/succeeded/failed, item results, timestamp |
| Processing failure      | System     | documentId, stage, errorCode, errorMessage, retryCount, timestamp |

---

## 12. Yêu cầu phi chức năng

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
| 12  | **Batch Robustness**    | Batch operations phải trả partial success theo từng item, không thất bại toàn bộ vì một item lỗi             |
| 13  | **Retention**           | Tài liệu trong thùng rác tự purge sau 30 ngày; audit logs vẫn được giữ                                       |

### Auth, CSRF & CORS Decisions

- Access token trả về trong response login/refresh và lưu trong memory của frontend, không lưu vào LocalStorage/SessionStorage.
- Khi reload tab, frontend gọi `POST /auth/refresh` để lấy access token mới; nếu refresh thất bại thì redirect về login.
- Refresh token lưu trong HttpOnly Cookie, path giới hạn ở `/api/v1/auth`, thời hạn mặc định 7 ngày.
- Deployment cùng site/domain dùng `SameSite=Strict`, `Secure`, `HttpOnly`; đây là cấu hình production ưu tiên.
- Nếu frontend/backend khác site trong dev hoặc production, phải cấu hình rõ allowed origins, bật credentialed CORS cho origin cụ thể, dùng `SameSite=None; Secure`, và không dùng wildcard origin.
- `POST /auth/refresh` và `POST /auth/logout` phải có CSRF protection nếu cookie refresh token được gửi cross-site. Cơ chế đề xuất là double-submit CSRF token hoặc custom CSRF header do frontend gửi kèm.
- Logout phải revoke refresh token phía server và trả `Set-Cookie` xóa cookie refresh token với cùng `Path`/`SameSite`/`Secure` tương ứng.

### DB/Object Storage/Search Consistency Pattern

- PostgreSQL là source of truth cho metadata, audience, document lifecycle, version hiện hành, extracted content, search vector và object key đang được tham chiếu.
- Object storage chỉ lưu binary/artifact theo object key UUID-based; không dùng object storage làm nguồn sự thật cho quyền hoặc lifecycle.
- `document_search_index` là derived table; dữ liệu search phải có thể rebuild từ PostgreSQL và nội dung đã extract/object storage.
- Upload tạo row `AWAITING_UPLOAD` và object key trong PostgreSQL trước, client PUT binary vào object storage, sau đó `upload-complete` validate object và chuyển `PROCESSING`. Row/object quá TTL được cleanup.
- Extraction/indexing chỉ chạy sau khi PostgreSQL commit thành công bằng after-commit publish RabbitMQ hoặc retry queue.
- Nếu extraction hoặc indexing fail sau khi DB commit, document/version giữ trạng thái `PROCESSING` hoặc chuyển `EXTRACTION_FAILED`; không rollback metadata đã commit.
- Delete/archive/restore/move cập nhật PostgreSQL trước, sau đó đồng bộ PostgreSQL FTS async. Soft delete không xóa object vật lý ngay.
- Object deletion vật lý chạy bằng cleanup job theo retention policy; orphan cleanup xử lý object không còn được PostgreSQL tham chiếu, trash purge xử lý document `DELETED` đã quá `purge_after`.
- Batch reindex nightly dùng để self-heal lệch index; job này đọc PostgreSQL/document content làm nguồn chính và ghi lại PostgreSQL FTS.

---

## 13. Acceptance Criteria

| #   | Tiêu chí nghiệm thu |
| --- | ------------------- |
| 1   | Admin upload được file hợp lệ; backend tự sinh `documentCode`, metadata được lưu, tài liệu chuyển `PROCESSING` và được refresh vào PostgreSQL search index khi xử lý thành công. |
| 2   | Admin batch upload nhiều file; mỗi file hợp lệ tạo document/mã riêng, file lỗi trả lỗi theo item và không rollback file hợp lệ. |
| 3   | User tìm được tài liệu theo title, description, extracted content, tags và mã tài liệu; kết quả search có highlight từ PostgreSQL `ts_headline`. |
| 4   | Kết quả search trả về trong P95 < 500ms với dưới 10k documents. |
| 5   | User không thấy title/snippet/metadata/download URL của tài liệu không có quyền trong search, preview, download hoặc detail. |
| 6   | File sai MIME/extension, vượt 50 MB hoặc thuộc extension bị chặn bị backend từ chối. |
| 7   | Preview PDF hoạt động trực tiếp trên browser; Word/Excel có preview qua bản convert PDF/HTML đã sanitize. |
| 8   | Download trả file gốc với quyền hợp lệ, tăng `download_count` và ghi access log. |
| 9   | Upload version mới không làm mất version cũ; search/preview/download mặc định dùng current version hợp lệ. |
| 10  | Admin xóa một/nhiều tài liệu thì tài liệu vào Thùng rác, có `deletedAt`, `deletedBy`, `purgeAfter`, không xuất hiện trong search/preview/download của User. |
| 11  | Admin restore được tài liệu từ Thùng rác trước hạn purge; hệ thống clear deleted fields và refresh search row nếu cần. |
| 12  | Hệ thống tự purge tài liệu trong Thùng rác sau 30 ngày hoặc khi Admin permanent delete; storage/content/search artifacts được xóa theo policy, audit logs được giữ. |
| 13  | Admin chuyển một/nhiều tài liệu sang danh mục/folder khác; category cũ/mới được audit và PostgreSQL search metadata được refresh search row. |
| 14  | Dashboard MH07 hiển thị tổng dung lượng file toàn hệ thống theo MB, tách active/trash/version nếu cần. |
| 15  | Dashboard MH07 hiển thị dữ liệu truy cập hệ thống: login, active users, unique access users, preview/download/search/denied access. |
| 16  | Admin xem được tài liệu lỗi xử lý kèm lý do lỗi (`errorCode`, `errorMessage`, stage lỗi), retry count và action retry. |
| 17  | Hệ thống ghi audit/access/search logs cho upload, update, delete/restore/move, batch action, preview/download và search. |

---

## 14. Tài liệu liên quan

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
