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
  • Chọn file (max 50MB)
  • Nhập tiêu đề, mô tả
  • Chọn danh mục
  • Gắn tags
  • Nhập mã tài liệu (optional)
  • Chọn ngày hiệu lực (optional)
  • Chọn access level: PUBLIC / DEPARTMENT / RESTRICTED
  • Nếu DEPARTMENT: chọn một hoặc nhiều phòng ban được phép xem
  • Nếu RESTRICTED: chọn owner hoặc danh sách user được chia sẻ trực tiếp
      ↓
[Frontend] — Validate client-side
  • Kiểm tra file type (pdf, doc, docx, xls, xlsx, jpg, png, tiff)
  • Kiểm tra file size (≤ 50MB)
  • Kiểm tra required fields
  • Kiểm tra dữ liệu phân quyền tương ứng access level
      ↓
[DocumentController] — POST /documents (multipart/form-data)
      ↓
[FileUploadHandler] — Server-side validation
  ├── ❌ File type không hợp lệ → 415 Unsupported Media Type
  ├── ❌ File quá lớn → 413 Payload Too Large
  ├── ❌ Thiếu rule phân quyền → 400 Bad Request
  └── ✅ Hợp lệ
        ↓
[MinioStorageService] — Lưu file gốc vào MinIO bucket
  • Tạo UUID object key → tránh trùng lặp
  • Lưu vào bucket `dms-documents` theo key `documents/YYYY/MM/{documentUuid}/versions/{versionUuid}/original.ext`
        ↓
[DocumentService] — Lưu metadata vào MySQL
  • Tạo record trong bảng `documents`
  • Tạo record trong `document_tags` (N:N)
  • Tạo record trong `document_versions` (v1.0)
  • Lưu access_level, department ACL hoặc direct-share ACL
  • Status = "PROCESSING"
        ↓
[ContentExtractorService] — Trích xuất nội dung (Async / Background)
  ├── PDF (Text)       → Apache PDFBox
  ├── DOCX             → Apache POI (XWPF)
  ├── DOC (cũ)         → Apache POI (HWPF)
  ├── XLS/XLSX         → Apache POI
  └── Image/PDF scan   → Tesseract OCR, vẫn preview nếu có quyền
        ↓
  Lưu extracted_content vào bảng `document_contents`
        ↓
[SearchIndexService] — Đánh index nội dung + metadata vào Elasticsearch
  • title, description, extracted_content, document_code, tags
  • category, department, file_type, owner/uploader, status, access_level
        ↓
Cập nhật status = "INDEXED" (hoặc "EXTRACTION_FAILED" nếu lỗi xử lý/index)
        ↓
Response ApiResponse<DocumentUploadResult> → {
  success: true,
  data: { documentId: 42, status: "PROCESSING" },
  message: null,
  errors: null
}
```

### Sơ đồ trạng thái tài liệu

```text
  [PROCESSING] ──── Trích xuất/index thành công ────→ [INDEXED]
       │
       └──── Trích xuất/index thất bại ────→ [EXTRACTION_FAILED]
                                                  │
                                      Auto retry mỗi 30 phút
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

- Tài liệu ảnh/PDF scan dùng OCR; nếu OCR thất bại nhưng metadata index thành công thì Admin có thể retry xử lý thủ công.
- Auto retry áp dụng cho lỗi trích xuất hoặc lỗi index tạm thời; Admin vẫn có thể retry thủ công từ màn hình quản trị tài liệu lỗi.

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
[Elasticsearch] — Execute query
  • Multi-match query trên title, description, extracted_content, tags
  • Exact match / boosted match cho document_code
  • Fuzzy matching (tolerance for typos)
  • Faceted aggregations
  • Highlighted snippets
  • Status filter mặc định: INDEXED
  • Permission filters theo quyền truy cập tài liệu trước khi trả kết quả
      ↓
[SearchService] — Post-processing
  • Chuẩn hóa Elasticsearch highlight (<em>) cho title/description/extracted_content
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
  ├── Lấy metadata từ MySQL
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
Re-index các tài liệu bị ảnh hưởng nếu metadata search/filter thay đổi
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
  ├── Lưu file mới vào MinIO bucket
  ├── Tạo record mới trong document_versions
  ├── Cập nhật current_version trong documents
  ├── Status = PROCESSING
  ├── Trích xuất nội dung mới
  ├── Re-index Elasticsearch theo version hiện hành
  ├── Cập nhật status = INDEXED hoặc EXTRACTION_FAILED
  └── File cũ được giữ lại trong lịch sử

─── Restore phiên bản cũ ──────────────────────
Admin chọn version cũ làm version hiện hành
      ↓
[DocumentController] — POST /documents/{id}/versions/{versionId}/restore
      ↓
[DocumentService]
  ├── Cập nhật current_version trong documents
  ├── Status = PROCESSING
  ├── Trích xuất lại nội dung nếu cần
  └── Re-index Elasticsearch theo version được restore
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
  ├── Cập nhật metadata trong MySQL
  ├── Ghi audit_log action = Update metadata, changedFields
  └── Re-index Elasticsearch nếu field search/filter/permission thay đổi

─── Archive ───────────────────────────────────
Admin click "Archive"
      ↓
[DocumentController] — POST /documents/{id}/archive
      ↓
[DocumentService]
  ├── Set status = ARCHIVED
  ├── Ghi audit_log action = Archive document
  └── Re-index hoặc remove khỏi default search index view

─── Soft delete ───────────────────────────────
Admin click "Xóa"
      ↓
[DocumentController] — DELETE /documents/{id}
      ↓
[DocumentService]
  ├── Set status = DELETED
  ├── Không xóa file vật lý ngay lập tức
  ├── Ghi audit_log action = Delete document
  └── Remove/deactivate document khỏi Elasticsearch search mặc định

─── Restore ───────────────────────────────────
Admin click "Restore"
      ↓
[DocumentController] — POST /documents/{id}/restore
      ↓
[DocumentService]
  ├── Set status = PROCESSING hoặc INDEXED tùy trạng thái nội dung/index
  ├── Ghi audit_log action = Restore document
  └── Re-index Elasticsearch nếu tài liệu được khôi phục về trạng thái hiển thị
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

| # | Luồng | Tần suất |
|---|-------|----------|
| 1 | Đăng nhập | Hàng ngày |
| 2 | Upload tài liệu mới | Thường xuyên |
| 3 | Cập nhật metadata tài liệu | Thỉnh thoảng |
| 4 | Upload/restore phiên bản | Thỉnh thoảng |
| 5 | Archive/soft delete/restore tài liệu | Thỉnh thoảng |
| 6 | Quản lý danh mục/phòng ban/tags | Ít khi |
| 7 | Quản lý user | Ít khi |
| 8 | Xem dashboard thống kê | Hàng ngày |
| 9 | Xem audit log | Khi cần truy vết |

### User Flows

| # | Luồng | Tần suất |
|---|-------|----------|
| 1 | Đăng nhập | Hàng ngày |
| 2 | Tìm kiếm tài liệu | Rất thường xuyên |
| 3 | Xem chi tiết tài liệu | Thường xuyên |
| 4 | Preview tài liệu | Thường xuyên |
| 5 | Download tài liệu | Thường xuyên |
| 6 | Xem/sửa profile cá nhân | Ít khi |
