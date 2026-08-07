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
[Màn hình Upload] — Điền form:
  • Chọn một hoặc nhiều file (mỗi file max 50MB)
  • Nhập tiêu đề, mô tả
  • Chọn danh mục
  • Gắn tags
  • Chọn ngày hiệu lực (optional)
      ↓
[Frontend] — Validate client-side
  • Kiểm tra file type (pdf, doc, docx, xls, xlsx, jpg, png, tiff)
  • Kiểm tra file size (≤ 50MB)
  • Kiểm tra required fields
      ↓
[DocumentController] — POST /documents/upload-init hoặc /documents/batch-upload-init
      ↓
[FileUploadHandler] — Server-side validation + category permission
  ├── ❌ Không có `UPLOAD` trên danh mục → 403 Forbidden
  ├── ❌ File type không hợp lệ → 415 Unsupported Media Type
  ├── ❌ File quá lớn → 413 Payload Too Large
  └── ✅ Hợp lệ
        ↓
[DocumentService] — Tạo metadata PostgreSQL
  • Sinh UUID object key, client không được chọn storage path
  • Tạo documents + document_versions + document_tags rows
  • Quyền truy cập tài liệu ăn theo category, không tạo ACL riêng cho tài liệu
  • Status = "AWAITING_UPLOAD"
  • upload_expires_at = now + 5 phút
        ↓
[DocumentService] — Lưu metadata vào PostgreSQL
  • Sinh `document_code` tự động, ví dụ DMS-202607-000001
  • Tạo record trong bảng `documents`
  • Tạo record trong `document_tags` (N:N)
  • Tạo record trong `document_versions` (v1.0)
  • Status = "AWAITING_UPLOAD"
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
Response ApiResponse<DocumentUploadResult> hoặc BatchUploadResult → {
  success: true,
  message: "Document upload accepted",
  data: {
    id: 42,
    status: "PROCESSING",
    documentCode: "DMS-202607-000001",
    versionId: 101,
    versionNumber: "1.0",
    createdAt: "2026-07-21T10:30:00"
  },
  errors: null
}

Frontend cần metadata/detail đầy đủ thì gọi `GET /documents/{id}` sau upload. Các field phụ thuộc xử lý async như preview artifact, extracted content và searchable chỉ sẵn sàng sau khi tài liệu chuyển `INDEXED`.
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
      └──── Admin soft delete ────→ [DELETED / TRASH]
                                       │
                    Admin restore trước purge_after → [PROCESSING] hoặc [INDEXED]
                                       │
                    Sau 30 ngày / permanent delete → [PURGED]
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
  • Category permission filter: chỉ trả tài liệu user có `VIEW` trên danh mục
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

- User không có `VIEW` trên danh mục không được nhìn thấy title, snippet, metadata hoặc preview URL của tài liệu.
- Search không trả về tài liệu `DELETED`; `ARCHIVED` không hiển thị mặc định.
- Search, preview và metadata detail dùng category permission `VIEW`; download dùng `DOWNLOAD`.

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
  ├── Kiểm tra category permission `VIEW` trên danh mục của tài liệu
  ├── ❌ Không có `VIEW` / tài liệu không hiển thị → 404/403, không trả metadata/file URL
  └── ✅ Có `VIEW`
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
  ├── Kiểm tra category permission `VIEW` trên danh mục của tài liệu
  ├── ❌ Không có `VIEW` / tài liệu không hiển thị → 404/403
  └── ✅ Có `VIEW`
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
  ├── Kiểm tra category permission `DOWNLOAD` trên danh mục của tài liệu
  ├── ❌ Không có `DOWNLOAD` / tài liệu không hiển thị → 404/403
  └── ✅ Có `DOWNLOAD`
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

## Flow 5: Quản lý dữ liệu danh mục & phân quyền (Admin)

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

### Cấu hình quyền danh mục

```text
Admin mở Quản lý danh mục
      ↓
Chọn một category
      ↓
Mở tab/section "Phân quyền phòng ban"
      ↓
Thêm hoặc chọn department được cấp quyền trong category
      ↓
Tick quyền:
  • VIEW     — thấy tài liệu trong list/search/detail và preview
  • DOWNLOAD — tải file hoặc version tài liệu
  • UPLOAD   — upload tài liệu hoặc version vào category
  • UPDATE   — sửa metadata, move, cập nhật thông tin version
  • DELETE   — archive, soft delete, restore, permanent delete theo nghiệp vụ
      ↓
[CategoryController] — PUT /categories/{id}/permissions
      ↓
[CategoryPermissionService]
  ├── Validate category active và department active
  ├── Replace permission matrix của category
  ├── Ghi audit_log action = Update category permissions
  └── Invalidate permission cache nếu có
      ↓
Search/list/detail/download/upload/update/delete dùng quyền mới ngay ở request tiếp theo
```

