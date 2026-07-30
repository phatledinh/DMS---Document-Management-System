# Theo dõi tiến độ triển khai dự án DMS

File này dùng để theo dõi tiến độ triển khai theo từng milestone. Khi hoàn thành một công việc, đổi `[ ]` thành `[x]` và cập nhật ghi chú nếu cần.

## Quy ước trạng thái

- `[ ]` Chưa làm
- `[x]` Hoàn thành
- `Ghi chú:` mô tả ngắn kết quả, blocker hoặc quyết định liên quan

---

## Milestone 0 — Chuẩn hóa nền tảng dự án

- [x] Rà soát cấu trúc backend Spring Boot hiện tại
  - Ghi chú: Backend đã có Spring Boot 4.1.0, Java 25, dependencies chính cho JPA/Security/AMQP/Redis/Flyway/S3/Tika/PDFBox/POI/JODConverter/MapStruct/ShedLock. Đã sửa smoke test trỏ đúng `com.dms.DmsApplication`.
- [x] Rà soát cấu trúc frontend React/Vite hiện tại
  - Ghi chú: Chưa có thư mục frontend/package.json trong repository; service frontend trong Docker Compose hiện đang comment.
- [x] Rà soát Docker Compose và các service dev
  - Ghi chú: Compose đã khai báo backend, worker, PostgreSQL pgvector, RabbitMQ management, Redis, MinIO. Đã bổ sung actuator dependency để khớp healthcheck `/api/v1/actuator/health`.
- [x] Xác nhận backend chạy được với profile `dev`
  - Ghi chú: Backend container chạy profile `dev`, healthcheck `/api/v1/actuator/health` trả `UP`, container trạng thái healthy. Đã thêm SecurityConfig cho phép public health endpoint và sửa biến Redis trong Compose sang `SPRING_DATA_REDIS_HOST/PORT`.
- [x] Xác nhận worker chạy được với profile `worker,dev`
  - Ghi chú: Worker container chạy profile `worker,dev`, kết nối PostgreSQL thành công và khởi động app thành công.
- [x] Xác nhận PostgreSQL, RabbitMQ, Redis, MinIO chạy ổn định qua Docker Compose
  - Ghi chú: `docker compose ps` xác nhận PostgreSQL, RabbitMQ, Redis, MinIO đều healthy; backend healthy; worker up.

---

## Milestone 1 — MVP lõi

### 1.1 Database schema

- [x] Tạo Flyway migration cho bảng user/department và role quản trị tối thiểu
  - Ghi chú: Đã tạo trong V1__init.sql
- [x] Tạo Flyway migration cho bảng `documents`
  - Ghi chú: Đã tạo trong V1__init.sql
- [x] Tạo Flyway migration cho bảng `document_versions`
  - Ghi chú: Đã tạo trong V1__init.sql
- [x] Tạo Flyway migration cho bảng `document_contents`
  - Ghi chú: Đã tạo trong V1__init.sql
- [x] Tạo Flyway migration cho bảng `document_search_index`
  - Ghi chú: Đã tạo trong V1__init.sql
- [x] Tạo Flyway migration cho bảng audience theo phòng ban và user
  - Ghi chú: Đã tạo trong V1__init.sql; các bảng này là điểm móc resource access policy, hiện tại chạy permissive
- [x] Tạo Flyway migration cho `audit_logs`, `access_logs`, `search_logs`
  - Ghi chú: Đã tạo trong V1__init.sql
- [x] Bật PostgreSQL extension `unaccent`
  - Ghi chú: Đã thêm vào V1__init.sql
- [x] Bật PostgreSQL extension `pg_trgm`
  - Ghi chú: Đã thêm vào V1__init.sql
- [x] Tạo index cần thiết cho status, audience, search vector, trash, document code
  - Ghi chú: Đã thêm vào V1__init.sql

### 1.2 Auth, identity và security nền tảng

- [x] Triển khai `POST /api/v1/auth/login`
  - Ghi chú: Đã tạo AuthController/AuthService, BCrypt password check, update last_login, trả access token và set refresh cookie
- [x] Triển khai `POST /api/v1/auth/refresh`
  - Ghi chú: Đã xử lý HttpOnly cookie, validate token trong DB và rotate refresh token
- [x] Triển khai `POST /api/v1/auth/logout`
  - Ghi chú: Revoke refresh token và clear cookie idempotent
- [x] Triển khai `GET /api/v1/users/me`
  - Ghi chú: Endpoint canonical theo API spec; trả về UserResponse và re-check user ACTIVE
