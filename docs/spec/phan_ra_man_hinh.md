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
└─────────────────────────────────────────────────────────────────────┘
```

---

## MH01: Màn hình Đăng nhập (Login)

| Thuộc tính | Chi tiết |
|------------|----------|
| URL | `/login` |
| Actor | Admin, User |
| Mô tả | Trang đăng nhập hệ thống |

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
| 5 | Thông báo lỗi | Alert | Hiển thị khi sai email/password |

---

## MH02: Trang tìm kiếm (User Home)

| Thuộc tính | Chi tiết |
|------------|----------|
| URL | `/` hoặc `/search` |
| Actor | Admin, User |
| Mô tả | Trang chủ — thanh tìm kiếm lớn + tài liệu mới nhất |

### Layout

```text
┌──────────────────────────────────────────────────────────┐
│  [LOGO]  DMS          [Search...]        [Avatar] [▼]   │
├──────────────────────────────────────────────────────────┤
│                                                          │
│              🔍 TÌM KIẾM TÀI LIỆU                      │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Nhập từ khóa tìm kiếm...                [🔍]   │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  Bộ lọc:                                                 │
│  [Danh mục ▼] [Phòng ban ▼] [Loại file ▼] [Tags ▼]    │
│                                                          │
├──────────────────────────────────────────────────────────┤
│  📄 TÀI LIỆU MỚI NHẤT                                  │
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
| 3 | Filter Bar | Dropdowns | Danh mục, Phòng ban, Loại file, Tags |
| 4 | Document Grid | Card Grid | Tài liệu mới nhất (cards) |
| 5 | Document Card | Card | Title, type icon, file size, date |

---

## MH03: Kết quả tìm kiếm

| Thuộc tính | Chi tiết |
|------------|----------|
| URL | `/search?q=...&categoryId=...` |
| Actor | Admin, User |
| Mô tả | Hiển thị kết quả tìm kiếm với highlight |

### Layout

```text
┌──────────────────────────────────────────────────────────┐
│  [LOGO]  DMS    [Tìm kiếm: "quy trình ISO"]   [Avatar] │
├──────────────────────────────────────────────────────────┤
│  ┌───────────┐                                           │
│  │ BỘ LỌC   │  Tìm thấy 12 kết quả (45ms)             │
│  │           │                                           │
│  │ Danh mục  │  ┌──────────────────────────────────────┐│
│  │ ☐ ISO     │  │ 📋 Quy trình <em>ISO</em> 9001      ││
│  │ ☐ Biểu mẫu│  │ SOP-QA-001 · PDF · 2MB · 150 views  ││
│  │ ☐ SOP     │  │ "...theo tiêu chuẩn <em>ISO</em>    ││
│  │           │  │  9001:2015, quy trình này..."         ││
│  │ Loại file │  └──────────────────────────────────────┘│
│  │ ☐ PDF     │                                           │
│  │ ☐ DOCX    │  ┌──────────────────────────────────────┐│
│  │ ☐ XLSX    │  │ 📋 <em>Quy trình</em> kiểm tra      ││
│  │           │  │ SOP-QA-005 · DOCX · 1.5MB            ││
│  │ Phòng ban │  │ "...áp dụng <em>quy trình</em>      ││
│  │ ☐ IT      │  │  kiểm tra chất lượng..."             ││
│  │ ☐ HR      │  └──────────────────────────────────────┘│
│  │ ☐ QA      │                                           │
│  └───────────┘  [1] [2] [3] ... [Tiếp →]               │
└──────────────────────────────────────────────────────────┘
```

### Thành phần

| # | Element | Type | Mô tả |
|---|---------|------|-------|
| 1 | Search Bar (đã điền) | Text Input | Hiển thị query hiện tại |
| 2 | Filter Sidebar | Checkbox Groups | Lọc theo danh mục, loại file, phòng ban |
| 3 | Result Count | Text | "Tìm thấy X kết quả (Y ms)" |
| 4 | Result List | List | Danh sách kết quả |
| 5 | Result Item | Card | Title (highlight), code, metadata, snippet (highlight) |
| 6 | Pagination | Pagination | Phân trang kết quả |
| 7 | Sort Dropdown | Select | Sắp xếp: Liên quan, Mới nhất, Xem nhiều |

---

## MH04: Chi tiết tài liệu

| Thuộc tính | Chi tiết |
|------------|----------|
| URL | `/documents/{id}` hoặc `/documents/{slug}` |
| Actor | Admin, User |
| Mô tả | Trang chi tiết metadata + actions |

### Layout

```text
┌──────────────────────────────────────────────────────────┐
│  ← Quay lại                                    [Avatar] │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  📋 Quy trình ISO 9001 - Quản lý chất lượng            │
│  Mã: SOP-QA-001 · Phiên bản: 1.2                       │
│                                                          │
│  [📖 Preview]  [⬇️ Download]                            │
│                                                          │
│  ─────────────────────────────────────────               │
│  Mô tả:                                                 │
│  Tài liệu mô tả quy trình quản lý chất lượng theo      │
│  tiêu chuẩn ISO 9001:2015                               │
│                                                          │
│  ─────────────────────────────────────────               │
│  Thông tin chi tiết:                                     │
│  │ Danh mục:    Quy trình ISO                           │
│  │ Phòng ban:   Phòng QA                                │
│  │ Loại file:   PDF · 2 MB · 25 trang                   │
│  │ Tags:        [ISO] [Chất lượng]                      │
│  │ Ngày upload: 21/07/2026                              │
│  │ Hiệu lực:   01/01/2026                               │
│  │ Lượt xem:    150 · Lượt tải: 45                      │
│  │ Upload bởi:  Admin                                    │
│                                                          │
│  ─────────────────────────────────────────               │
│  📜 Lịch sử phiên bản:                                  │
│  │ v1.2 — Cập nhật quy trình (20/07/2026)       [⬇️]  │
│  │ v1.1 — Bổ sung phụ lục B (10/05/2026)        [⬇️]  │
│  │ v1.0 — Phiên bản đầu tiên (15/01/2026)       [⬇️]  │
└──────────────────────────────────────────────────────────┘
```

---

## MH05: Preview tài liệu

| Thuộc tính | Chi tiết |
|------------|----------|
| URL | `/documents/{id}/preview` (hoặc modal/overlay) |
| Actor | Admin, User |
| Mô tả | Xem tài liệu trực tiếp (PDF viewer, image viewer) |

### Layout

```text
┌──────────────────────────────────────────────────────────┐
│  ← Quay lại    ISO 9001 - QA Process       [⬇️ Tải về] │
├──────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────┐   │
│  │                                                    │   │
│  │              [PDF VIEWER]                          │   │
│  │                                                    │   │
│  │         Nội dung tài liệu hiển thị               │   │
│  │         trực tiếp trong trình duyệt               │   │
│  │                                                    │   │
│  │                                                    │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  [← Trang trước]    Trang 1 / 25    [Trang sau →]      │
│                     [🔍 Zoom +/-]                        │
└──────────────────────────────────────────────────────────┘
```

---

## MH06: Profile cá nhân

| Thuộc tính | Chi tiết |
|------------|----------|
| URL | `/profile` |
| Actor | Admin, User |
| Mô tả | Xem và sửa thông tin cá nhân |

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

---

## MH07: Dashboard Admin

| Thuộc tính | Chi tiết |
|------------|----------|
| URL | `/admin/dashboard` |
| Actor | Admin |
| Mô tả | Trang chủ Admin — thống kê tổng quan |

### Layout

```text
┌──────────────────────────────────────────────────────────┐
│  [LOGO]  DMS Admin              [🔍 Search]    [Avatar] │
├──────────┬───────────────────────────────────────────────┤
│ SIDEBAR  │                                               │
│          │  DASHBOARD                                    │
│ 📊 Dashboard │                                           │
│ 📄 Tài liệu │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────┐│
│ 📁 Danh mục  │  │ 📄 1250│ │ 👥  85 │ │ 📁  15 │ │🏢 8││
│ 🏢 Phòng ban │  │ Tài liệu│ │ Users  │ │ Dmục  │ │P.ban││
│ 🏷️ Tags     │  └────────┘ └────────┘ └────────┘ └────┘│
│ 👥 Users    │                                           │
│             │  ┌──────────────────┐ ┌─────────────────┐ │
│             │  │ 📊 Theo loại file│ │ 📊 Theo trạng   │ │
│             │  │  PDF:   800      │ │  INDEXED: 1200   │ │
│             │  │  DOCX:  300      │ │  PROCESSING: 10  │ │
│             │  │  XLSX:  100      │ │  FAILED: 40      │ │
│             │  │  DOC:    30      │ │                   │ │
│             │  └──────────────────┘ └─────────────────┘ │
│             │                                           │
│             │  📈 Top xem nhiều    📥 Upload gần đây    │
│             │  1. ISO 9001 (500)   1. SOP CNC (hôm nay) │
│             │  2. Biểu mẫu (350)  2. HR Form (hôm qua) │
└──────────┴───────────────────────────────────────────────┘
```

---

## MH08: Quản lý tài liệu (Admin)

| Thuộc tính | Chi tiết |
|------------|----------|
| URL | `/admin/documents` |
| Actor | Admin |
| Mô tả | Danh sách tài liệu dạng bảng với filter và actions |

### Layout

```text
┌──────────────────────────────────────────────────────────┐
│ SIDEBAR │  QUẢN LÝ TÀI LIỆU           [+ Upload mới]  │
│         │                                                │
│         │  Bộ lọc: [Danh mục▼] [Phòng ban▼] [Loại▼]    │
│         │  Tìm kiếm: [________________] [🔍]            │
│         │                                                │
│         │  ┌────┬──────────┬──────┬──────┬──────┬─────┐ │
│         │  │ #  │ Tiêu đề  │ Mã   │ Loại │Status│ ⚙️  │ │
│         │  ├────┼──────────┼──────┼──────┼──────┼─────┤ │
│         │  │ 1  │ ISO 9001 │SOP-01│ PDF  │✅    │[⋮]  │ │
│         │  │ 2  │ Biểu mẫu │HR-001│ DOCX │✅    │[⋮]  │ │
│         │  │ 3  │ Báo cáo  │FIN-05│ XLSX │⏳    │[⋮]  │ │
│         │  └────┴──────────┴──────┴──────┴──────┴─────┘ │
│         │                                                │
│         │  Hiển thị 1-20 / 150    [← 1 2 3 ... 8 →]    │
└──────────┴───────────────────────────────────────────────┘

[⋮] Menu: Xem chi tiết | Sửa | Upload version | Xóa
```

---

## MH09: Upload tài liệu

| Thuộc tính | Chi tiết |
|------------|----------|
| URL | `/admin/documents/upload` |
| Actor | Admin |
| Mô tả | Form upload tài liệu mới |

### Layout

```text
┌──────────────────────────────────────────────────────────┐
│ SIDEBAR │  UPLOAD TÀI LIỆU MỚI                        │
│         │                                                │
│         │  ┌──────────────────────────────────────────┐  │
│         │  │  📎 Kéo thả file vào đây                 │  │
│         │  │     hoặc [Chọn file...]                  │  │
│         │  │     PDF, DOC, DOCX, XLS, XLSX (max 50MB) │  │
│         │  └──────────────────────────────────────────┘  │
│         │                                                │
│         │  Tiêu đề *:     [________________________]    │
│         │  Mô tả:         [________________________]    │
│         │  Mã tài liệu:   [________________________]    │
│         │  Danh mục *:     [Chọn danh mục          ▼]   │
│         │  Phòng ban:      [Chọn phòng ban         ▼]   │
│         │  Tags:           [🏷️ ISO] [🏷️ +Thêm tag...]  │
│         │  Ngày hiệu lực:  [📅 __ /__ /____]           │
│         │  Ngày hết hạn:   [📅 __ /__ /____]           │
│         │  Công khai:      [✅ Tất cả user đều xem]     │
│         │                                                │
│         │  [    HỦY    ]   [    UPLOAD    ]             │
└──────────┴───────────────────────────────────────────────┘
```

---

## MH10: Sửa tài liệu

| Thuộc tính | Chi tiết |
|------------|----------|
| URL | `/admin/documents/{id}/edit` |
| Actor | Admin |
| Mô tả | Form sửa metadata tài liệu (không đổi file) |

Tương tự MH09 nhưng:
- Không có phần upload file
- Các field đã điền sẵn data hiện tại
- Nút "LƯU THAY ĐỔI" thay vì "UPLOAD"

---

## MH11: Lịch sử phiên bản

| Thuộc tính | Chi tiết |
|------------|----------|
| URL | `/admin/documents/{id}/versions` (hoặc tab trong MH04) |
| Actor | Admin |
| Mô tả | Xem và upload phiên bản mới |

Được hiển thị dạng timeline hoặc embedded trong MH04.

---

## MH12: Quản lý danh mục

| Thuộc tính | Chi tiết |
|------------|----------|
| URL | `/admin/categories` |
| Actor | Admin |
| Mô tả | CRUD danh mục dạng cây phân cấp |

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

---

## MH13: Quản lý phòng ban

| Thuộc tính | Chi tiết |
|------------|----------|
| URL | `/admin/departments` |
| Actor | Admin |
| Mô tả | CRUD phòng ban |

Hiển thị dạng bảng đơn giản: Tên, Mã, Mô tả, Trạng thái, Actions.

---

## MH14: Quản lý Tags

| Thuộc tính | Chi tiết |
|------------|----------|
| URL | `/admin/tags` |
| Actor | Admin |
| Mô tả | CRUD tags |

Hiển thị dạng bảng hoặc tag cloud: Tên, Slug, Số tài liệu, Actions.

---

## MH15: Quản lý Users

| Thuộc tính | Chi tiết |
|------------|----------|
| URL | `/admin/users` |
| Actor | Admin |
| Mô tả | CRUD users |

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
```

---

## Tổng hợp màn hình theo Role

### User Screens (6 màn hình)

| # | Màn hình | URL | Mô tả |
|---|----------|-----|-------|
| MH01 | Login | `/login` | Đăng nhập |
| MH02 | Trang tìm kiếm | `/` | Home — search bar + tài liệu mới |
| MH03 | Kết quả tìm kiếm | `/search?q=...` | Danh sách kết quả + filters |
| MH04 | Chi tiết tài liệu | `/documents/{id}` | Metadata + preview/download |
| MH05 | Preview | `/documents/{id}/preview` | PDF/Image viewer |
| MH06 | Profile | `/profile` | Xem/sửa thông tin cá nhân |

### Admin Screens (9 màn hình)

| # | Màn hình | URL | Mô tả |
|---|----------|-----|-------|
| MH07 | Dashboard | `/admin/dashboard` | Thống kê tổng quan |
| MH08 | Quản lý tài liệu | `/admin/documents` | Bảng danh sách + filter |
| MH09 | Upload tài liệu | `/admin/documents/upload` | Form upload |
| MH10 | Sửa tài liệu | `/admin/documents/{id}/edit` | Form sửa metadata |
| MH11 | Phiên bản | `/admin/documents/{id}/versions` | Lịch sử version |
| MH12 | Quản lý danh mục | `/admin/categories` | CRUD cây phân cấp |
| MH13 | Quản lý phòng ban | `/admin/departments` | CRUD bảng |
| MH14 | Quản lý tags | `/admin/tags` | CRUD bảng |
| MH15 | Quản lý users | `/admin/users` | CRUD bảng |

> **Ghi chú**: Admin cũng truy cập được tất cả User Screens (MH01–MH06).

---

## Shared Components (Dùng chung)

| Component | Mô tả | Dùng ở |
|-----------|-------|--------|
| Navbar | Logo, search mini, user dropdown | Tất cả (trừ Login) |
| Admin Sidebar | Menu điều hướng admin | MH07–MH15 |
| Pagination | Phân trang | MH03, MH08, MH15 |
| Data Table | Bảng dữ liệu có sort/filter | MH08, MH13, MH14, MH15 |
| Modal / Dialog | Confirm delete, form nhỏ | CRUD operations |
| Toast / Notification | Thông báo thành công/lỗi | Tất cả |
| File Upload Zone | Drag & drop file | MH09, MH11 |
| Tag Input | Chọn/thêm tags | MH09, MH10 |
| Tree View | Hiển thị cây phân cấp | MH12 |
| Breadcrumb | Đường dẫn điều hướng | MH04, MH09, MH10 |
