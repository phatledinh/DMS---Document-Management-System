# Phân Rã Màn Hình — DMS

> Phân rã tất cả các màn hình giao diện (UI screens) của hệ thống DMS, tổ chức theo nhóm chức năng.

---

## Tổng quan màn hình

```text
┌─────────────────────────────────────────────────────────────────────┐
│                        SITEMAP — DMS                                │
│                                                                     │
│  [MH01] Login                                                       │
│     │                                                               │
│     ├── (User) ──────────────────────────────────────┐              │
│     │   [MH02] Trang tìm kiếm (Home)                │              │
│     │   [MH03] Kết quả tìm kiếm                     │              │
│     │   [MH04] Chi tiết tài liệu                    │              │
│     │   [MH05] Preview tài liệu                     │              │
│     │   [MH06] Profile cá nhân                       │              │
│     │                                                │              │
│     └── (Admin) ─────────────────────────────────────┘              │
│         [MH07] Dashboard (Admin Home)                               │
│         [MH08] Quản lý tài liệu                                    │
│         [MH09] Upload tài liệu                                     │
│         [MH10] Sửa tài liệu                                        │
│         [MH11] Lịch sử phiên bản                                   │
│         [MH12] Quản lý danh mục                                     │
│         [MH13] Quản lý phòng ban                                    │
│         [MH14] Quản lý tags                                         │
│         [MH15] Quản lý users                                        │
│         [MH16] Audit & Access Log                                   │
│         [MH17] Tài liệu lỗi xử lý (Processing Errors)             │
│         [MH18] Search & Access Analytics                            │
└─────────────────────────────────────────────────────────────────────┘
```

> Một số section có thể triển khai dưới dạng tab hoặc modal thay vì màn hình riêng.
> Xem ghi chú ở từng màn hình và bảng "Tổng hợp màn hình theo Role".

---

## MH01: Màn hình Đăng nhập (Login)

| Thuộc tính | Chi tiết |
|------------|----------|
| URL | `/login` |
| Actor | Admin, User |
| Mô tả | Trang đăng nhập hệ thống |
| Features liên quan | F1.1, F1.2 |

### Layout

```text
┌──────────────────────────────────────────────┐
│                                              │
│             LOGO — DMS                       │
│       Hệ thống Quản lý Tài liệu             │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │  📧 Email                              │  │
│  │  [________________________]            │  │
│  │                                        │  │
│  │  🔒 Mật khẩu                           │  │
│  │  [________________________]            │  │
│  │                                        │  │
│  │  [      ĐĂNG NHẬP        ]            │  │
│  └────────────────────────────────────────┘  │
│                                              │
└──────────────────────────────────────────────┘
```

### Thành phần

| # | Element | Type | Mô tả |
|---|---------|------|-------|
| 1 | Logo + Tên hệ thống | Text | Header |
| 2 | Input Email | Text Input | Required, validation email |
| 3 | Input Password | Password Input | Required |
| 4 | Nút Đăng nhập | Button (Primary) | Submit form |
| 5 | Thông báo lỗi | Alert | Hiển thị khi sai email/password (INVALID_CREDENTIALS) |

> Sau đăng nhập: Admin → MH07 Dashboard; User → MH02 Trang tìm kiếm.
> Access Token lưu memory, Refresh Token nằm trong HttpOnly Cookie; interceptor tự refresh (F1.2).

---

## MH02: Trang tìm kiếm (User Home)

| Thuộc tính | Chi tiết |
|------------|----------|
| URL | `/` hoặc `/search` |
| Actor | Admin, User |
| Mô tả | Trang chủ — thanh tìm kiếm lớn + autocomplete + tài liệu mới nhất |
| Features liên quan | F3.1, F3.5, F3.7, F2.3 |

### Layout

```text
┌──────────────────────────────────────────────────────────┐
│  [LOGO]  DMS          [Search...]        [Avatar] [▼]   │
├──────────────────────────────────────────────────────────┤
│                                                          │
│              🔍 TÌM KIẾM TÀI LIỆU                      │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Nhập từ khóa tìm kiếm...                [🔍]   │   │
│  ├──────────────────────────────────────────────────┤   │
│  │  Gợi ý (autocomplete):                           │   │
│  │   • Quy trình ISO 9001        (title)            │   │
│  │   • SOP-QA-001                (document code)     │   │
│  │   • #ISO                      (tag)               │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  Bộ lọc:                                                 │
│  [Danh mục ▼] [Phòng ban ▼] [Loại file ▼] [Tags ▼]    │
│  [📅 Khoảng thời gian ▼]                                │
│                                                          │
├──────────────────────────────────────────────────────────┤
│  📄 TÀI LIỆU MỚI NHẤT (chỉ tài liệu có quyền xem)      │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐          │
│  │ 📋 ISO     │ │ 📄 Biểu mẫu│ │ 📊 Báo cáo  │         │
│  │ 9001...    │ │ nhân sự... │ │ Q2 2026... │          │
│  │ PDF · 2MB  │ │ DOCX · 1MB │ │ XLSX · 3MB │          │
│  └────────────┘ └────────────┘ └────────────┘          │
└──────────────────────────────────────────────────────────┘
```