- [x] Cấu hình JWT access token
  - Ghi chú: Đã tạo JwtTokenProvider, HS256 JwtEncoder/JwtDecoder, claim userId và role
- [x] Cấu hình refresh token qua HttpOnly cookie
  - Ghi chú: Cookie cấu hình HttpOnly, SameSite=Strict, path /api/v1/auth
- [x] Cấu hình Spring Security filter chain
  - Ghi chú: Đã cấu hình STATELESS session, OAuth2 Resource Server JWT, CORS, JSON 401/403 handlers
- [x] Tạo role `ADMIN` và `USER`
  - Ghi chú: Đã tạo Enum Role và map role claim sang ROLE_* authority
- [x] Seed dữ liệu admin/dev user nếu cần
  - Ghi chú: Đã có script seed admin user trong V1__init.sql

### 1.3 Resource access policy trung tâm

- [x] Tạo `DocumentAccessPolicyService`
  - Ghi chú: Đã có service trung tâm kiểm lifecycle/status, admin archived path, PUBLIC/RESTRICTED audience, owner/shared users/departments/category audience.
- [x] Tạo `CategoryAccessPolicyService`
  - Ghi chú: Đã có service móc nối category audience; hiện mới active-user/admin placeholder cho giai đoạn đầu.
- [x] Xử lý `visibility = PUBLIC`
  - Ghi chú: Mọi active user có thể xem khi document lifecycle/status hợp lệ.
- [x] Xử lý `visibility = RESTRICTED`
  - Ghi chú: Đã kiểm owner, shared users, shared departments và category audience; admin được allow.
- [x] Áp dụng resource access policy cho document list
  - Ghi chú: Đã thêm `GET /documents`; list dùng `DocumentMetadataService` + JPA Specification để lọc status/audience ở DB trước khi phân trang.
- [x] Áp dụng resource access policy cho document detail
  - Ghi chú: Đã thêm `GET /documents/{id}`; detail gọi `DocumentAccessPolicyService.canViewMetadata` trước khi trả metadata và không tăng `view_count`.
- [x] Áp dụng resource access policy cho preview URL
  - Ghi chú: `GET /documents/{id}/preview-url` gọi `DocumentAccessPolicyService.canPreview` trước khi ký URL.
- [x] Áp dụng resource access policy cho download URL
  - Ghi chú: `GET /documents/{id}/download-url` gọi `DocumentAccessPolicyService.canDownload` trước khi ký URL.
- [x] Viết test cơ bản cho resource access policy service
  - Ghi chú: Đã có `DocumentAccessPolicyServiceTest` cover PUBLIC, RESTRICTED owner/user/department, archived admin, processing denied và version status.

### 1.4 Object storage và Presigned URL upload

- [x] Cấu hình S3-compatible client cho MinIO/R2
  - Ghi chú: Đã thêm `StorageProperties`, `StorageConfig` với `S3Client`/`S3Presigner`, endpoint override và path-style access.
- [x] Tạo `ObjectStorageService`
  - Ghi chú: Đã hỗ trợ sinh object key, presigned PUT/GET, HEAD object, mở stream và xóa object.
- [x] Tạo `PresignedUrlService`
  - Ghi chú: Đã triển khai trong `DocumentPresignedUrlService`, bao gồm upload-init/complete và download/preview URL.
- [x] Tạo `FileValidationService`
  - Ghi chú: Đã validate size, sanitize filename, allowlist extension/MIME và dangerous extensions; có unit test.
- [x] Tạo `MimeDetectionService` dùng Apache Tika
  - Ghi chú: Đã dùng Tika detect MIME từ stream object ở bước complete.
- [x] Triển khai `POST /api/v1/documents/upload-init`
  - Ghi chú: Đã thêm `DocumentController` và DTO request/response theo API spec.
- [x] Backend tự sinh `documentCode`
  - Ghi chú: Đã sinh khi `upload-complete` thành công; hiện dùng format `DMS-yyyyMM-random`.
- [x] Backend tự sinh object key UUID/generated
  - Ghi chú: Đã sinh key dạng `documents/{uuid}` trong `ObjectStorageService`.
- [x] Validate file size tối đa 50MB ở upload init
  - Ghi chú: Đã lấy giới hạn từ `app.storage.max-file-size`.
- [x] Validate extension/content type khai báo ở upload init
  - Ghi chú: Đã validate theo allowlist PDF/Office/image trong `FileValidationService`.