Business rules:

- Một category có thể cấp quyền cho nhiều phòng ban.
- Một phòng ban có thể có nhiều quyền trong cùng category.
- User thuộc nhiều phòng ban được gộp quyền theo union.
- Không cấu hình quyền ở từng tài liệu; tài liệu ăn quyền từ category hiện tại.
- Khi category permission thay đổi, không cần refresh search vector vì query luôn JOIN quyền hiện tại.
- Future extension: có thể thêm quyền riêng user trong phạm vi category/phòng ban mà không thay đổi luồng chính.

---

## Flow 6: Quản lý phiên bản tài liệu (Admin)

```text
Admin mở chi tiết tài liệu → Tab "Lịch sử phiên bản"
      ↓
[DocumentController] — GET /documents/{id}/versions
      ↓
[DocumentService] — Kiểm tra category permission `VIEW`
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
  ├── Kiểm tra category permission `UPLOAD` trên danh mục hiện tại
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
  ├── Kiểm tra category permission `UPDATE` trên danh mục hiện tại
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
Admin sửa title / description / category / tags
      ↓
[DocumentController] — PUT /documents/{id}
      ↓
[DocumentService]
  ├── Kiểm tra category permission `UPDATE` trên danh mục hiện tại
  ├── Nếu đổi category: kiểm tra `UPDATE` trên category nguồn và `UPLOAD` hoặc `UPDATE` trên category đích
  ├── Cập nhật metadata trong PostgreSQL
  ├── Ghi audit_log action = Update metadata, changedFields
  └── Refresh PostgreSQL search vector nếu field search/filter thay đổi

─── Archive ───────────────────────────────────
Admin click "Archive"
      ↓
[DocumentController] — POST /documents/{id}/archive
      ↓
[DocumentService]
  ├── Kiểm tra category permission `DELETE` trên danh mục hiện tại
  ├── Set status = ARCHIVED
  ├── Ghi audit_log action = Archive document
  └── Cập nhật status/search row để loại khỏi default search view

─── Soft delete ───────────────────────────────
Admin click "Xóa"
      ↓
[DocumentController] — DELETE /documents/{id}
      ↓
[DocumentService]
  ├── Kiểm tra category permission `DELETE` trên danh mục hiện tại
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
  ├── Kiểm tra category permission `DELETE` trên danh mục hiện tại
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
  ├── Gán một hoặc nhiều phòng ban cho user
  ├── Hash mật khẩu bằng BCrypt khi tạo hoặc reset mật khẩu
  └── Ghi audit_log cho thao tác quản trị user
      ↓
Nếu role hoặc danh sách phòng ban thay đổi
      ↓
Quyền search/detail/preview/download/upload/update/delete thay đổi ngay theo category permission hiện tại
```

---

## Flow 9: User profile, tài liệu của tôi và lịch sử cá nhân (User)

```text
User mở menu cá nhân
      ↓
[Profile / My Documents / My Activity]
      ↓
[UserController] — GET /users/me
[DocumentController] — GET /users/me/documents?type=uploaded|updated|downloaded
[DocumentController] — GET /users/me/versions
[AuditLogController] — GET /users/me/activity
      ↓
[UserService / DocumentService / AuditLogService]
  ├── Trả thông tin user và danh sách phòng ban hiện tại
  ├── Trả tài liệu user đã upload hoặc đã thao tác, vẫn áp category permission hiện tại
  ├── Trả version do user upload hoặc version thuộc tài liệu user có quyền xem
  ├── Trả lịch sử thao tác của chính user: search, preview, download, upload, update, delete attempt
  └── Không trả log/token/dữ liệu nhạy cảm của user khác
      ↓
Frontend hiển thị dashboard cá nhân, bảng tài liệu, bảng version và timeline hoạt động
```

Business rules:

- User chỉ xem được activity của chính mình.
- Danh sách tài liệu/version cá nhân vẫn phải áp quyền category hiện tại; nếu user mất quyền `VIEW`, tài liệu không còn hiển thị trong màn cá nhân.
- Lịch sử cá nhân có thể hiển thị action bị từ chối của chính user với `denialReason`, nhưng không lộ metadata tài liệu mà user không có `VIEW`.

---

## Flow 10: Dashboard thống kê & Audit Log (Admin)

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

Admin mở Audit Log / Audit Actions
      ↓
[AuditLogController] — GET /audit-logs?filters
[AuditLogController] — GET /audit-actions?actorId&targetType&action&dateRange
      ↓
[AuditLogService]
  ├── Upload document
  ├── Update metadata / move / version restore
  ├── Delete/Restore/Archive/Permanent delete document
  ├── Preview / Download / denied access
  ├── Search keyword
  ├── User management và user-department membership changes
  ├── Category permission changes
  └── System processing/retry/purge actions
      ↓
