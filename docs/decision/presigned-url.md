# Thiết Kế: Presigned URL cho Upload & Download

> **Trạng thái:** Nội dung thiết kế trong file này đã được gộp vào các tài liệu chính (`API_SPEC.md`, `DATABASE.md`, `design.md`, `sa/sa.md`, `sa/server.md`, `sa/techstack.md`). File này được giữ như ADR/tài liệu tham khảo quyết định.
>
> Doc thiết kế riêng cho việc chuyển luồng file (upload + download/preview) sang **Presigned URL** với object storage (MinIO dev / Cloudflare R2 prod qua S3-compatible API).
>
> Doc này mô tả luồng mới độc lập, kèm danh sách thay đổi cần áp lên [API_SPEC.md](../API_SPEC.md), [design.md](../design.md), [DATABASE.md](../DATABASE.md) và [sa/sa.md](./sa.md). Chưa chỉnh sửa các doc gốc cho tới khi kế hoạch này được chốt.

---

## 1. Bối cảnh & Động lực

### Kiến trúc hiện tại (byte đi qua backend)

Trong spec hiện tại, toàn bộ byte của file đều đi qua Spring Boot:

- **Upload**: `POST /documents` nhận `multipart/form-data`, backend đọc stream → Tika detect MIME → validate → tự tạo object key → PUT lên storage → ghi PostgreSQL trong transaction.
- **Download**: `GET /documents/{id}/download` — backend đọc object từ storage rồi stream về client, tăng `download_count`, ghi `access_logs`.
- **Preview**: `GET /documents/{id}/preview` — backend stream/convert rồi trả về.

### Vấn đề khi scale

- Backend trở thành proxy cho mọi byte → tốn CPU/RAM/bandwidth, giới hạn concurrency, khó scale ngang.
- File 50MB × nhiều user đồng thời làm nghẽn thread pool của app server.

### Mục tiêu của presigned URL

Cho client nói chuyện **trực tiếp** với object storage cho phần truyền byte, backend chỉ ký URL (cấp quyền có thời hạn) và giữ metadata/audience. Backend không còn nằm trên đường truyền byte.

> **Đánh đổi cần chấp nhận**: một số ràng buộc bảo mật/logging trong spec hiện tại giả định backend thấy được từng request byte. Presigned URL phá vỡ giả định đó. Phần §5 và §6 xử lý chính xác các đánh đổi này.

---

## 2. Nguyên tắc thiết kế

1. **PostgreSQL vẫn là source of truth** cho metadata, audience, lifecycle, current version, object key. Không đổi.
2. **Backend luôn kiểm tra quyền (`DocumentAccessPolicyService`) TRƯỚC khi ký bất kỳ URL nào.** Presigned URL chỉ được cấp sau khi pass resource access policy. Hiện tại policy permissive, sau này enforcement dựa trên audience tài liệu/danh mục.
3. **Presigned URL có thời hạn ngắn** (TTL nhỏ) và **scope hẹp** (đúng 1 object key, đúng 1 method).
4. **Object key luôn do backend sinh** (UUID/generated key), client không bao giờ chọn key. Chống path traversal / ghi đè.
5. **Validation không mất đi, chỉ dịch chuyển**: từ đồng bộ (lúc nhận byte) sang bất đồng bộ (sau khi byte đã vào storage) + ràng buộc ký trước (content-length, content-type).

---

## 3. Luồng Upload bằng Presigned PUT

Upload chuyển từ 1 request multipart thành flow 3 bước: **init → client PUT thẳng lên storage → complete**.

```text
┌────────┐   1. POST /documents/upload-init      ┌──────────┐
│ Client │ ─────────────────────────────────────▶│ Backend  │
│        │   {title, categoryId, fileName,       │          │
│        │    fileSize, contentType, ...audience}     │  - check quyền ADMIN
│        │                                        │  - validate metadata + kích thước + ext/contentType khai báo
│        │                                        │  - sinh objectKey (UUID)
│        │                                        │  - tạo row documents status=AWAITING_UPLOAD
│        │   ◀──── {documentId, uploadUrl,        │  - ký presigned PUT (TTL ngắn)
│        │          objectKey, expiresIn}         │
└───┬────┘                                        └──────────┘
    │
    │   2. PUT <uploadUrl>  (byte đi THẲNG lên storage, không qua backend)
    │      Header: Content-Type, Content-Length khớp giá trị đã ký
    ▼
┌──────────────┐
│ Object Store │  (MinIO / R2)
└──────────────┘
    │
    │   3. POST /documents/{id}/upload-complete
    ▼
┌──────────┐
│ Backend  │  - HEAD object: xác nhận tồn tại + đúng size
│          │  - đọc phần đầu object (hoặc full) → Tika detect MIME thực tế
│          │  - validate: MIME khớp ext? nằm trong allowlist? không phải dangerous type?
│          │      → nếu fail: xóa object + set document EXTRACTION_FAILED/xóa row, trả 400/415
│          │  - set status=PROCESSING, commit PostgreSQL
│          │  - after-commit: extraction + preview convert + refresh PostgreSQL search vector (async)
└──────────┘
```