- [x] Chặn extension nguy hiểm
  - Ghi chú: Đã chặn exe/sh/bat/cmd/js/html/htm/jar/msi/ps1/vbs.
- [x] Tạo document status `AWAITING_UPLOAD`
  - Ghi chú: `upload-init` lưu document với status `AWAITING_UPLOAD` và `uploadExpiresAt`.
- [x] Trả presigned PUT URL cho client
  - Ghi chú: Response trả URL PUT, method, required headers và expiresIn.
- [x] Triển khai `POST /api/v1/documents/{id}/upload-complete`
  - Ghi chú: Đã kiểm trạng thái/hạn upload, validate object và chuyển sang processing.
- [x] HEAD object storage để xác nhận file tồn tại
  - Ghi chú: `ObjectStorageService.headObject` map object thiếu sang `UPLOAD_NOT_COMPLETED`.
- [x] Verify size thực tế với declared size
  - Ghi chú: Nếu lệch size thì xóa object và trả `UPLOAD_SIZE_MISMATCH`.
- [x] Detect MIME thật bằng Apache Tika
  - Ghi chú: Detect từ object stream và so với extension/allowlist.
- [x] Update document sang `PROCESSING`
  - Ghi chú: Sau validation thành công, clear `uploadExpiresAt` và set `PROCESSING`.
- [x] Publish message RabbitMQ sau DB commit
  - Ghi chú: Đã thêm event `DocumentExtractionRequestedEvent` và `@TransactionalEventListener(AFTER_COMMIT)` publish queue `dms.extract`.

### 1.5 RabbitMQ và worker pipeline cơ bản

- [x] Cấu hình RabbitMQ exchange/queue
  - Ghi chú: Đã thêm topology durable `dms.tasks`, `dms.dlx`, `dms.retry` trong `DocumentProcessingRabbitConfig`.
- [x] Tạo queue `dms.extract`
  - Ghi chú: Queue durable, bind routing key `extract`, có DLX.
- [x] Tạo queue `dms.index`
  - Ghi chú: Queue durable, bind routing key `index`, chuẩn bị cho 1.6 indexing.
- [x] Tạo queue `dms.dlq`
  - Ghi chú: Queue durable nhận message vượt retry/failure cuối qua routing key `dlq`.
- [x] Cấu hình durable queue và persistent message
  - Ghi chú: Queue/exchange durable; publisher set `MessageDeliveryMode.PERSISTENT`.
- [x] Cấu hình manual ack cho worker
  - Ghi chú: `application.yml` và listener dùng manual ack, prefetch 1.
- [x] Thiết kế message contract cho processing job
  - Ghi chú: `DocumentProcessingMessage` gồm taskId/type/documentId/versionId/objectKey/mimeType/attempt/issuedAt.
- [x] Tạo publisher từ API sang RabbitMQ
  - Ghi chú: Upload-complete publish event AFTER_COMMIT, publisher gửi vào exchange `dms.tasks` routing key `extract`.
- [x] Tạo worker listener cho `dms.extract`
  - Ghi chú: `DocumentExtractWorker` active profile `worker`; hiện là skeleton, chưa extract/index thật của 1.6.
- [x] Worker re-read DB state trước khi xử lý
  - Ghi chú: Listener đọc lại `DocumentRepository` theo documentId trước khi gọi pipeline.
- [x] Worker xử lý idempotent
  - Ghi chú: Skip+ack khi document không tồn tại, DELETED, không còn PROCESSING hoặc objectKey lệch.
- [x] Triển khai retry tối đa 3 lần
  - Ghi chú: `DocumentProcessingRetryService` dùng `app.processing.max-retry-count` mặc định 3 và retry queues 30s/5m/30m.
- [x] Chuyển DLQ khi vượt retry
  - Ghi chú: Failure ở max attempt publish sang routing key `dlq`.
- [x] Set document `EXTRACTION_FAILED` khi xử lý thất bại cuối cùng
  - Ghi chú: Retry service set status `EXTRACTION_FAILED` trước khi route DLQ; extraction/indexing thật vẫn thuộc 1.6.

### 1.6 Text extraction và indexing MVP

- [ ] Triển khai PDF text extraction bằng PDFBox
  - Ghi chú:
- [ ] Triển khai DOC/DOCX text extraction bằng Apache POI
  - Ghi chú:
- [ ] Lưu extracted text vào `document_contents`
  - Ghi chú:
- [ ] Tạo `PostgresSearchEngine`
  - Ghi chú:
- [ ] Build weighted `tsvector` cho search index
  - Ghi chú:
- [ ] Upsert `document_search_index`
  - Ghi chú:
- [ ] Update document sang `INDEXED` khi xử lý thành công
  - Ghi chú:

### 1.7 Document APIs cơ bản

- [ ] Triển khai `GET /api/v1/documents`
  - Ghi chú:
- [ ] Triển khai filter và pagination cho document list
  - Ghi chú:
- [ ] Triển khai `GET /api/v1/documents/{id}`
  - Ghi chú:
- [ ] Đảm bảo user thường không thấy `DELETED`
  - Ghi chú:
- [ ] Đảm bảo user thường không thấy `ARCHIVED` mặc định
  - Ghi chú:
- [ ] Triển khai `GET /api/v1/documents/{id}/preview-url`
  - Ghi chú:
- [ ] Triển khai `GET /api/v1/documents/{id}/download-url`
  - Ghi chú:
- [ ] Ghi access log khi cấp preview URL
  - Ghi chú:
- [ ] Ghi access log khi cấp download URL
  - Ghi chú:
- [ ] Tăng `view_count` khi cấp preview URL
  - Ghi chú:
- [ ] Tăng `download_count` khi cấp download URL
  - Ghi chú:

### 1.8 PostgreSQL Full Text Search

- [ ] Triển khai `GET /api/v1/search`
  - Ghi chú:
- [ ] Dùng `websearch_to_tsquery` cho keyword search
  - Ghi chú:
- [ ] Dùng `ts_rank_cd` cho ranking
  - Ghi chú:
- [ ] Dùng `ts_headline` cho snippet/highlight
  - Ghi chú:
- [ ] Áp dụng `unaccent` cho tiếng Việt
  - Ghi chú:
- [ ] Áp dụng resource access policy trực tiếp trong SQL search query
  - Ghi chú:
- [ ] Đảm bảo không leak title/snippet/count của document không có quyền
  - Ghi chú:
- [ ] Triển khai `GET /api/v1/search/suggestions`
  - Ghi chú:
- [ ] Áp dụng resource access policy cho suggestions
  - Ghi chú:
- [ ] Ghi `search_logs`
  - Ghi chú:

### 1.9 Frontend MVP

- [ ] Tạo màn hình login
  - Ghi chú:
- [ ] Lưu access token trong memory only
  - Ghi chú:
- [ ] Cấu hình Axios/API client
  - Ghi chú:
- [ ] Cấu hình refresh token flow
  - Ghi chú:
- [ ] Tạo màn hình danh sách tài liệu
  - Ghi chú:
- [ ] Tạo màn hình upload tài liệu
  - Ghi chú:
- [ ] Frontend gọi `upload-init`
  - Ghi chú:
- [ ] Frontend PUT file trực tiếp lên presigned URL
  - Ghi chú:
- [ ] Frontend gọi `upload-complete`
  - Ghi chú:
- [ ] Hiển thị trạng thái `PROCESSING`, `INDEXED`, `EXTRACTION_FAILED`
  - Ghi chú:
- [ ] Tạo màn hình chi tiết tài liệu
  - Ghi chú:
- [ ] Tạo chức năng preview qua presigned URL
  - Ghi chú:
- [ ] Tạo chức năng download qua presigned URL
  - Ghi chú:
- [ ] Tạo màn hình search cơ bản
  - Ghi chú:

### 1.10 Kiểm thử MVP

- [ ] Test login/refresh/logout
  - Ghi chú:
- [ ] Test upload PDF thành công
  - Ghi chú:
- [ ] Test upload DOCX thành công
  - Ghi chú:
- [ ] Test file quá 50MB bị chặn
  - Ghi chú:
- [ ] Test file nguy hiểm bị chặn
  - Ghi chú:
- [ ] Test MIME spoofing bị chặn
  - Ghi chú:
- [ ] Test worker extract và index thành công
  - Ghi chú:
- [ ] Test search có kết quả đúng
  - Ghi chú:
- [ ] Test user không thuộc audience không thấy document khi enforcement bật
  - Ghi chú:
- [ ] Test preview URL hoạt động
  - Ghi chú:
- [ ] Test download URL hoạt động
  - Ghi chú:
- [ ] Test access/search logs được ghi
  - Ghi chú:
- [ ] Test Docker Compose chạy toàn bộ stack
  - Ghi chú:

---

## Milestone 2 — Hoàn thiện nghiệp vụ

### 2.1 OCR

- [ ] Bổ sung Tesseract vào worker Docker image
  - Ghi chú:
- [ ] Cài language data `eng`
  - Ghi chú:
- [ ] Cài language data `vie`
  - Ghi chú:
- [ ] Tạo queue `dms.ocr`
  - Ghi chú:
- [ ] OCR ảnh JPG/PNG/TIFF
  - Ghi chú:
- [ ] OCR scanned PDF
  - Ghi chú:
- [ ] Lưu OCR text vào `document_contents`
  - Ghi chú:
- [ ] Refresh search index sau OCR
  - Ghi chú:

### 2.2 Preview conversion

- [ ] Tạo queue `dms.preview`
  - Ghi chú:
- [ ] Cấu hình LibreOffice headless/JODConverter
  - Ghi chú:
- [ ] Convert DOC/DOCX sang preview artifact
  - Ghi chú:
- [ ] Convert XLS/XLSX sang preview artifact
  - Ghi chú:
- [ ] Upload preview artifact lên object storage
  - Ghi chú:
- [ ] Lưu `preview_object_key`
  - Ghi chú:
- [ ] Cấp preview URL từ preview artifact
  - Ghi chú:

### 2.3 Versioning

- [ ] Triển khai `POST /api/v1/documents/{id}/versions/init`
  - Ghi chú:
- [ ] Triển khai `POST /api/v1/documents/{id}/versions/{versionId}/complete`
  - Ghi chú:
- [ ] Xử lý worker pipeline cho version mới
  - Ghi chú:
- [ ] Chỉ switch current version sau khi version mới xử lý thành công
  - Ghi chú:
- [ ] Giữ version hiện tại nếu version mới fail
  - Ghi chú:
- [ ] Triển khai version history API
  - Ghi chú:
- [ ] Triển khai version download URL
  - Ghi chú:
- [ ] Triển khai restore old version
  - Ghi chú:
- [ ] Refresh search index sau restore version
  - Ghi chú:

### 2.4 Trash, archive, restore

- [ ] Triển khai archive document
  - Ghi chú:
- [ ] Triển khai soft delete document
  - Ghi chú:
- [ ] Set `deleted_at`, `deleted_by`, `purge_after`, `previous_status`
  - Ghi chú:
- [ ] Triển khai trash list
  - Ghi chú:
- [ ] Triển khai restore from trash
  - Ghi chú:
- [ ] Triển khai permanent delete
  - Ghi chú:
- [ ] Triển khai daily purge job
  - Ghi chú:
- [ ] Đảm bảo purge idempotent
  - Ghi chú:

### 2.5 Batch upload và batch operations

- [ ] Triển khai `POST /api/v1/documents/batch-upload-init` và `POST /api/v1/documents/batch-upload-complete`
  - Ghi chú:
- [ ] Áp dụng giới hạn `BATCH_UPLOAD_MAX_FILES`
  - Ghi chú:
- [ ] Trả presigned URL riêng cho từng file
  - Ghi chú:
- [ ] Xử lý partial success/failure theo từng file
  - Ghi chú:
- [ ] Triển khai batch move
  - Ghi chú:
- [ ] Triển khai batch archive
  - Ghi chú:
- [ ] Triển khai batch delete
  - Ghi chú:
- [ ] Triển khai batch restore nếu cần
  - Ghi chú:
- [ ] Ghi audit log theo từng document trong batch
  - Ghi chú:

### 2.6 Dashboard và logs nâng cao

- [ ] Triển khai dashboard tổng số tài liệu
  - Ghi chú:
- [ ] Triển khai dashboard theo trạng thái tài liệu
  - Ghi chú:
- [ ] Triển khai dashboard dung lượng active/trash/version từ DB metadata
  - Ghi chú:
- [ ] Triển khai dashboard lượt preview/download theo thời gian
  - Ghi chú:
- [ ] Triển khai màn hình audit logs
  - Ghi chú:
- [ ] Triển khai màn hình access logs
  - Ghi chú:
- [ ] Triển khai màn hình search logs nếu cần
  - Ghi chú:

### 2.7 Frontend nghiệp vụ mở rộng

- [ ] Tạo UI version history
  - Ghi chú:
- [ ] Tạo UI restore version
  - Ghi chú:
- [ ] Tạo UI trash
  - Ghi chú:
- [ ] Tạo UI archive/restore
  - Ghi chú:
- [ ] Tạo UI batch upload
  - Ghi chú:
- [ ] Tạo UI batch operations
  - Ghi chú:
- [ ] Tạo UI dashboard
  - Ghi chú:
- [ ] Tạo UI audit logs
  - Ghi chú:
- [ ] Tạo UI retry indexing
  - Ghi chú:

---

## Milestone 3 — Production hardening

### 3.1 Cloudflare R2 production storage

- [ ] Cấu hình Cloudflare R2 endpoint/bucket/credentials
  - Ghi chú:
- [ ] Kiểm thử presigned PUT với R2
  - Ghi chú:
- [ ] Kiểm thử presigned GET với R2
  - Ghi chú:
- [ ] Đảm bảo bucket private
  - Ghi chú:
- [ ] Đảm bảo object key không chứa filename gốc
  - Ghi chú:

### 3.2 Security hardening

- [ ] Không log token/cookie/presigned URL đầy đủ
  - Ghi chú:
- [ ] Cấu hình CORS allowlist production
  - Ghi chú:
- [ ] Cấu hình cookie `Secure`, `HttpOnly`, `SameSite`
  - Ghi chú:
- [ ] Bổ sung CSRF protection nếu deploy cross-site
  - Ghi chú:
- [ ] Sanitize filename display/download
  - Ghi chú:
- [ ] Sanitize search highlight/snippet
  - Ghi chú:
- [ ] Review toàn bộ endpoint đi qua resource access policy
  - Ghi chú:

### 3.3 Worker reliability

- [ ] Hoàn thiện retry backoff `30s -> 5m -> 30m`
  - Ghi chú:
- [ ] Hoàn thiện DLQ monitoring
  - Ghi chú:
- [ ] Tạo API/admin action retry failed indexing
  - Ghi chú:
- [ ] Đảm bảo mọi worker task idempotent
  - Ghi chú:
- [ ] Đảm bảo object deletion idempotent
  - Ghi chú:

### 3.4 Cleanup và self-healing jobs

- [ ] Tạo orphan object cleanup job
  - Ghi chú:
- [ ] Tạo nightly search refresh self-heal job
  - Ghi chú:
- [ ] Tạo failed extraction retry job nếu cần
  - Ghi chú:
- [ ] Tích hợp ShedLock/distributed lock cho scheduler multi-instance
  - Ghi chú:

### 3.5 Observability

- [ ] Thêm request id/correlation id
  - Ghi chú:
- [ ] Thêm structured logging
  - Ghi chú:
- [ ] Log processing job id trong worker
  - Ghi chú:
- [ ] Theo dõi queue depth RabbitMQ
  - Ghi chú:
- [ ] Theo dõi failed job count
  - Ghi chú:
- [ ] Theo dõi extraction latency
  - Ghi chú:
- [ ] Theo dõi search latency
  - Ghi chú:

### 3.6 Deployment optimization

- [ ] Cân nhắc tách API image và worker image
  - Ghi chú:
- [ ] API image không cần LibreOffice/Tesseract nếu đã tách
  - Ghi chú:
- [ ] Worker image có LibreOffice/Tesseract đầy đủ
  - Ghi chú:
- [ ] Kiểm thử production-like Docker Compose hoặc deployment manifest
  - Ghi chú:

---

## Definition of Done — MVP

MVP hoàn thành khi toàn bộ các mục dưới đây được đánh dấu xong:

- [ ] Admin login được
  - Ghi chú:
- [ ] Admin upload PDF qua presigned URL thành công
  - Ghi chú:
- [ ] Admin upload DOCX qua presigned URL thành công
  - Ghi chú:
- [ ] Backend không nhận/proxy file bytes trong upload thường
  - Ghi chú:
- [ ] File được lưu vào MinIO/R2 private bucket
  - Ghi chú:
- [ ] Backend validate size và MIME thật sau upload
  - Ghi chú:
- [ ] Worker extract text thành công
  - Ghi chú:
- [ ] PostgreSQL FTS index được refresh
  - Ghi chú:
- [ ] Document chuyển sang `INDEXED`
  - Ghi chú:
- [ ] User có quyền tìm thấy document qua search
  - Ghi chú:
- [ ] User không có quyền không thấy document ở list/search/detail
  - Ghi chú:
- [ ] Preview URL hoạt động
  - Ghi chú:
- [ ] Download URL hoạt động
  - Ghi chú:
- [ ] Access log được ghi khi cấp preview/download URL
  - Ghi chú:
- [ ] Search log được ghi khi search
  - Ghi chú:
- [ ] Retry indexing hoạt động cho document failed
  - Ghi chú:
- [ ] Docker Compose chạy được toàn bộ stack dev
  - Ghi chú:
