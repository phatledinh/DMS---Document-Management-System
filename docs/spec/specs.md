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
| 3   | Tìm kiếm full-text      | Tìm kiếm qua Elasticsearch trong tiêu đề + mô tả + nội dung file                  |
| 4   | Permission-aware Search | Kết quả tìm kiếm chỉ bao gồm tài liệu user hiện tại có quyền xem                  |
| 5   | Preview tài liệu        | Xem trực tiếp PDF; Word/Excel được convert sang PDF hoặc HTML preview bởi backend |
| 6   | Download tài liệu       | Tải file gốc theo quyền truy cập                                                  |
| 7   | Quản lý phiên bản       | Lịch sử phiên bản, upload version mới, chọn version hiện hành                     |
| 8   | Quản lý người dùng      | CRUD user, phân quyền Admin/User                                                  |
| 9   | Dashboard thống kê      | Thống kê tài liệu, lượt xem, lượt tải, từ khóa tìm kiếm                           |
| 10  | Xác thực & Phân quyền   | JWT + Refresh Token, RBAC (Admin/User), phân quyền truy cập tài liệu              |
| 11  | Audit & Access Log      | Ghi nhận upload, update metadata, delete, preview, download và search keyword     |

### Ngoài phạm vi (Out of Scope)

Không có hạng mục bị loại do chia giai đoạn; các năng lực OCR, S3-compatible object storage và hardening production nằm trong phạm vi thiết kế hệ thống hiện tại. Môi trường dev dùng MinIO; production dùng Cloudflare R2.

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
- Elasticsearch query phải filter theo quyền truy cập trước khi trả kết quả, không search xong rồi mới loại bỏ ở frontend.
- User không có quyền không được nhìn thấy title, snippet, metadata hoặc download URL của tài liệu.
- Admin có quyền quản trị toàn bộ metadata và lifecycle tài liệu.

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

Tìm kiếm là chức năng cốt lõi và được thực thi bởi Elasticsearch.

| Nhóm yêu cầu  | Chi tiết                                                                                        |
| ------------- | ----------------------------------------------------------------------------------------------- |
| Search fields | `title`, `description`, `extracted_content`, `document_code`, `tags`                            |
| Query type    | Multi-match query, exact match cho mã tài liệu, fuzzy search cho lỗi chính tả                   |
| Filters       | Category, department, tag, file type, owner/uploader, date range, document status, access level |
| Sorting       | Relevance, createdAt, updatedAt, viewCount, downloadCount, title                                |
| Highlight     | Elasticsearch native highlight cho `title`, `description`, `extracted_content`                  |
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
| `PROCESSING`        | File đã upload, đang trích xuất nội dung hoặc index vào Elasticsearch |       Không       |
| `INDEXED`           | Tài liệu đã sẵn sàng để search, preview, download                     | Có, nếu có quyền  |
| `EXTRACTION_FAILED` | Lỗi trích xuất nội dung hoặc index                                    |       Không       |
| `ARCHIVED`          | Tài liệu ngưng sử dụng nhưng vẫn giữ lịch sử                          |  Không mặc định   |
| `DELETED`           | Xóa mềm, có thể restore bởi Admin                                     |       Không       |

Business rules:

- Search mặc định chỉ trả về tài liệu `INDEXED`.
- Tài liệu `DELETED` không xuất hiện trong search, preview hoặc download.
- Hệ thống tự động retry extraction/indexing mỗi 30 phút cho tài liệu `EXTRACTION_FAILED` do lỗi xử lý/index tạm thời.
- Admin có thể xem tài liệu lỗi xử lý để retry extraction/indexing thủ công.
- Soft delete không xóa file vật lý ngay lập tức.

---

## 8. Quản lý phiên bản tài liệu