### Chi tiết từng bước

**Bước 1 — `POST /documents/upload-init`** (👑 Admin)

Backend nhận metadata + thông tin file **khai báo** (chưa có byte):

- Validate metadata nghiệp vụ (category tồn tại, audience hợp lệ, document_code chưa trùng...).
- Validate `fileSize <= 50MB` (từ chối sớm nếu client khai vượt).
- Validate `contentType` + đuôi `fileName` khai báo nằm trong allowlist, không thuộc dangerous extension. *(Đây là validate sơ bộ dựa trên khai báo — validate thật bằng Tika ở bước 3.)*
- Sinh `objectKey` = UUID, tạo row `documents` với `status = AWAITING_UPLOAD`, lưu `objectKey`, `file_name` (sanitized), `file_size` khai báo.
- Ký **presigned PUT URL** ràng buộc:
  - Đúng `objectKey`.
  - `Content-Length` = fileSize khai báo (hoặc range chặt).
  - `Content-Type` cố định = contentType khai báo.
  - TTL ngắn (khuyến nghị **5 phút**).

**Bước 2 — Client PUT thẳng lên storage**

- Client dùng `uploadUrl` PUT nguyên file, set đúng `Content-Type` và `Content-Length` đã ký. Byte **không** qua backend.
- Nếu header không khớp giá trị đã ký → storage tự từ chối.

**Bước 3 — `POST /documents/{id}/upload-complete`** (👑 Admin)

- `HEAD` object để xác nhận đã tồn tại + size đúng.
- Đọc object (stream từ storage về backend, chỉ 1 lần duy nhất cho việc này) → **Tika detect MIME thực tế** → so với extension → check allowlist + dangerous type. Đây là chốt chặn bảo mật thật sự, không tin `contentType` client khai.
  - Fail → xóa object khỏi storage, đánh dấu/xóa row, trả `415 MIME_TYPE_MISMATCH` / `DANGEROUS_FILE_TYPE`.
- Pass → `status = PROCESSING`, commit PostgreSQL.
- **After-commit event**: extraction → preview convert → refresh PostgreSQL search vector (giữ nguyên pipeline async hiện có).

> Backend vẫn phải đọc object 1 lần ở bước 3 để chạy Tika + extraction. Presigned upload tiết kiệm được chiều **client→backend** (không proxy khi nhận), nhưng backend vẫn cần pull object cho extraction. Đây là điểm khác biệt cốt lõi so với "backend không bao giờ chạm byte".

### Orphan cleanup

- Row `AWAITING_UPLOAD` quá TTL mà không có `upload-complete` → scheduled job xóa row + object (nếu có). Tái dùng "Storage cleanup job" trong [sa/sa.md §6](./sa.md).
- Object tồn tại nhưng không được PostgreSQL tham chiếu → orphan cleanup xóa (đã có sẵn trong strategy hiện tại).

---

## 4. Luồng Download / Preview bằng Presigned GET

```text
┌────────┐  GET /documents/{id}/download-url   ┌──────────┐
│ Client │ ───────────────────────────────────▶│ Backend  │
│        │                                       │  - check resource access policy (DocumentAccessPolicyService)
│        │                                       │  - status hợp lệ (không DELETED cho User...)
│        │                                       │  - tăng download_count
│        │                                       │  - ghi access_logs (DOWNLOAD, granted=true)
│        │  ◀── {url, expiresIn, fileName}       │  - ký presigned GET (TTL ngắn)
└───┬────┘                                       │      + response-content-disposition=attachment
    │                                            └──────────┘
    │  GET <url>  (byte đi THẲNG từ storage)
    ▼
┌──────────────┐
│ Object Store │
└──────────────┘
```

### Điểm mấu chốt

- Backend **ký URL rồi mới trả**, và **kiểm tra resource access policy + ghi log ngay tại thời điểm ký** — không phải tại thời điểm client tải thật. Đây là chỗ dịch chuyển ngữ nghĩa của `download_count` / `access_logs` (§6).
- Presigned GET có thể set `response-content-disposition`:
  - Download → `attachment; filename="<file_name gốc>"`.
  - Preview PDF/image → `inline`.
- TTL ngắn (khuyến nghị **2–5 phút**), đủ để client bắt đầu tải.

### Preview với file cần convert (DOC/DOCX/XLS/XLSX)

Preview Office **không** trả presigned GET của file gốc, vì file gốc không phải định dạng xem được và convert cần LibreOffice ở backend. Hai lựa chọn:

- **(Khuyến nghị)** Pre-generate preview artifact (PDF/HTML sanitized) lúc `upload-complete`/refresh search vector, lưu vào storage với key riêng (`preview/{objectKey}.pdf`). Khi user preview → ký presigned GET cho **artifact** đó.
- Hoặc giữ preview Office stream qua backend như cũ (chỉ file gốc dạng PDF/image mới dùng presigned GET). Đơn giản hơn nhưng preview Office vẫn qua backend.

PDF/image gốc: preview = presigned GET `inline` trực tiếp, không cần convert.

---

## 5. Bảo mật

| Rủi ro | Xử lý |
|--------|-------|
| URL bị chia sẻ / leak | TTL ngắn (2–5 phút). URL hết hạn nhanh, giảm cửa sổ lạm dụng. |
| Client upload sai loại file | Tika validate ở `upload-complete` (chốt chặn thật). `contentType` ký ở init chỉ là ràng buộc sơ bộ. |
| Client ghi đè object của tài liệu khác | `objectKey` do backend sinh (UUID), presigned PUT scope đúng 1 key. Client không chọn được key. |
| Upload vượt 50MB | Ký presigned PUT với ràng buộc `Content-Length`. Storage từ chối nếu vượt. Kiểm lại size bằng HEAD ở bước complete. |
| Bypass resource access policy để tải file | Presigned URL chỉ cấp SAU khi `DocumentAccessPolicyService` pass. Không có endpoint nào trả object key thô ra ngoài. |
| Enumerate object key | Key là UUID, không đoán được; và storage bucket **không** để public — chỉ truy cập được qua presigned URL. |
| Dangerous extension (.exe, .js...) | Chặn ở cả init (khai báo) và complete (Tika thực tế). |

**Cấu hình bucket bắt buộc:**
- Bucket **private hoàn toàn**, không có public-read policy. Mọi truy cập chỉ qua presigned URL.
- CORS cho phép PUT/GET từ origin frontend (cần cho browser upload/download trực tiếp).
- Credential ký URL (access key/secret) chỉ nằm ở backend, không lộ ra client.

**Ràng buộc từ spec vẫn giữ:** "User không được thấy title/snippet/URL của tài liệu không có quyền" → vì URL chỉ cấp sau resource access policy check, user không quyền không bao giờ nhận được presigned URL. Đảm bảo endpoint trả `403/404` không kèm URL.

---

## 6. Đánh đổi về Logging & Counter (QUAN TRỌNG)

Đây là thay đổi ngữ nghĩa lớn nhất và cần chốt rõ với team.

| Vấn đề | Kiến trúc cũ (stream qua backend) | Với presigned URL |
|--------|-----------------------------------|-------------------|
| Thời điểm tăng `download_count` | Khi byte thật sự được tải | Khi backend **ký URL** (không đảm bảo client tải thành công) |
| `access_logs` action=DOWNLOAD | Ghi khi tải thật | Ghi khi cấp URL |
| Đo được tải-thành-công hay không | Có | Không (backend không thấy GET thật lên storage) |

**Quyết định đề xuất:** chấp nhận đếm **"lượt cấp quyền tải"** thay vì "lượt tải hoàn tất". Với DMS nội bộ, sai số này chấp nhận được và đơn giản hơn nhiều.

**Nếu cần đếm chính xác lượt tải thật** (tùy chọn, không khuyến nghị cho MVP):
- Bật **access log của object storage** (S3/R2 access logs) → định kỳ ingest về `access_logs`. Phức tạp, thêm pipeline, độ trễ.
- Hoặc giữ download stream qua backend cho tài liệu nhạy cảm, presigned chỉ cho tài liệu PUBLIC. (Hybrid.)

> Khuyến nghị MVP: đếm tại thời điểm ký. Ghi chú rõ trong Logging Rules rằng `DOWNLOAD` = "cấp URL tải", không phải "tải hoàn tất".

---

## 7. Thay đổi API (đề xuất áp lên API_SPEC.md)

### Endpoint mới

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| POST | `/documents/upload-init` | 👑 | Khởi tạo upload: validate metadata, sinh objectKey, trả presigned PUT URL |
| POST | `/documents/{id}/upload-complete` | 👑 | Xác nhận đã PUT xong: Tika validate, chuyển PROCESSING, trigger extraction |
| GET | `/documents/{id}/download-url` | 🔒 | Trả presigned GET URL (attachment), check resource access policy, tăng download_count, log |
| GET | `/documents/{id}/preview-url` | 🔒 | Trả presigned GET URL (inline) cho PDF/image gốc hoặc preview artifact |
| POST | `/documents/{id}/versions/init` | 👑 | Như upload-init nhưng cho version mới |
| POST | `/documents/{id}/versions/{versionId}/complete` | 👑 | Như upload-complete cho version |
| GET | `/documents/{id}/versions/{versionId}/download-url` | 🔒 | Presigned GET cho version cũ, log VERSION_DOWNLOAD |

### Endpoint thay đổi hành vi / có thể deprecate

- `POST /documents` (multipart) → thay bằng cặp `upload-init` + `upload-complete`. Có thể giữ lại multipart làm fallback cho file nhỏ, hoặc bỏ hẳn.
- `GET /documents/{id}/download` → thay bằng `/download-url` (trả JSON chứa URL thay vì stream byte). Nếu muốn tương thích ngược, endpoint cũ có thể trả `302 Redirect` tới presigned URL.
- `GET /documents/{id}/preview` → tương tự với `/preview-url` cho PDF/image; Office preview tùy chọn giữ stream.
- `POST /documents/{id}/versions` (multipart) → tách thành init/complete.

### Ví dụ response

**`POST /documents/upload-init` (200):**
```json
{
  "success": true,
  "data": {
    "documentId": 42,
    "objectKey": "8f3b...uuid",
    "uploadUrl": "https://<storage>/bucket/8f3b...?X-Amz-Signature=...",
    "method": "PUT",
    "requiredHeaders": { "Content-Type": "application/pdf" },
    "expiresIn": 300
  }
}
```

**`GET /documents/{id}/download-url` (200):**
```json
{
  "success": true,
  "data": {
    "url": "https://<storage>/bucket/8f3b...?X-Amz-Signature=...&response-content-disposition=attachment",
    "fileName": "ISO_9001_QA_Process.pdf",
    "expiresIn": 300
  }
}
```

### Mã lỗi mới (thêm vào bảng Error Codes)

| Code | Mô tả |
|------|-------|
| `UPLOAD_NOT_COMPLETED` | Gọi complete nhưng object chưa tồn tại trên storage |
| `UPLOAD_SIZE_MISMATCH` | Size object thực tế khác size đã khai/ký |
| `PRESIGN_FAILED` | Không ký được URL (lỗi cấu hình storage/credential) |
| `DOCUMENT_NOT_READY` | Xin download/preview URL khi document chưa `INDEXED` (tùy policy) |

---

## 8. Thay đổi Database (đề xuất áp lên DATABASE.md / design.md)

- **`documents.status`**: thêm giá trị `AWAITING_UPLOAD` vào enum `DocumentStatus` cho giai đoạn giữa init và complete.
  - Lifecycle mới: `AWAITING_UPLOAD -> PROCESSING -> INDEXED / EXTRACTION_FAILED`, và `AWAITING_UPLOAD -> (cleanup xóa)` nếu quá hạn.
- Không cần cột mới bắt buộc: `storage_path` đã lưu object key. Có thể thêm (tùy chọn):
  - `upload_expires_at` (TIMESTAMP, nullable) — hạn chót để complete, phục vụ cleanup.
  - `preview_object_key` (VARCHAR, nullable) — nếu pre-generate preview artifact riêng.
- `document_versions` áp cùng flow init/complete; version chỉ được "current" sau khi complete thành công.

---

## 9. Thay đổi Architecture (đề xuất áp lên sa/sa.md)

- **Upload ordering** (§3 Consistency & Sync) viết lại:
  > Backend sinh object key + tạo row `AWAITING_UPLOAD` → client PUT thẳng lên storage bằng presigned URL → `upload-complete` chạy Tika validate → commit `PROCESSING` → after-commit extraction/index. Nếu client không complete trong TTL, cleanup job xóa row + object.
- **StorageService** thêm method: `generatePresignedPutUrl(objectKey, contentType, contentLength, ttl)` và `generatePresignedGetUrl(objectKey, contentDisposition, ttl)`.
- **Background jobs** (§6): mở rộng "Storage cleanup" để xử lý row `AWAITING_UPLOAD` quá hạn.
- **Sequence diagram** upload/download cập nhật theo §3, §4 của doc này.
- **Sơ đồ high-level**: thêm mũi tên trực tiếp Client ↔ Object Store (ngoài đường Client ↔ Backend).

---

## 10. Frontend

- **Upload** (`FileUploadZone`): đổi từ POST multipart 1 phát thành: gọi `upload-init` → `axios.put(uploadUrl, file, { headers })` thẳng lên storage (theo dõi progress) → gọi `upload-complete`. Xử lý retry nếu PUT fail giữa chừng.
- **Download**: gọi `download-url` → mở `window.location = url` hoặc tạo thẻ `<a download>`. Không tải qua axios rồi blob nữa (để byte đi thẳng).
- **Preview PDF**: đưa presigned `preview-url` vào pdf.js/React-PDF. Office preview: nhận HTML sanitized hoặc presigned PDF artifact tùy §4.
- **CORS**: cần bucket cấu hình CORS cho origin frontend, nếu không browser sẽ chặn PUT/GET trực tiếp.

---

## 11. Roadmap triển khai đề xuất

1. **Storage layer**: thêm presign methods vào `StorageService`, cấu hình bucket private + CORS (MinIO dev trước).
2. **Download/Preview trước** (rủi ro thấp hơn): `download-url` / `preview-url` cho PDF/image. Giữ upload multipart cũ tạm thời.
3. **Upload sau**: `upload-init` + `upload-complete`, thêm `AWAITING_UPLOAD`, cleanup job.
4. **Versions**: áp init/complete + download-url cho version.
5. **FE**: cập nhật upload zone, download, preview.
6. **Cleanup**: bỏ/redirect các endpoint stream cũ, cập nhật docs gốc, security matrix, logging rules.
7. **Test**: Testcontainers với MinIO — test full flow init→PUT→complete→refresh search vector và presigned GET, test resource access policy chặn cấp URL, test TTL hết hạn.

---

## 12. Quyết định đã chốt

> Chốt ngày 2026-07-24. Các quyết định này là cơ sở để áp thay đổi lên docs gốc.

| # | Vấn đề | Quyết định |
|---|--------|-----------|
| 1 | Thời điểm đếm `download_count` / ghi `access_logs` | **Tại thời điểm backend ký URL** (không phải tải hoàn tất). Ghi rõ trong Logging Rules `DOWNLOAD` = "cấp URL tải". Chấp nhận sai số cho DMS nội bộ (§6). |
| 2 | Preview Office (DOC/DOCX/XLS/XLSX) | **Pre-generate preview artifact** (PDF/HTML sanitized) lúc xử lý nền/refresh search vector, lưu key `preview/{objectKey}`; preview = ký presigned GET cho artifact. Thêm cột `preview_object_key`. |
| 3 | Endpoint multipart cũ (`POST /documents` multipart) | **Bỏ hẳn.** Chỉ dùng flow `upload-init` + `upload-complete`. Không giữ fallback. |
| 4 | TTL presigned URL | **Upload PUT: 5 phút. Download/Preview GET: 5 phút.** Thống nhất `expiresIn = 300`. |
| 5 | Trạng thái được cấp download/preview URL | **Chỉ `INDEXED`** cho User. Admin được thêm `ARCHIVED`. Không cấp cho `AWAITING_UPLOAD`/`PROCESSING`/`EXTRACTION_FAILED`/`DELETED` → trả `409 DOCUMENT_NOT_READY` hoặc `404` theo resource access policy. |