Response ApiResponse<AuditLogPage> hoặc ApiResponse<AuditActionPage>
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

---

## Flow 11: Xóa vào Thùng rác và tự purge sau 30 ngày (Admin/System)

```text
Admin chọn một hoặc nhiều tài liệu trong MH08
      ↓
[Frontend] — Confirm delete
      ↓
[DocumentController] — DELETE /documents/{id} hoặc POST /documents/batch-delete
      ↓
[DocumentLifecycleService]
  • Kiểm tra category permission `DELETE` trên từng tài liệu
  • Lưu previous_status
  • Set status = DELETED
  • Set deleted_at = now()
  • Set deleted_by = current_user
  • Set purge_after = now() + 30 ngày
      ↓
[SearchIndexService] — Loại khỏi search mặc định
      ↓
[Màn hình Thùng rác MH19] — Hiển thị deletedAt, purgeAfter, daysUntilPurge
      ↓
Admin có thể restore trước hạn
  ├── POST /documents/trash/restore → clear deleted fields, restore status/re-index nếu cần
  └── DELETE /documents/trash/permanent-delete → xóa vĩnh viễn ngay
      ↓
[Scheduler purgeDeletedDocuments] — Chạy hằng ngày
  • Tìm status = DELETED AND purge_after <= now()
  • Xóa object storage current file + version files theo retention policy
  • Xóa document_contents và PostgreSQL search row
  • Hard delete row hoặc giữ tombstone permanently_deleted_at theo policy
  • Ghi audit/maintenance log
```

Business rules:

- Soft delete không xóa file vật lý ngay để còn restore.
- Tài liệu trong Thùng rác không được search/preview/download theo luồng User.
- Purge job phải idempotent; lỗi xóa storage được log và retry ở lần chạy sau.

---

## Flow 12: Chuyển tài liệu giữa folder/danh mục (Admin)

```text
Admin chọn một hoặc nhiều tài liệu trong MH08
      ↓
[MoveDocumentModal] — Chọn target category/folder từ category tree
      ↓
[DocumentController] — POST /documents/{id}/move hoặc POST /documents/batch-move
      ↓
[DocumentService]
  • Validate target category tồn tại, active, chưa soft delete
  • Kiểm tra `UPDATE` trên category nguồn
  • Kiểm tra `UPLOAD` hoặc `UPDATE` trên target category
  • Lưu category cũ để audit
  • Cập nhật documents.category_id
      ↓
[SearchIndexService] — Re-index metadata category/folder
      ↓
[AuditLogService] — Ghi old/new category
      ↓
[Frontend] — Refresh list và hiển thị kết quả partial success nếu batch
```

Business rules:

- Category hiện có được dùng như folder; không tạo bảng `folders` riêng.
- Batch move cho phép partial success để tài liệu lỗi không chặn các tài liệu hợp lệ.

---

## Flow 13: Thống kê tổng dung lượng tài liệu (Admin)

```text
Admin mở Dashboard MH07
      ↓
[DashboardController] — GET /admin/dashboard/storage
      ↓
[DocumentStorageStatsService]
  • activeStorageBytes = SUM(documents.file_size) WHERE status != DELETED
  • trashStorageBytes = SUM(documents.file_size) WHERE status = DELETED
  • versionStorageBytes = SUM(document_versions.file_size)
  • totalStorageBytes = active + trash + version
      ↓
[Frontend] — Hiển thị MB đã làm tròn 2 chữ số
```

Business rules:

- Dashboard hiển thị tách active/trash/version để tránh hiểu nhầm tổng dung lượng.
- Số liệu dung lượng lấy từ PostgreSQL, không lấy từ PostgreSQL FTS.


---

## Flow 14: Dashboard dữ liệu truy cập hệ thống (Admin)

```text
Admin mở Dashboard MH07 hoặc Analytics MH18
      ↓
[DashboardController] — GET /admin/dashboard/system-access?dateFrom&dateTo&granularity
      ↓
[DashboardService]
  • Đếm login/logout từ audit_logs
  • Đếm view/preview/download/version download/denied access từ access_logs
  • Đếm search/suggestion từ search_logs
  • Tính activeUsers, uniqueAccessUsers, topUsersByAccess
  • Group trend theo day/week/month
      ↓
[Frontend]
  • Hiển thị stat cards: totalLogins, activeUsers, uniqueAccessUsers
  • Hiển thị chart preview/download/search theo thời gian
  • Hiển thị bảng top users by access
```

Business rules:

- Dashboard chỉ hiển thị aggregate cho Admin.
- Dữ liệu nhạy cảm như token/cookie không bao giờ được log hoặc trả về dashboard.
- IP/User-Agent nếu cần điều tra chi tiết thì xem ở MH16 Audit & Access Log, không đưa vào card tổng quan.