### Thành phần

| # | Element | Type | Mô tả |
|---|---------|------|-------|
| 1 | Header / Navbar | Component | Logo, search mini, user menu |
| 2 | Search Bar (lớn) | Text Input | Ô tìm kiếm chính, prominent |
| 3 | Search Autocomplete | Dropdown | Gợi ý theo title, document code, tags (F3.7) |
| 4 | Filter Bar | Dropdowns | Danh mục, Phòng ban, Loại file, Tags, Khoảng thời gian |
| 5 | Document Grid | Card Grid | Tài liệu mới nhất (cards) |
| 6 | Document Card | Card | Title, type icon, file size, date |

> Chỉ hiển thị tài liệu `INDEXED` và user có quyền xem.
> Suggestions không gợi ý tài liệu/tag dẫn tới tài liệu user không có quyền.

---

## MH03: Kết quả tìm kiếm

| Thuộc tính | Chi tiết |
|------------|----------|
| URL | `/search?q=...&categoryId=...` |
| Actor | Admin, User |
| Mô tả | Hiển thị kết quả tìm kiếm với highlight, facets và sort |
| Features liên quan | F3.1–F3.8, F6.3 |

### Layout

```text
┌──────────────────────────────────────────────────────────┐
│  [LOGO]  DMS    [Tìm kiếm: "quy trình ISO"]   [Avatar] │
├──────────────────────────────────────────────────────────┤
│  ┌───────────┐  Tìm thấy 12 kết quả (45ms)              │
│  │ BỘ LỌC   │  Sắp xếp: [Liên quan ▼]                  │
│  │ (facets) │                                            │
│  │ Danh mục  │  ┌──────────────────────────────────────┐│
│  │ ☐ ISO (8) │  │ 📋 Quy trình <em>ISO</em> 9001      ││
│  │ ☐ SOP (3) │  │ SOP-QA-001 · PDF · 2MB · 150 views  ││
│  │           │  │ "...theo tiêu chuẩn <em>ISO</em>    ││
│  │ Loại file │  │  9001:2015, quy trình này..."         ││
│  │ ☐ PDF(120)│  └──────────────────────────────────────┘│
│  │ ☐ DOCX(42)│                                           │
│  │ ☐ XLSX(9) │  ┌──────────────────────────────────────┐│
│  │           │  │ 📋 <em>Quy trình</em> kiểm tra      ││
│  │ Phòng ban │  │ SOP-QA-005 · DOCX · 1.5MB            ││
│  │ ☐ IT (5)  │  │ "...áp dụng <em>quy trình</em>      ││
│  │ ☐ HR (4)  │  │  kiểm tra chất lượng..."             ││
│  │ ☐ QA (18) │  └──────────────────────────────────────┘│
│  │           │                                           │
│  │ Tags      │  [1] [2] [3] ... [Tiếp →]               │
│  │ 📅 Ngày   │                                           │
│  │ (Admin:   │                                           │
│  │  status,  │                                           │
│  │  access)  │                                           │
│  └───────────┘                                           │
└──────────────────────────────────────────────────────────┘
```

### Thành phần

| # | Element | Type | Mô tả |
|---|---------|------|-------|
| 1 | Search Bar (đã điền) | Text Input | Hiển thị query hiện tại, có autocomplete |
| 2 | Facet Filter Sidebar | Checkbox Groups + counts | Category, department, file type, tag, date range (F3.5, F3.6) |
| 3 | Result Count + Search Time | Text | "Tìm thấy X kết quả (Y ms)" |
| 4 | Sort Dropdown | Select | relevance, createdAt, updatedAt, viewCount, downloadCount, title |
| 5 | Result List | List | Danh sách kết quả |
| 6 | Result Item | Card | Title (highlight), code, metadata, snippet (highlight) |
| 7 | Pagination | Pagination | Phân trang kết quả |

> Kết quả chỉ gồm tài liệu user có quyền (F3.2) và mặc định status `INDEXED`.
> Facet count phải tôn trọng permission filter (F3.6).
> Admin có thêm facet `status` và `accessLevel`.
> Mỗi lần search ghi search log qua F6.3.

---

## MH04: Chi tiết tài liệu

| Thuộc tính | Chi tiết |
|------------|----------|
| URL | `/documents/{id}` hoặc `/documents/{slug}` |
| Actor | Admin, User |
| Mô tả | Trang chi tiết metadata + actions theo quyền và role |
| Features liên quan | F2.4, F2.7, F2.8, F2.10, F2.11, F2.12, F2.13, F2.14, F2.15 |

### Layout

```text
┌──────────────────────────────────────────────────────────┐
│  ← Quay lại                                    [Avatar] │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  📋 Quy trình ISO 9001 - Quản lý chất lượng            │
│  Mã: SOP-QA-001 · Phiên bản: 1.2 · 🔒 DEPARTMENT       │
│                                                          │
│  [📖 Preview]  [⬇️ Download]                            │
│  (Admin) [✏️ Sửa] [🗂️ Archive] [♻️ Restore] [🗑️ Xóa]  │
│  (Admin) [⤴️ Upload version] [🔁 Retry processing/search refresh*]      │
│                                                          │
│  ─────────────────────────────────────────               │
│  Mô tả:                                                 │
│  Tài liệu mô tả quy trình quản lý chất lượng theo      │
│  tiêu chuẩn ISO 9001:2015                               │
│                                                          │
│  ─────────────────────────────────────────               │
│  Thông tin chi tiết:                                     │
│  │ Danh mục:    Quy trình ISO                           │
│  │ Loại file:   PDF · 2 MB · 25 trang                   │
│  │ Tags:        [ISO] [Chất lượng]                      │
│  │ Ngày upload: 21/07/2026                              │
│  │ Hiệu lực:   01/01/2026 · Hết hạn: —                 │
│  │ Lượt xem:    150 · Lượt tải: 45                      │
│  │ Upload bởi:  Admin · Trạng thái: INDEXED             │
│                                                          │
│  ─── ACL (chỉ Admin) ─────────────────────               │
│  │ Access Level: DEPARTMENT                             │
│  │ Phòng ban:   QA, IT                                  │
│  │ Owner:       admin@company.com                        │
│  │ Shared users: —                                       │
│                                                          │
│  ─────────────────────────────────────────               │
│  📜 Lịch sử phiên bản:                                  │
│  │ v1.2 (current) — Cập nhật quy trình (20/07) [⬇️]     │
│  │ v1.1 — Bổ sung phụ lục B (10/05)   [⬇️] (Admin ♻️)  │
│  │ v1.0 — Phiên bản đầu tiên (15/01)  [⬇️] (Admin ♻️)  │
└──────────────────────────────────────────────────────────┘
```

### Business rules UI

- Chỉ render nếu user có quyền truy cập; không có quyền → 404/403, không hiển thị metadata/URL.
- User chỉ thấy tài liệu `INDEXED`; tài liệu `DELETED` không hiển thị.
- Actions Admin: Sửa metadata/ACL, Archive, Restore, Xóa, Upload version, Retry processing/search refresh (chỉ khi `EXTRACTION_FAILED`).
- Hiển thị `accessLevel` (PUBLIC/DEPARTMENT/RESTRICTED); khối ACL summary chỉ hiển thị với Admin.
- Restore version (♻️) và Upload version chỉ hiển thị với Admin.
- Không tăng `view_count` khi chỉ xem metadata; chỉ tăng khi backend cấp presigned preview URL thành công (F2.4).

---

## MH05: Preview tài liệu

| Thuộc tính | Chi tiết |
|------------|----------|
| URL | `/documents/{id}/preview` (route UI; gọi API `/documents/{id}/preview-url` để lấy presigned URL) |
| Actor | Admin, User |
| Mô tả | Xem tài liệu trực tiếp theo loại file |
| Features liên quan | F2.7 |

### Layout

```text
┌──────────────────────────────────────────────────────────┐
│  ← Quay lại    ISO 9001 - QA Process       [⬇️ Lấy link tải] │
├──────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────┐   │
│  │                                                    │   │
│  │      [PDF VIEWER / HTML PREVIEW / IMAGE]           │   │
│  │                                                    │   │
│  │      Nội dung tài liệu hiển thị trực tiếp         │   │
│  │      trong trình duyệt                             │   │
│  │                                                    │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  [← Trang trước]    Trang 1 / 25    [Trang sau →]      │
│                     [🔍 Zoom +/-]                        │
└──────────────────────────────────────────────────────────┘
```

### Preview theo loại file

| Loại file | Cách hiển thị |
|-----------|---------------|
| PDF | Browser PDF viewer, stream trực tiếp |
| DOC / DOCX | Convert sang PDF hoặc HTML preview (đã sanitize) |
| XLS / XLSX | Convert sang HTML table (đã sanitize) hoặc PDF |
| Image (jpg/png/tiff) | Image viewer, stream trực tiếp |

### Business rules UI

- Kiểm tra quyền bằng cùng logic với search/detail/download.
- Chỉ preview tài liệu `INDEXED`, không `DELETED`.
- HTML preview phải được sanitize để tránh XSS.
- Nếu conversion/preview lỗi: hiển thị thông báo lỗi và nút Download nếu user có quyền.
- Ghi access log action = Preview (F6.2).

---

## MH06: Profile cá nhân

| Thuộc tính | Chi tiết |
|------------|----------|
| URL | `/profile` |
| Actor | Admin, User |
| Mô tả | Xem và sửa thông tin cá nhân |
| Features liên quan | F1.4, F1.5 |

### Layout

```text
┌──────────────────────────────────────────────────────────┐
│  ← Quay lại         Profile                    [Avatar] │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────┐  Nguyễn Văn A                                  │
│  │ 📷  │  user@company.com                               │
│  │     │  Phòng Kỹ thuật · USER                         │
│  └─────┘                                                 │
│                                                          │
│  ─────────────────────────────────────────               │
│  Họ tên:    [Nguyễn Văn A              ]                │
│  Email:     user@company.com (không đổi được)           │
│  SĐT:      [0901234567                ]                 │
│  Avatar:    [📷 Chọn ảnh...]                            │
│                                                          │
│  [    LƯU THAY ĐỔI    ]                                │
└──────────────────────────────────────────────────────────┘
```

> Không được tự đổi email và role (F1.5).

---

## MH07: Dashboard Admin

| Thuộc tính | Chi tiết |
|------------|----------|
| URL | `/admin/dashboard` |
| Actor | Admin |
| Mô tả | Trang chủ Admin — thống kê tổng quan, có thể chia tab |
| Features liên quan | F5.1, F5.2, F5.3 (và link tới MH18 cho F5.4–F5.6) |

### Layout

```text
┌──────────────────────────────────────────────────────────┐
│  [LOGO]  DMS Admin              [🔍 Search]    [Avatar] │
├──────────┬───────────────────────────────────────────────┤
│ SIDEBAR  │  DASHBOARD                                    │
│          │  [Overview] [Search Analytics] [Access] [Errors]│
│ 📊 Dashboard │                                           │
│ 📄 Tài liệu │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────┐│
│ 📁 Danh mục  │  │ 📄 1250│ │ 👥  85 │ │ 📁  15 │ │🏢 8││
│ 🏢 Phòng ban │  │ Tài liệu│ │ Users  │ │ Dmục  │ │P.ban││
│ 🏷️ Tags     │  └────────┘ └────────┘ └────────┘ └────┘│
│ 👥 Users    │  ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│ 📋 Audit    │  │👁 12,340 │ │⬇ 4,210  │ │🔍 8,900 │    │
│ ⚠️ Lỗi xử lý│  │ Preview  │ │ Download │ │ Search   │    │
│             │  └──────────┘ └──────────┘ └──────────┘   │
│             │                                           │
│             │  ┌──────────────────┐ ┌─────────────────┐ │
│             │  │ 📊 Theo loại file│ │ 📊 Theo trạng   │ │
│             │  │  PDF:   800      │ │  INDEXED: 1200   │ │
│             │  │  DOCX:  300      │ │  PROCESSING: 10  │ │
│             │  │  XLSX:  100      │ │  FAILED: 40      │ │
│             │  │  DOC:    30      │ │  ARCHIVED: ...    │ │
│             │  └──────────────────┘ └─────────────────┘ │
│             │                                           │
│             │  📈 Top xem nhiều    📥 Upload gần đây    │
│             │  1. ISO 9001 (500)   1. SOP CNC (hôm nay) │
│             │  2. Biểu mẫu (350)  2. HR Form (hôm qua) │
└──────────┴───────────────────────────────────────────────┘
```

### Widgets / Tabs

| Tab | Nội dung | Feature |
|-----|----------|---------|
| Overview | Tổng documents/users/categories/departments; tổng preview/download/search; theo status/file type | F5.1 |
| Overview | Top tài liệu xem/tải nhiều, upload gần đây | F5.2, F5.3 |
| Search Analytics | Top search keywords, searchTime/resultCount trung bình | F5.4 (→ MH18) |
| Access | Preview/download theo thời gian, unique users | F5.5 (→ MH18) |
| Errors | Tài liệu PROCESSING lâu / EXTRACTION_FAILED, link tới MH17 | F5.6 (→ MH17) |

> Có thể triển khai Search Analytics / Access / Errors dưới dạng tab của MH07 hoặc màn riêng MH18/MH17.

---

## MH08: Quản lý tài liệu (Admin)

| Thuộc tính | Chi tiết |
|------------|----------|
| URL | `/admin/documents` |
| Actor | Admin |
| Mô tả | Danh sách tài liệu dạng bảng với filter, quick tabs và actions lifecycle |
| Features liên quan | F2.3, F2.5, F2.6, F2.7, F2.8, F2.9, F2.10, F2.13, F2.14, F2.15 |

### Layout

```text
┌──────────────────────────────────────────────────────────┐
│ SIDEBAR │  QUẢN LÝ TÀI LIỆU           [+ Upload mới]  │
│         │                                                │
│         │  Tabs: [Tất cả][Đang xử lý][Lỗi][Archived][Đã xóa]│
│         │  Bộ lọc: [Danh mục▼][Phòng ban▼][Loại▼]      │
│         │          [Access▼][Uploader▼][📅 Ngày]        │
│         │  Tìm kiếm: [________________] [🔍]            │
│         │                                                │
│         │  ┌────┬──────────┬──────┬──────┬──────┬─────┐ │
│         │  │ #  │ Tiêu đề  │ Mã   │ Loại │Status│ ⚙️  │ │
│         │  ├────┼──────────┼──────┼──────┼──────┼─────┤ │
│         │  │ 1  │ ISO 9001 │SOP-01│ PDF  │✅    │[⋮]  │ │
│         │  │ 2  │ Biểu mẫu │HR-001│ DOCX │✅    │[⋮]  │ │
│         │  │ 3  │ Báo cáo  │FIN-05│ XLSX │⏳    │[⋮]  │ │
│         │  │ 4  │ Bản vẽ   │ENG-09│ PDF  │❌    │[⋮]  │ │
│         │  └────┴──────────┴──────┴──────┴──────┴─────┘ │
│         │                                                │
│         │  Hiển thị 1-20 / 150    [← 1 2 3 ... 8 →]    │
└──────────┴───────────────────────────────────────────────┘

[⋮] Menu: Xem chi tiết | Sửa metadata/ACL | Preview | Download
          | Upload version | Xem versions
          | Archive | Restore | Retry processing/search refresh* | Xóa (soft)
   (* Retry processing/search refresh chỉ hiển thị khi status = EXTRACTION_FAILED)
```

### Filters

| Filter | Giá trị |
|--------|---------|
| status | PROCESSING, INDEXED, EXTRACTION_FAILED, ARCHIVED, DELETED |
| accessLevel | PUBLIC, DEPARTMENT, RESTRICTED |
| category / department / fileType / tags | Theo master data |
| owner / uploader | Theo user |
| date range | effectiveDate / createdAt |

### Quick tabs

- Tất cả · Đang xử lý (PROCESSING) · Lỗi xử lý (EXTRACTION_FAILED) · Archived · Đã xóa (DELETED).

> Status icon: ✅ INDEXED · ⏳ PROCESSING · ❌ EXTRACTION_FAILED · 🗂️ ARCHIVED · 🗑️ DELETED.

---

## MH09: Upload tài liệu

| Thuộc tính | Chi tiết |
|------------|----------|
| URL | `/admin/documents/upload` |
| Actor | Admin |
| Mô tả | Form upload tài liệu mới với access level và ACL động |
| Features liên quan | F2.1 |

### Layout

```text
┌──────────────────────────────────────────────────────────┐
│ SIDEBAR │  UPLOAD TÀI LIỆU MỚI                        │
│         │                                                │
│         │  ┌──────────────────────────────────────────┐  │
│         │  │  📎 Kéo thả file vào đây                 │  │
│         │  │     hoặc [Chọn file...]                  │  │
│         │  │  PDF, DOC, DOCX, XLS, XLSX,              │  │
│         │  │  JPG, PNG, TIFF (1 file, max 50MB)       │  │
│         │  └──────────────────────────────────────────┘  │
│         │                                                │
│         │  Tiêu đề *:     [________________________]    │
│         │  Mô tả:         [________________________]    │
│         │  Mã tài liệu:   [________________________]    │
│         │  Danh mục *:     [Chọn danh mục          ▼]   │
│         │  Tags:           [🏷️ ISO] [🏷️ +Thêm tag...]  │
│         │  Ngày hiệu lực:  [📅 __ /__ /____]           │
│         │  Ngày hết hạn:   [📅 __ /__ /____]           │
│         │                                                │
│         │  Access Level *: (○ PUBLIC ● DEPARTMENT ○ RESTRICTED)│
│         │   ├ nếu DEPARTMENT: [Chọn phòng ban (nhiều) ▼]│
│         │   └ nếu RESTRICTED: [Owner ▼] [Shared users ▼]│
│         │                                                │
│         │  [    HỦY    ]   [    UPLOAD    ]             │
└──────────┴───────────────────────────────────────────────┘
```

### Validate UI

- 1 file/request, size ≤ 50MB, đúng loại file cho phép.
- Chặn extension nguy hiểm (`.exe`, `.sh`, `.bat`, `.cmd`, `.js`, `.html`).
- Nếu `DEPARTMENT`: bắt buộc chọn ít nhất một phòng ban.
- Nếu `RESTRICTED`: bắt buộc chọn owner hoặc ít nhất một shared user.
- Sau upload: hiển thị trạng thái `PROCESSING`, thông báo tài liệu đang được xử lý/index.

---

## MH10: Sửa tài liệu

| Thuộc tính | Chi tiết |
|------------|----------|
| URL | `/admin/documents/{id}/edit` |
| Actor | Admin |
| Mô tả | Form sửa metadata và ACL tài liệu (không đổi file) |
| Features liên quan | F2.5 |

Tương tự MH09 nhưng:

- Không có phần upload file (đổi file dùng MH11 upload version mới).
- Các field đã điền sẵn data hiện tại.
- Cho phép sửa: `title`, `description`, `categoryId`, `documentCode`, `tagIds`, `effectiveDate`, `expiryDate`, `accessLevel` và ACL tương ứng (`departmentIds` / `ownerId` / `sharedUserIds`).
- Nút "LƯU THAY ĐỔI" thay vì "UPLOAD".
- Cảnh báo: thay đổi `accessLevel`/ACL ảnh hưởng đến visibility trong search/detail/preview/download và sẽ refresh PostgreSQL search vector.

---

## MH11: Lịch sử phiên bản

| Thuộc tính | Chi tiết |
|------------|----------|
| URL | `/admin/documents/{id}/versions` (hoặc tab trong MH04) |
| Actor | Admin |
| Mô tả | Xem danh sách phiên bản, upload version mới và restore version cũ |
| Features liên quan | F2.9, F2.10, F2.11, F2.12 |

### Layout

```text
┌──────────────────────────────────────────────────────────┐
│ SIDEBAR │  LỊCH SỬ PHIÊN BẢN — ISO 9001  [⤴️ Upload version]│
│         │                                                │
│         │  ┌──────┬──────────┬────────┬──────────┬──────┐│
│         │  │ Ver  │ Uploader │ Ngày   │ Changelog│ ⚙️   ││
│         │  ├──────┼──────────┼────────┼──────────┼──────┤│
│         │  │v1.2 ★│ Admin    │20/07   │ Cập nhật │[⬇️]  ││
│         │  │v1.1  │ Admin    │10/05   │ Phụ lục B│[⬇️][♻️]│
│         │  │v1.0  │ Admin    │15/01   │ Đầu tiên │[⬇️][♻️]│
│         │  └──────┴──────────┴────────┴──────────┴──────┘│
│         │  ★ = current version                           │
└──────────┴───────────────────────────────────────────────┘

[Modal Upload version]: file *, versionNumber *, changelog
[♻️ Restore]: chọn version cũ làm current → re-extract + refresh search vector
```

### Business rules UI

- Hiển thị: version number, current flag, uploader, uploadedAt, changelog, file type/size.
- Actions: Download version (F2.11), Upload version mới (F2.9), Restore version làm current (F2.12).
- Sau upload/restore version: hiển thị trạng thái `PROCESSING` → `INDEXED` / `EXTRACTION_FAILED`.
- Version cũ không bị ghi đè.

---

## MH12: Quản lý danh mục

| Thuộc tính | Chi tiết |
|------------|----------|
| URL | `/admin/categories` |
| Actor | Admin |
| Mô tả | CRUD danh mục dạng cây phân cấp |
| Features liên quan | F4.1–F4.3 |

### Layout

```text
┌──────────────────────────────────────────────────────────┐
│ SIDEBAR │  QUẢN LÝ DANH MỤC            [+ Thêm mới]   │
│         │                                                │
│         │  ▼ 📋 Quy trình ISO (25 tài liệu)      [⋮]  │
│         │     ├── ISO 9001 - Chất lượng (10)       [⋮]  │
│         │     ├── ISO 14001 - Môi trường (8)       [⋮]  │
│         │     └── ISO 45001 - An toàn (7)          [⋮]  │
│         │  ▼ 📄 Biểu mẫu (50 tài liệu)           [⋮]  │
│         │     ├── Biểu mẫu nhân sự (20)            [⋮]  │
│         │     ├── Biểu mẫu kế toán (15)            [⋮]  │
│         │     └── Biểu mẫu kỹ thuật (15)           [⋮]  │
│         │  ► 📖 SOP (30 tài liệu)                 [⋮]  │
│         │  ► 📝 Hướng dẫn (20 tài liệu)           [⋮]  │
└──────────┴───────────────────────────────────────────────┘
```

> Hỗ trợ parent/child, sort_order, icon; soft delete. Thay đổi ảnh hưởng filter search sẽ refresh search row cho tài liệu liên quan.

---

## MH13: Quản lý phòng ban

| Thuộc tính | Chi tiết |
|------------|----------|
| URL | `/admin/departments` |
| Actor | Admin |
| Mô tả | CRUD phòng ban |
| Features liên quan | F4.4–F4.6 |

Hiển thị dạng bảng đơn giản: Tên, Mã (code unique), Mô tả, Trạng thái (is_active), Actions.

> Phòng ban dùng cho access level `DEPARTMENT`; thay đổi ACL/filter sẽ refresh search row cho tài liệu liên quan.

---

## MH14: Quản lý Tags

| Thuộc tính | Chi tiết |
|------------|----------|
| URL | `/admin/tags` |
| Actor | Admin |
| Mô tả | CRUD tags |
| Features liên quan | F4.7–F4.9 |

Hiển thị dạng bảng hoặc tag cloud: Tên, Slug (tự sinh), Số tài liệu, Actions. Soft delete.

---

## MH15: Quản lý Users

| Thuộc tính | Chi tiết |
|------------|----------|
| URL | `/admin/users` |
| Actor | Admin |
| Mô tả | CRUD users |
| Features liên quan | F1.6 |

### Layout

```text
┌──────────────────────────────────────────────────────────┐
│ SIDEBAR │  QUẢN LÝ USERS                [+ Thêm user]  │
│         │                                                │
│         │  Bộ lọc: [Role▼] [Phòng ban▼] [Trạng thái▼]  │
│         │                                                │
│         │  ┌────┬──────────┬──────────┬──────┬──────┬──┐│
│         │  │ #  │ Họ tên   │ Email    │ Role │Status│⚙️││
│         │  ├────┼──────────┼──────────┼──────┼──────┼──┤│
│         │  │ 1  │ Nguyễn A │ a@co.com │ADMIN │ ✅   │[⋮]│
│         │  │ 2  │ Trần B   │ b@co.com │USER  │ ✅   │[⋮]│
│         │  │ 3  │ Lê C     │ c@co.com │USER  │ ⛔   │[⋮]│
│         │  └────┴──────────┴──────────┴──────┴──────┴──┘│
│         │                                                │
│         │  Hiển thị 1-20 / 85     [← 1 2 3 4 5 →]      │
└──────────┴───────────────────────────────────────────────┘

[+ Thêm user]: name, email, password, phone, role, departmentId
[⋮] Menu: Xem chi tiết | Sửa (role/department/status) | Deactivate/Xóa mềm
```

