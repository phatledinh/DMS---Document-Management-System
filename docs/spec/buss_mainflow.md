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
  • Chọn danh mục, phòng ban
  • Gắn tags
  • Nhập mã tài liệu (optional)
  • Chọn ngày hiệu lực (optional)
      ↓
[Frontend] — Validate client-side
  • Kiểm tra file type (pdf, doc, docx, xls, xlsx, jpg, png, tiff)
  • Kiểm tra file size (≤ 50MB)
  • Kiểm tra required fields
      ↓
[DocumentController] — POST /documents (multipart/form-data)
      ↓
[FileUploadHandler] — Server-side validation
  ├── ❌ File type không hợp lệ → 415 Unsupported Media Type
  ├── ❌ File quá lớn → 413 Payload Too Large
  └── ✅ Hợp lệ
        ↓
[StorageService] — Lưu file gốc vào File Storage
  • Tạo UUID filename → tránh trùng lặp
  • Lưu vào /storage/documents/YYYY/MM/{uuid}_original.ext
        ↓
[DocumentService] — Lưu metadata vào MySQL
  • Tạo record trong bảng `documents`
  • Tạo record trong `document_tags` (N:N)
  • Tạo record trong `document_versions` (v1.0)
  • Status = "PROCESSING"
        ↓
[ContentExtractorService] — Trích xuất nội dung (Async / Background)
  ├── PDF (Text)  → Apache PDFBox
  ├── DOCX        → Apache POI (XWPF)
  ├── DOC (cũ)    → Apache POI (HWPF)
  ├── XLS/XLSX    → Apache POI
  └── Image/Scan  → Tesseract OCR (Phase 2 — skip)
        ↓
  Lưu extracted_text vào bảng `document_contents`
        ↓
[SearchIndexService] — Đánh index nội dung + metadata vào Elasticsearch
        ↓
Cập nhật status = "INDEXED" (hoặc "EXTRACTION_FAILED" nếu lỗi)
        ↓
Response → { documentId: 42, status: "PROCESSING" }
```

### Sơ đồ trạng thái tài liệu

```text
  [PROCESSING] ──── Trích xuất thành công ────→ [INDEXED]
       │
       └──── Trích xuất thất bại ────→ [EXTRACTION_FAILED]
                                              │
                                    Retry (mỗi 30 phút) ──→ [INDEXED]
```

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
  • Multi-match query trên title, description, extracted_text
  • Fuzzy matching (tolerance for typos)
  • Faceted aggregations
  • Highlighted snippets
  • Permission filters theo quyền truy cập tài liệu
      ↓
[SearchService] — Post-processing
  • Highlight matched text (đánh dấu <em> tại vị trí match)
  • Tính toán relevance score
  • Đếm search time (ms)
      ↓
Response → {
  results: [...],        ← Danh sách tài liệu match
  totalHits: 12,         ← Tổng kết quả
  highlights: [...],     ← Snippet nội dung có highlight
  searchTime: 45         ← Thời gian search (ms)
}
      ↓
[Frontend] — Hiển thị kết quả
  • Tiêu đề tài liệu (với highlight)
  • Snippet nội dung match (với highlight)
  • Metadata: category, file_type, date, views, downloads
  • Pagination
```

---

## Flow 4: Xem & Tải tài liệu (User)

```text
User click vào tài liệu từ kết quả tìm kiếm
      ↓
[DocumentController] — GET /documents/{id}
      ↓
[DocumentService]
  ├── Lấy metadata từ MySQL
  ├── Tăng view_count (+1)
  └── Ghi lại access_log
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
  ├── PDF      → Trả stream PDF trực tiếp (browser render)
  ├── DOCX/DOC → Convert sang PDF → trả stream
  ├── XLS/XLSX → Convert sang PDF hoặc HTML table
  └── Image    → Trả stream trực tiếp
      ↓
Browser hiển thị PDF Viewer / Image Viewer

─── Download ──────────────────────────────────
User click "Download"
      ↓
[DownloadController] — GET /documents/{id}/download
      ↓
[DocumentService]
  ├── Tăng download_count (+1)
  └── Trả file gốc (Content-Disposition: attachment)
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
  ├── Lưu file mới vào Storage
  ├── Tạo record mới trong document_versions
  ├── Cập nhật version_number trong documents
  ├── Trích xuất nội dung mới → Re-index
  └── File cũ được giữ lại trong lịch sử
```

---

## Tổng hợp luồng theo Actor

### Admin Flows

| # | Luồng | Tần suất |
|---|-------|----------|
| 1 | Đăng nhập | Hàng ngày |
| 2 | Upload tài liệu mới | Thường xuyên |
| 3 | Cập nhật metadata tài liệu | Thỉnh thoảng |
| 4 | Upload phiên bản mới | Thỉnh thoảng |
| 5 | Quản lý danh mục/phòng ban/tags | Ít khi |
| 6 | Quản lý user | Ít khi |
| 7 | Xem dashboard thống kê | Hàng ngày |

### User Flows

| # | Luồng | Tần suất |
|---|-------|----------|
| 1 | Đăng nhập | Hàng ngày |
| 2 | Tìm kiếm tài liệu | Rất thường xuyên |
| 3 | Preview tài liệu | Thường xuyên |
| 4 | Download tài liệu | Thường xuyên |
| 5 | Xem/sửa profile cá nhân | Ít khi |
