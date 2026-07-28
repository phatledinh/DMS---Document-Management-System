# Luồng Nghiệp Vụ Chính — DMS

> Mô tả các luồng nghiệp vụ chính (business mainflows) của hệ thống Quản lý Tài liệu Nội bộ.

---

## Tổng quan luồng nghiệp vụ

```text
┌─────────────────────────────────────────────────────────────────────┐
│                        HỆ THỐNG DMS                                │
│                                                                     │
│   [Admin Upload] ──→ [Xử lý & Index] ──→ [Kho tài liệu]          │
│                                                │                    │
│                                    [User Tìm kiếm] ──→ [Kết quả]  │
│                                                │                    │
│                                    [Preview / Download]             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Flow 1: Đăng nhập & Xác thực

```text
User/Admin mở ứng dụng
      ↓
[Màn hình Login] — Nhập email + password
      ↓
[AuthController] — POST /auth/login
      ↓
[AuthService] — Verify credentials (BCrypt)
      ├── ❌ Sai → Trả lỗi INVALID_CREDENTIALS
      └── ✅ Đúng
            ↓
      Issue JWT Access Token (15 phút)
      + Set Refresh Token vào HttpOnly Cookie (7 ngày)
            ↓
      Redirect → Dashboard (Admin) / Trang tìm kiếm (User)
```

### Refresh Token Flow

```text
Access Token hết hạn (401 Unauthorized)
      ↓
[Frontend Interceptor] — Tự động gọi POST /auth/refresh
      ↓
[AuthService] — Đọc Refresh Token từ Cookie
      ├── ❌ Hết hạn / Revoked → Redirect Login
      └── ✅ Hợp lệ → Cấp Access Token mới
            ↓
      Retry request gốc với token mới
```

---

## Flow 2: Upload & Xử lý tài liệu (Admin)

Đây là flow chính của hệ thống, mô tả quá trình Admin upload tài liệu và hệ thống tự động xử lý.

```text
Admin chọn "Upload tài liệu"
      ↓
[Màn hình Upload] — Điền form metadata, ACL và chọn file max 50MB
      ↓
[Frontend] — Validate client-side file type, size, required fields, ACL rules
      ↓
[DocumentController] — POST /documents/upload-init
      ↓
[DocumentUploadUseCase] — Validate metadata + file khai báo
  ├── ❌ File type/size/ACL không hợp lệ → 400/413/415
  └── ✅ Hợp lệ
        ↓
[DocumentService] — Tạo metadata PostgreSQL
  • Sinh UUID object key, client không được chọn storage path
  • Tạo documents + document_versions + ACL/tag rows
  • Status = "AWAITING_UPLOAD"
  • upload_expires_at = now + 5 phút
        ↓
[S3StorageService] — Ký presigned PUT URL cho đúng object key/content-type/content-length
        ↓
Response → { documentId, status: "AWAITING_UPLOAD", uploadUrl, requiredHeaders, expiresIn: 300 }
        ↓
[Frontend] — PUT file trực tiếp lên MinIO/R2 bằng uploadUrl
        ↓
[DocumentController] — POST /documents/{id}/upload-complete
        ↓
[UploadCompleteUseCase]
  • HEAD object: tồn tại + đúng size
  • Đọc object để Apache Tika detect MIME thực tế
  • Validate extension/MIME/dangerous type
  ├── ❌ Fail → xóa object nếu cần, trả UPLOAD_* / MIME_TYPE_MISMATCH
  └── ✅ Pass
        ↓
[DocumentService] — Chuyển status = "PROCESSING", commit PostgreSQL
        ↓
[After Commit] — Publish RabbitMQ message {type: EXTRACT} vào dms.extract
        ↓
[Worker] — Consume dms.extract / dms.ocr / dms.preview / dms.index
  • Extract text bằng PDFBox/POI hoặc OCR bằng Tesseract
  • Generate preview artifact PDF/HTML cho Office nếu cần
  • Refresh document_search_index trong PostgreSQL
        ↓
Cập nhật status = "INDEXED" hoặc "EXTRACTION_FAILED"
```


### Sơ đồ trạng thái tài liệu

```text
  [AWAITING_UPLOAD] ──── upload-complete hợp lệ ────→ [PROCESSING]
       │                                                    │
       └──── quá TTL / cleanup ────→ [cleanup/delete]       │
                                                            │
  [PROCESSING] ──── Trích xuất/index thành công ────→ [INDEXED]
       │
       └──── Trích xuất/refresh search thất bại ────→ [EXTRACTION_FAILED]
                                                  │
                                      RabbitMQ retry 30s → 5m → 30m
                                                  │
                          ┌──────── Thành công ───┴───→ [INDEXED]
                          │
                          └──────── Thất bại ─────────→ [EXTRACTION_FAILED]

  [INDEXED] ──── Admin archive ────→ [ARCHIVED]
      │                                │
      └──── Admin soft delete ────→ [DELETED]
                                       │
                             Admin restore → [PROCESSING] hoặc [INDEXED]
