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

| # | Chức năng | Mô tả |
|---|-----------|-------|
| 1 | Quản lý tài liệu | CRUD tài liệu (upload, sửa metadata, xóa mềm) |
| 2 | Phân loại tài liệu | Quản lý danh mục (cây phân cấp), phòng ban, tags |
| 3 | Tìm kiếm full-text | Tìm kiếm trong tiêu đề + mô tả + nội dung file |
| 4 | Preview tài liệu | Xem trực tiếp PDF, Word, Excel trên trình duyệt |
| 5 | Download tài liệu | Tải file gốc |
| 6 | Quản lý phiên bản | Lịch sử phiên bản, upload version mới |
| 7 | Quản lý người dùng | CRUD user, phân quyền Admin/User |
| 8 | Dashboard thống kê | Thống kê tài liệu, lượt xem, lượt tải |
| 9 | Xác thực & Phân quyền | JWT + Refresh Token, RBAC (Admin/User) |

### Ngoài phạm vi (Out of Scope — Phase 1)

- OCR cho PDF scan và ảnh (Phase 2)
- Elasticsearch migration (Phase 2)
- Cloud storage S3/MinIO (Phase 2)
- Thông báo real-time (WebSocket)
- Mobile app

---

## 3. Đối tượng sử dụng (Actors)

| Actor | Vai trò | Quyền hạn |
|-------|---------|-----------|
| **ADMIN** | Quản trị viên | Upload, Edit, Delete tài liệu; Quản lý categories/tags/departments/users; Xem dashboard thống kê |
| **USER** | Nhân viên | Tìm kiếm, Đọc (preview), Tải (download) tài liệu; Xem & sửa profile cá nhân |

---

## 4. Loại tài liệu hỗ trợ

| Loại | Định dạng | Trích xuất nội dung | Ghi chú |
|------|-----------|:---:|---------|
| PDF (Text) | `.pdf` | ✅ | Apache PDFBox |
| PDF (Scanned) | `.pdf` | 🔮 Phase 2 | Cần OCR (Tesseract) |
| Word (mới) | `.docx` | ✅ | Apache POI - XWPF |
| Word (cũ) | `.doc` | ✅ | Apache POI - HWPF |
| Excel (mới) | `.xlsx` | ✅ | Apache POI |
| Excel (cũ) | `.xls` | ✅ | Apache POI |
| Ảnh | `.jpg`, `.png`, `.tiff` | 🔮 Phase 2 | OCR (Tesseract) |

### Upload Constraints

| Ràng buộc | Giá trị |
|-----------|---------|
| Kích thước file tối đa | 50 MB |
| Số file mỗi request | 1 |
| Đặt tên file lưu trữ | UUID-based (tránh trùng lặp) |

---

## 5. Yêu cầu phi chức năng

| # | Yêu cầu | Chi tiết |
|---|---------|----------|
| 1 | **Performance** | Tìm kiếm trả kết quả < 500ms cho < 10k documents (Phase 1) |
| 2 | **Security** | JWT Authentication, RBAC, mật khẩu BCrypt, Refresh Token HttpOnly Cookie |
| 3 | **Availability** | Hệ thống hoạt động 99% uptime trong giờ làm việc |
| 4 | **Scalability** | Kiến trúc cho phép mở rộng lên Elasticsearch + S3 ở Phase 2 |
| 5 | **Data Integrity** | Soft delete cho mọi entity chính, không mất dữ liệu |
| 6 | **API Standard** | RESTful API, OpenAPI 3 / Swagger documentation |
| 7 | **Response Format** | Tất cả endpoint trả JSON thống nhất qua `ApiResponse<T>` |

---

## 6. Tài liệu liên quan

| Tài liệu | Đường dẫn |
|-----------|-----------|
| Luồng nghiệp vụ chính | [buss_mainflow.md](./buss_mainflow.md) |
| Phân rã phân hệ | [phan_ra_phan_he_he_thong.md](./phan_ra_phan_he_he_thong.md) |
| Phân rã tính năng | [phan_ra_tinh_nang.md](./phan_ra_tinh_nang.md) |
| Phân rã màn hình | [phan_ra_man_hinh.md](./phan_ra_man_hinh.md) |
| Thiết kế chi tiết | [../design.md](../design.md) |
| System Architecture | [../sa/sa.md](../sa/sa.md) |
| Tech Stack | [../sa/techstack.md](../sa/techstack.md) |
| Server & Deployment | [../sa/server.md](../sa/server.md) |