| Rule                 | Mô tả                                                                                                 |
| -------------------- | ----------------------------------------------------------------------------------------------------- |
| Không mất version cũ | Upload version mới không ghi đè file/version cũ                                                       |
| Current version      | Search, preview và download mặc định sử dụng version hiện hành                                        |
| Version history      | Admin có thể xem lịch sử version, uploader, thời gian upload và changelog                             |
| Re-index             | Khi version hiện hành thay đổi, hệ thống phải trích xuất lại nội dung và cập nhật Elasticsearch index |
| Restore              | Admin có thể chọn version cũ làm version hiện hành nếu cần                                            |

---

## 9. Audit & Access Log

Hệ thống cần ghi nhận các hành động quan trọng để phục vụ dashboard, truy vết và kiểm toán nội bộ.

| Action                  | Actor      | Dữ liệu cần ghi nhận                                         |
| ----------------------- | ---------- | ------------------------------------------------------------ |
| Upload document         | Admin      | userId, documentId, fileName, fileType, fileSize, timestamp  |
| Update metadata         | Admin      | userId, documentId, changedFields, timestamp                 |
| Delete/Restore document | Admin      | userId, documentId, action, timestamp                        |
| Preview document        | Admin/User | userId, documentId, timestamp                                |
| Download document       | Admin/User | userId, documentId, timestamp                                |
| Search                  | Admin/User | userId, keyword, filters, resultCount, searchTime, timestamp |

---

## 10. Yêu cầu phi chức năng

| #   | Yêu cầu                | Chi tiết                                                                                               |
| --- | ---------------------- | ------------------------------------------------------------------------------------------------------ |
| 1   | **Search Performance** | P95 search latency < 500ms với < 10k documents trên Elasticsearch single-node                          |
| 2   | **Indexing SLA**       | Tài liệu upload thành công được trích xuất và index trong vòng 60 giây với file hợp lệ                 |
| 3   | **Upload Performance** | File tối đa 50 MB upload không timeout trong điều kiện mạng nội bộ ổn định                             |
| 4   | **Security**           | Tất cả API trừ login/refresh yêu cầu JWT; mật khẩu hash bằng BCrypt; Refresh Token lưu HttpOnly Cookie |
| 5   | **Authorization**      | Search, preview, download và metadata detail phải kiểm tra quyền truy cập tài liệu                     |
| 6   | **Availability**       | Hệ thống hoạt động 99% uptime trong giờ làm việc                                                       |
| 7   | **Scalability**        | Kiến trúc Elasticsearch-first, cho phép mở rộng cluster search và Cloudflare R2/S3-compatible object storage |
| 8   | **Data Integrity**     | Soft delete cho mọi entity chính, không mất dữ liệu; version cũ không bị ghi đè                        |
| 9   | **API Standard**       | RESTful API, OpenAPI 3 / Swagger documentation                                                         |
| 10  | **Response Format**    | Tất cả endpoint trả JSON thống nhất qua `ApiResponse<T>`                                               |
| 11  | **Preview Safety**     | Nội dung preview phải được sanitize khi render HTML để tránh XSS                                       |

---

## 11. Acceptance Criteria

| #   | Tiêu chí nghiệm thu                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------ |
| 1   | Admin có thể upload file hợp lệ, metadata được lưu và tài liệu được index vào Elasticsearch.           |
| 2   | User có thể tìm tài liệu theo từ khóa trong title, description và extracted content.                   |
| 3   | Kết quả search trả về trong P95 < 500ms với dưới 10k documents.                                        |
| 4   | User không thấy tài liệu không có quyền truy cập trong search, preview, download hoặc metadata detail. |
| 5   | Search result có highlight snippet cho nội dung khớp nếu Elasticsearch trả về highlight.               |
| 6   | File không hợp lệ, file vượt quá 50 MB hoặc file thuộc extension bị chặn phải bị từ chối.              |
| 7   | Tài liệu bị xóa mềm không xuất hiện trong search và không thể preview/download bởi User.               |
| 8   | Upload version mới không làm mất version cũ và search mặc định dùng version hiện hành.                 |
| 9   | Preview PDF hoạt động trực tiếp trên browser; Word/Excel có preview qua bản convert PDF/HTML.          |
| 10  | Hệ thống ghi access log cho preview/download và search history cho truy vấn tìm kiếm.                  |
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