```

Business rules:

- Với tài liệu ảnh hoặc PDF scan, hệ thống dùng OCR để trích xuất text phục vụ full-text search.
- Nếu OCR thất bại nhưng metadata đã lưu thành công, tài liệu chuyển `EXTRACTION_FAILED`; Admin có thể xem trong màn hình tài liệu lỗi và retry xử lý. Tài liệu chưa xuất hiện trong search/preview/download cho User cho đến khi extraction/search refresh thành công.
- Hệ thống tự retry qua RabbitMQ delay queues với các lỗi tạm thời như OCR timeout, lỗi kết nối PostgreSQL FTS hoặc PostgreSQL FTS quá tải; vượt 3 lần thì vào DLQ và chuyển `EXTRACTION_FAILED`.
- Admin có thể retry thủ công từ màn hình quản trị tài liệu lỗi, đặc biệt khi cần xử lý ngay hoặc khi auto retry đã vượt số lần tối đa.

---

## Flow 3: Tìm kiếm tài liệu (User)

Đây là **core feature** của hệ thống — cho phép User tìm kiếm tài liệu theo từ khóa và bộ lọc.

```text
User mở trang tìm kiếm
      ↓
[Màn hình Search] — Nhập:
  • Từ khóa tìm kiếm (bắt buộc)
  • Bộ lọc: Danh mục, Phòng ban, Loại file, Tags, Khoảng thời gian
  • Sắp xếp: Độ liên quan, Ngày tạo, Lượt xem, Lượt tải
      ↓
[SearchController] — GET /documents/search?q=...&filters
      ↓
[SearchService] — Xây dựng search query
      ↓
[PostgreSQL FTS] — Execute PostgreSQL FTS query
  • Multi-match query trên title, description, extracted_content, tags
  • Exact match / boosted match cho document_code
  • Fuzzy matching (tolerance for typos)
  • Faceted aggregations
  • Highlighted snippets
  • Status filter mặc định: INDEXED
  • Permission filters theo quyền truy cập tài liệu trước khi trả kết quả
      ↓
[SearchService] — Post-processing
  • Chuẩn hóa PostgreSQL ts_headline highlight (<em>) cho title/description/extracted_content
  • Tính toán relevance score
  • Đếm search time (ms)
  • Ghi search log: userId, keyword, filters, resultCount, searchTime, timestamp
      ↓
Response ApiResponse<SearchResultPage> → {
  success: true,
  data: {
    results: [...],
    totalHits: 12,
    highlights: [...],
    searchTime: 45,
    facets: {...}
  },
  message: null,
  errors: null
}
      ↓
[Frontend] — Hiển thị kết quả
  • Tiêu đề tài liệu (với highlight)
  • Snippet nội dung match (với highlight)
  • Metadata: category, file_type, date, views, downloads
  • Pagination
```

Business rules:

- User không có quyền không được nhìn thấy title, snippet, metadata hoặc download URL của tài liệu.
- Search không trả về tài liệu `DELETED`; `ARCHIVED` không hiển thị mặc định.
- Search, preview, download và metadata detail dùng cùng một logic phân quyền.

---

## Flow 4: Xem & Tải tài liệu (User)

```text
User click vào tài liệu từ kết quả tìm kiếm
      ↓
[DocumentController] — GET /documents/{id}
      ↓
[DocumentService]
  ├── Lấy metadata từ PostgreSQL
  ├── Kiểm tra status = INDEXED
  ├── Kiểm tra quyền truy cập theo access_level
  │     ├── PUBLIC     → mọi user đã đăng nhập
  │     ├── DEPARTMENT → user thuộc phòng ban được gán hoặc Admin
  │     └── RESTRICTED → owner, Admin hoặc user được chia sẻ trực tiếp
  ├── ❌ Không có quyền / tài liệu không hiển thị → 404/403, không trả metadata/file URL
  └── ✅ Có quyền
        ↓
  Tăng view_count (+1)
        ↓
  Ghi access_log action = Preview metadata/detail
        ↓
[Màn hình Chi tiết Tài liệu]
  • Hiển thị metadata: tiêu đề, mô tả, mã tài liệu, phiên bản
  • Hiển thị tags, danh mục, phòng ban
  • Nút "Preview" + Nút "Download"
  • Lịch sử phiên bản

─── Preview ───────────────────────────────────
User click "Preview"
      ↓
[PreviewController] — GET /documents/{id}/preview
      ↓
[PreviewService]
  ├── Kiểm tra status = INDEXED
  ├── Kiểm tra quyền truy cập theo access_level
  ├── ❌ Không có quyền / tài liệu không hiển thị → 404/403
  └── ✅ Có quyền
        ↓
  ├── PDF      → Trả stream PDF trực tiếp (browser render)
  ├── DOCX/DOC → Convert sang PDF → trả stream
  ├── XLS/XLSX → Convert sang PDF hoặc HTML table đã sanitize
  └── Image    → Trả stream trực tiếp
        ↓
  Ghi access_log action = Preview document
        ↓
Browser hiển thị PDF Viewer / HTML Preview / Image Viewer

─── Download ──────────────────────────────────
User click "Download"
      ↓
[DownloadController] — GET /documents/{id}/download
      ↓
[DocumentService]
  ├── Kiểm tra status = INDEXED
  ├── Kiểm tra quyền truy cập theo access_level
  ├── ❌ Không có quyền / tài liệu không hiển thị → 404/403
  └── ✅ Có quyền
        ↓
  Tăng download_count (+1)
        ↓
  Ghi access_log action = Download document
        ↓
  Trả file gốc (Content-Disposition: attachment)
      ↓
Browser tải file về máy
```

---

## Flow 5: Quản lý dữ liệu danh mục (Admin)

```text
Admin → Quản lý Master Data
      ↓
┌──────────────────────────────────────────────────────┐
│              CRUD Operations (Admin Only)             │
├──────────────┬──────────────┬────────────────────────┤
│  Categories  │  Departments │       Tags             │
│  (Cây phân   │  (Phòng ban) │    (Nhãn gắn)         │
│   cấp)       │              │                        │
├──────────────┼──────────────┼────────────────────────┤
│ • Tạo mới    │ • Tạo mới    │ • Tạo mới             │
│ • Sửa        │ • Sửa        │ • Sửa                 │
│ • Xóa (soft) │ • Xóa (soft) │ • Xóa (soft)          │
│ • Sắp xếp    │              │                        │
│ • Phân cấp   │              │                        │
│   (parent/   │              │                        │
│    child)    │              │                        │
└──────────────┴──────────────┴────────────────────────┘
      ↓
Cache Invalidation (@CacheEvict)
  → Xóa cache categories:tree / departments:all / tags:popular
      ↓
Refresh search row/vector cho các tài liệu bị ảnh hưởng nếu metadata search/filter thay đổi
```

---

## Flow 6: Quản lý phiên bản tài liệu (Admin)

```text
Admin mở chi tiết tài liệu → Tab "Lịch sử phiên bản"
      ↓
[DocumentController] — GET /documents/{id}/versions
      ↓
Hiển thị danh sách phiên bản:
  • v1.0 — Phiên bản đầu tiên (2026-01-15)
  • v1.1 — Bổ sung phụ lục B (2026-05-10)
  • v1.2 — Cập nhật quy trình (2026-07-20)

─── Upload phiên bản mới ──────────────────────
Admin click "Upload phiên bản mới"
      ↓
[Form Upload Version]
  • Chọn file mới
  • Nhập số phiên bản (e.g. "1.3")
  • Nhập changelog
      ↓
[DocumentController] — POST /documents/{id}/versions
      ↓
[DocumentService]
  ├── Lưu file mới vào object storage qua S3-compatible API
  ├── Tạo record mới trong document_versions với status = PROCESSING
  ├── Giữ current_version hiện tại để User vẫn search/preview/download version cũ
  ├── Trích xuất nội dung mới và tạo preview artifact cần thiết
  ├── Refresh PostgreSQL search vector theo version mới sau khi xử lý thành công
  ├── Nếu thành công: cập nhật current_version trong documents sang version mới và status = INDEXED
  ├── Nếu thất bại: version mới = EXTRACTION_FAILED, current_version không đổi
  └── File cũ được giữ lại trong lịch sử

─── Restore phiên bản cũ ──────────────────────
Admin chọn version cũ làm version hiện hành
      ↓
[DocumentController] — POST /documents/{id}/versions/{versionId}/restore
      ↓
[DocumentService]
  ├── Validate version cũ còn file/content hợp lệ và chưa bị xóa mềm
  ├── Refresh PostgreSQL search vector theo version được restore
  ├── Nếu refresh search vector thành công: cập nhật current_version trong documents
  └── Nếu refresh search vector thất bại: current_version không đổi và ghi retry task
```

---

## Flow 7: Quản lý lifecycle tài liệu (Admin)

```text
Admin mở chi tiết tài liệu
      ↓
[Màn hình Quản lý Tài liệu]
  • Cập nhật metadata
  • Archive
  • Soft delete
  • Restore

─── Cập nhật metadata ─────────────────────────
Admin sửa title / description / category / departments / tags / access level
      ↓
[DocumentController] — PUT /documents/{id}
      ↓
[DocumentService]
  ├── Validate dữ liệu phân quyền theo access level
  ├── Cập nhật metadata trong PostgreSQL
  ├── Ghi audit_log action = Update metadata, changedFields
  └── Refresh PostgreSQL search vector nếu field search/filter/permission thay đổi

─── Archive ───────────────────────────────────
Admin click "Archive"
      ↓
[DocumentController] — POST /documents/{id}/archive
      ↓
[DocumentService]
  ├── Set status = ARCHIVED
  ├── Ghi audit_log action = Archive document
  └── Cập nhật status/search row để loại khỏi default search view

─── Soft delete ───────────────────────────────
Admin click "Xóa"
      ↓
[DocumentController] — DELETE /documents/{id}
      ↓
[DocumentService]
  ├── Set status = DELETED
  ├── Không xóa file vật lý ngay lập tức
  ├── Ghi audit_log action = Delete document
  └── Remove/deactivate document khỏi PostgreSQL FTS search mặc định

─── Restore ───────────────────────────────────
Admin click "Restore"
      ↓
[DocumentController] — POST /documents/{id}/restore
      ↓
[DocumentService]
  ├── Set status = PROCESSING hoặc INDEXED tùy trạng thái nội dung/index
  ├── Ghi audit_log action = Restore document
  └── Refresh PostgreSQL search vector nếu tài liệu được khôi phục về trạng thái hiển thị
```

---

## Flow 8: Quản lý người dùng (Admin)

```text
Admin mở màn hình Quản lý User
      ↓
[UserController]
  • GET /users
  • POST /users
  • PUT /users/{id}
  • DELETE /users/{id} hoặc POST /users/{id}/deactivate
      ↓
[UserService]
  ├── Tạo/sửa/khóa user
  ├── Gán role ADMIN / USER
  ├── Gán department cho user
  ├── Hash mật khẩu bằng BCrypt khi tạo hoặc reset mật khẩu
  └── Ghi audit_log cho thao tác quản trị user
      ↓
Nếu role/department thay đổi
      ↓
Quyền search/metadata detail/preview/download thay đổi theo access_level của tài liệu
```

---

## Flow 9: Dashboard thống kê & Audit Log (Admin)

```text
Admin mở Dashboard
      ↓
[DashboardController] — GET /dashboard/summary
      ↓
[DashboardService]
  ├── Tổng số tài liệu theo status/category/department/file_type
  ├── Tổng lượt xem và lượt tải
  ├── Top tài liệu được preview/download nhiều
  ├── Top keyword tìm kiếm
  └── Thống kê searchTime/resultCount theo search log
      ↓
Response ApiResponse<DashboardSummary>
      ↓
[Màn hình Dashboard]
  • Stat cards
  • Bảng tài liệu phổ biến
  • Bảng từ khóa tìm kiếm phổ biến
  • Bộ lọc thời gian

Admin mở Audit Log
      ↓
[AuditLogController] — GET /audit-logs?filters
      ↓
[AuditLogService]
  ├── Upload document
  ├── Update metadata
  ├── Delete/Restore/Archive document
  ├── Preview document
  ├── Download document
  ├── Search keyword
  └── User management actions
      ↓
Response ApiResponse<AuditLogPage>
```

---

## Tổng hợp luồng theo Actor

### Admin Flows

| #   | Luồng                                | Tần suất         |
| --- | ------------------------------------ | ---------------- |
| 1   | Đăng nhập                            | Hàng ngày        |
| 2   | Upload tài liệu mới                  | Thường xuyên     |
| 3   | Cập nhật metadata tài liệu           | Thỉnh thoảng     |
| 4   | Upload/restore phiên bản             | Thỉnh thoảng     |
| 5   | Archive/soft delete/restore tài liệu | Thỉnh thoảng     |
| 6   | Quản lý danh mục/phòng ban/tags      | Ít khi           |
| 7   | Quản lý user                         | Ít khi           |
| 8   | Xem dashboard thống kê               | Hàng ngày        |
| 9   | Xem audit log                        | Khi cần truy vết |

### User Flows

| #   | Luồng                   | Tần suất         |
| --- | ----------------------- | ---------------- |
| 1   | Đăng nhập               | Hàng ngày        |
| 2   | Tìm kiếm tài liệu       | Rất thường xuyên |
| 3   | Xem chi tiết tài liệu   | Thường xuyên     |
| 4   | Preview tài liệu        | Thường xuyên     |
| 5   | Download tài liệu       | Thường xuyên     |
| 6   | Xem/sửa profile cá nhân | Ít khi           |