> Email unique, phải chọn department tồn tại; chỉ Admin tạo user và đổi role.

---

## MH16: Audit & Access Log

| Thuộc tính | Chi tiết |
|------------|----------|
| URL | `/admin/audit-logs` |
| Actor | Admin |
| Mô tả | Tra cứu audit/access/search log với filters |
| Features liên quan | F6.1, F6.2, F6.3, F6.4 |

### Layout

```text
┌──────────────────────────────────────────────────────────┐
│ SIDEBAR │  AUDIT & ACCESS LOG                          │
│         │                                                │
│         │  Tabs: [Audit] [Access] [Search]              │
│         │  Bộ lọc: [Actor▼][Action▼][Document][📅 Ngày] │
│         │  Từ khóa: [________________] [🔍]             │
│         │                                                │
│         │  ┌───────────┬───────┬─────────┬─────────────┐│
│         │  │ Thời gian │ Actor │ Action  │ Chi tiết    ││
│         │  ├───────────┼───────┼─────────┼─────────────┤│
│         │  │21/07 10:12│ Admin │ Upload  │ ISO 9001    ││
│         │  │21/07 10:30│ User A│ Download│ ISO 9001    ││
│         │  │21/07 10:31│ User A│ Search  │ "quy trình" ││
│         │  │21/07 11:05│ Admin │ Update  │ HR-001 (3f) ││
│         │  └───────────┴───────┴─────────┴─────────────┘│
│         │                                                │
│         │  Hiển thị 1-20 / 1240   [← 1 2 3 ... →]      │
└──────────┴───────────────────────────────────────────────┘
```

### Thành phần

| # | Element | Mô tả |
|---|---------|-------|
| 1 | Log Tabs | Audit (quản trị) / Access (preview,download) / Search (keyword) |
| 2 | Filter Bar | actor/user, action, documentId/title, keyword, date range |
| 3 | Log Table | timestamp, actor, action, resource/document, changedFields/metadata |
| 4 | Row link | Link sang MH04 chi tiết tài liệu |
| 5 | Pagination | Phân trang |

> Sidebar Admin bổ sung menu "Audit Logs" và hỗ trợ Export CSV.

---

## MH17: Tài liệu lỗi xử lý (Processing Errors)

| Thuộc tính | Chi tiết |
|------------|----------|
| URL | `/admin/documents/processing-errors` (hoặc quick tab của MH08) |
| Actor | Admin |
| Mô tả | Theo dõi và retry tài liệu `EXTRACTION_FAILED` / `PROCESSING` lâu |
| Features liên quan | F2.15, F5.6 |

### Layout

```text
┌──────────────────────────────────────────────────────────┐
│ SIDEBAR │  TÀI LIỆU LỖI XỬ LÝ            [🔁 Retry tất cả]│
│         │                                                │
│         │  ┌────┬──────────┬──────┬────────┬───────┬────┐│
│         │  │ #  │ Tiêu đề  │ Loại │ Lỗi    │ Retry │ ⚙️ ││
│         │  ├────┼──────────┼──────┼────────┼───────┼────┤│
│         │  │ 1  │ Bản vẽ   │ PDF  │Parse..│ 2     │[🔁]││
│         │  │ 2  │ Scan HĐ  │ TIFF │No OCR │ 0     │[🔁]││
│         │  └────┴──────────┴──────┴────────┴───────┴────┘│
│         │                                                │
│         │  [Modal xác nhận Retry processing/search refresh]               │
└──────────┴───────────────────────────────────────────────┘
```

> Hiển thị error message, retry count, last retry time; nút Retry processing/search refresh (F2.15) với modal xác nhận.
> Có thể triển khai như quick tab "Lỗi xử lý" của MH08 thay vì màn riêng.

---

## MH18: Search & Access Analytics

| Thuộc tính | Chi tiết |
|------------|----------|
| URL | `/admin/analytics` (hoặc các tab của MH07) |
| Actor | Admin |
| Mô tả | Thống kê chuyên sâu về search và access |
| Features liên quan | F5.4, F5.5 |

### Nội dung

- Top search keywords: keyword, số lần tìm, resultCount trung bình, searchTime trung bình (F5.4).
- Access stats theo thời gian: preview/download count, unique users (F5.5).
- Search performance: searchTime trung bình / P95 (bám NFR search latency).

> Có thể gom vào tab "Search Analytics" và "Access" của MH07 thay vì màn riêng.

---

## Tổng hợp màn hình theo Role

### User Screens (6 màn hình)

| # | Màn hình | URL | Mô tả |
|---|----------|-----|-------|
| MH01 | Login | `/login` | Đăng nhập |
| MH02 | Trang tìm kiếm | `/` | Home — search + autocomplete + tài liệu mới |
| MH03 | Kết quả tìm kiếm | `/search?q=...` | Kết quả + facets + sort |
| MH04 | Chi tiết tài liệu | `/documents/{id}` | Metadata + preview/download + versions |
| MH05 | Preview | `/documents/{id}/preview` | PDF/HTML/Image viewer dùng presigned preview URL |
| MH06 | Profile | `/profile` | Xem/sửa thông tin cá nhân |

### Admin Screens (12 màn hình)

| # | Màn hình | URL | Mô tả |
|---|----------|-----|-------|
| MH07 | Dashboard | `/admin/dashboard` | Thống kê tổng quan (tabs) |
| MH08 | Quản lý tài liệu | `/admin/documents` | Bảng + filter + lifecycle actions |
| MH09 | Upload tài liệu | `/admin/documents/upload` | Form upload + access level/ACL |
| MH10 | Sửa tài liệu | `/admin/documents/{id}/edit` | Sửa metadata + ACL |
| MH11 | Phiên bản | `/admin/documents/{id}/versions` | Version list + upload + restore |
| MH12 | Quản lý danh mục | `/admin/categories` | CRUD cây phân cấp |
| MH13 | Quản lý phòng ban | `/admin/departments` | CRUD bảng |
| MH14 | Quản lý tags | `/admin/tags` | CRUD bảng |
| MH15 | Quản lý users | `/admin/users` | CRUD bảng |
| MH16 | Audit & Access Log | `/admin/audit-logs` | Tra cứu log |
| MH17 | Tài liệu lỗi xử lý | `/admin/documents/processing-errors` | Retry processing/search refresh (hoặc tab MH08) |
| MH18 | Search & Access Analytics | `/admin/analytics` | Thống kê chuyên sâu (hoặc tab MH07) |

> **Ghi chú**: Admin cũng truy cập được tất cả User Screens (MH01–MH06).
> MH17 và MH18 có thể triển khai dưới dạng tab/section trong MH08/MH07 để giảm số màn.

---

## Mapping Màn hình ↔ Feature

| Màn hình | Features liên quan |
|----------|--------------------|
| MH01 | F1.1, F1.2 |
| MH02 | F3.1, F3.5, F3.7, F2.3 |
| MH03 | F3.1, F3.2, F3.3, F3.4, F3.5, F3.6, F3.8, F6.3 |
| MH04 | F2.4, F2.7, F2.8, F2.10, F2.11, F2.12, F2.13, F2.14, F2.15 |
| MH05 | F2.7, F6.2 |
| MH06 | F1.4, F1.5 |
| MH07 | F5.1, F5.2, F5.3 |
| MH08 | F2.3, F2.5, F2.6, F2.7, F2.8, F2.9, F2.10, F2.13, F2.14, F2.15 |
| MH09 | F2.1 |
| MH10 | F2.5 |
| MH11 | F2.9, F2.10, F2.11, F2.12 |
| MH12 | F4.1–F4.3 |
| MH13 | F4.4–F4.6 |
| MH14 | F4.7–F4.9 |
| MH15 | F1.6 |
| MH16 | F6.1, F6.2, F6.3, F6.4 |
| MH17 | F2.15, F5.6 |
| MH18 | F5.4, F5.5 |

---

## Shared Components (Dùng chung)

| Component | Mô tả | Dùng ở |
|-----------|-------|--------|
| Navbar | Logo, search mini, user dropdown | Tất cả (trừ Login) |
| Admin Sidebar | Menu điều hướng admin (gồm Audit, Lỗi xử lý) | MH07–MH18 |
| Pagination | Phân trang | MH03, MH08, MH15, MH16, MH17 |
| Data Table | Bảng dữ liệu có sort/filter | MH08, MH13, MH14, MH15, MH16, MH17 |
| Modal / Dialog | Confirm delete/archive/restore/retry, form nhỏ | CRUD & lifecycle |
| Toast / Notification | Thông báo thành công/lỗi | Tất cả |
| File Upload Zone | Drag & drop file (1 file, max 50MB) | MH09, MH11 |
| Tag Input | Chọn/thêm tags | MH09, MH10 |
| Tree View | Hiển thị cây phân cấp | MH12 |
| Breadcrumb | Đường dẫn điều hướng | MH04, MH09, MH10 |
| SearchAutocomplete | Gợi ý title/document code/tags | MH02, MH03 |
| FacetFilterSidebar | Filter + facet counts | MH03 |
| DateRangePicker | Chọn khoảng thời gian | MH02, MH03, MH08, MH16, MH18 |
| AccessLevelSelector | Chọn PUBLIC/DEPARTMENT/RESTRICTED + ACL động | MH09, MH10 |
| DepartmentMultiSelect | Chọn nhiều phòng ban | MH09, MH10 |
| UserMultiSelect | Chọn owner/shared users | MH09, MH10 |
| StatusBadge | Badge trạng thái tài liệu/user | MH04, MH08, MH15, MH17 |
| ActionMenu | Menu [⋮] hành động theo quyền | MH08, MH11, MH15, MH16 |
| ConfirmDialog | Xác nhận thao tác nhạy cảm | MH08, MH10, MH11, MH15, MH17 |
| VersionTimeline | Timeline/bảng phiên bản | MH04, MH11 |
| AuditLogTable | Bảng log audit/access/search | MH16 |
| DashboardMetricCard | Stat card chỉ số | MH07, MH18 |
| ChartPanel | Panel biểu đồ thống kê | MH07, MH18 |
| ProcessingErrorBadge | Badge/label lỗi xử lý | MH08, MH17 |
