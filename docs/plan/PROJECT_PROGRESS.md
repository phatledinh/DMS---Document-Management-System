# Theo dõi tiến độ triển khai dự án DMS

File này dùng để theo dõi tiến độ triển khai theo từng milestone. Khi hoàn thành một công việc, đổi `[ ]` thành `[x]` và cập nhật ghi chú nếu cần.

## Quy ước trạng thái

- `[ ]` Chưa làm
- `[x]` Hoàn thành
- `Ghi chú:` mô tả ngắn kết quả, blocker hoặc quyết định liên quan
- Endpoint API trong file này dùng full public path với prefix `/api/v1`

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
    - Ghi chú: Đã tạo trong V1\_\_init.sql
- [x] Tạo Flyway migration cho bảng `documents`
    - Ghi chú: Đã tạo trong V1\_\_init.sql
- [x] Tạo Flyway migration cho bảng `document_versions`
    - Ghi chú: Đã tạo trong V1\_\_init.sql
- [x] Tạo Flyway migration cho bảng `document_contents`
    - Ghi chú: Đã tạo trong V1\_\_init.sql
- [x] Tạo Flyway migration cho bảng `document_search_index`
    - Ghi chú: Đã tạo trong V1\_\_init.sql
- [x] Tạo Flyway migration cho bảng audience theo phòng ban và user
    - Ghi chú: Đã tạo trong V1\_\_init.sql; các bảng này là điểm móc resource access policy, hiện tại chạy permissive
- [x] Tạo Flyway migration cho `audit_logs`, `access_logs`, `search_logs`
    - Ghi chú: Đã tạo trong V1\_\_init.sql
- [x] Bật PostgreSQL extension `unaccent`
    - Ghi chú: Đã thêm vào V1\_\_init.sql
- [x] Bật PostgreSQL extension `pg_trgm`
    - Ghi chú: Đã thêm vào V1\_\_init.sql
- [x] Tạo index cần thiết cho status, audience, search vector, trash, document code
    - Ghi chú: Đã thêm vào V1\_\_init.sql

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
    - Ghi chú: Đã tạo Enum Role và map role claim sang ROLE\_\* authority
- [x] Seed dữ liệu admin/dev user nếu cần
    - Ghi chú: Đã có script seed admin user trong V1\_\_init.sql

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
    - Ghi chú: Đã thêm `GET /api/v1/documents`; list dùng `DocumentMetadataService` + JPA Specification để lọc status/audience ở DB trước khi phân trang.
- [x] Áp dụng resource access policy cho document detail
    - Ghi chú: Đã thêm `GET /api/v1/documents/{id}`; detail gọi `DocumentAccessPolicyService.canViewMetadata` trước khi trả metadata và không tăng `view_count`.
- [x] Áp dụng resource access policy cho preview URL
    - Ghi chú: `GET /api/v1/documents/{id}/preview-url` gọi `DocumentAccessPolicyService.canPreview` trước khi ký URL.
- [x] Áp dụng resource access policy cho download URL
    - Ghi chú: `GET /api/v1/documents/{id}/download-url` gọi `DocumentAccessPolicyService.canDownload` trước khi ký URL.
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

- [x] Triển khai PDF text extraction bằng PDFBox
    - Ghi chú: `DocumentTextExtractionService` dùng PDFBox `PDFTextStripper`; scanned PDF text rỗng vẫn được index metadata trong MVP.
- [x] Triển khai DOC/DOCX text extraction bằng Apache POI
    - Ghi chú: DOCX dùng XWPF; DOC dùng HWPF qua dependency `poi-scratchpad`.
- [x] Lưu extracted text vào `document_contents`
    - Ghi chú: Đã thêm `DocumentContent`/`DocumentContentRepository` và `DocumentContentService` upsert SUCCESS/FAILED.
- [x] Tạo `PostgresSearchEngine`
    - Ghi chú: Service dùng `JdbcTemplate` native SQL để refresh PostgreSQL FTS index.
- [x] Build weighted `tsvector` cho search index
    - Ghi chú: SQL dùng `setweight(to_tsvector('simple', ...), 'A'/'B'/'C'/'D')`; tag/category/department tạm rỗng cho đến khi masterdata/tag đầy đủ.
- [x] Upsert `document_search_index`
    - Ghi chú: Native SQL `INSERT ... ON CONFLICT (document_id) DO UPDATE`.
- [x] Update document sang `INDEXED` khi xử lý thành công
    - Ghi chú: `DocumentExtractionPipeline` set status `INDEXED` sau khi lưu content và refresh index; OCR/preview artifact không thuộc 1.6.

### 1.7 Document APIs cơ bản

- [x] Triển khai `GET /api/v1/documents`
    - Ghi chú: `DocumentController` dùng mapping nội bộ `/documents`; public path có prefix `/api/v1` từ `server.servlet.context-path`.
- [x] Triển khai filter và pagination cho document list
    - Ghi chú: `DocumentMetadataService` hỗ trợ page/size/sort và filter status/category/department/fileType/visibility/owner/uploadedBy/effectiveDate; non-admin được lọc ACL ở DB.
- [x] Triển khai `GET /api/v1/documents/{id}`
    - Ghi chú: Detail dùng `DocumentAccessPolicyService.canViewMetadata`; response link preview/download dùng path tương đối `/documents/{id}/...` để tránh hardcode context path.
- [x] Đảm bảo user thường không thấy `DELETED`
    - Ghi chú: Policy từ chối document `DELETED`; list non-admin chỉ query status `INDEXED`.
- [x] Đảm bảo user thường không thấy `ARCHIVED` mặc định
    - Ghi chú: List/detail của user thường chỉ cho document `INDEXED`; admin archived chỉ được policy cho preview/download URL.
- [x] Triển khai `GET /api/v1/documents/{id}/preview-url`
    - Ghi chú: Endpoint gọi `DocumentPresignedUrlService.createPreviewUrl`, kiểm quyền trước khi ký URL.
- [x] Triển khai `GET /api/v1/documents/{id}/download-url`
    - Ghi chú: Endpoint gọi `DocumentPresignedUrlService.createDownloadUrl`, kiểm quyền trước khi ký URL.
- [x] Ghi access log khi cấp preview URL
    - Ghi chú: `AccessLogRepository` lưu `PREVIEW` cho cả granted và denied kèm IP/User-Agent.
- [x] Ghi access log khi cấp download URL
    - Ghi chú: `AccessLogRepository` lưu `DOWNLOAD` cho cả granted và denied kèm IP/User-Agent.
- [x] Tăng `view_count` khi cấp preview URL
    - Ghi chú: `createPreviewUrl` tăng `viewCount` sau khi authorize và ký URL thành công; denied không tăng.
- [x] Tăng `download_count` khi cấp download URL
    - Ghi chú: `createDownloadUrl` tăng `downloadCount` sau khi authorize và ký URL thành công; denied không tăng.
      1.8 PostgreSQL Full Text Search

### 1.8 PostgreSQL Full Text Search

- [x] Triển khai `GET /api/v1/search`
    - Ghi chú: Đã triển khai theo API spec tại `GET /api/v1/documents/search` trong `DocumentController`.
- [x] Dùng `websearch_to_tsquery` cho keyword search
    - Ghi chú: `DocumentSearchRepository` dùng `websearch_to_tsquery('simple', unaccent(:query))` khi `q` có giá trị.
- [x] Dùng `ts_rank_cd` cho ranking
    - Ghi chú: Ranking dùng `ts_rank_cd` và boost exact `document_code`.
- [x] Dùng `ts_headline` cho snippet/highlight
    - Ghi chú: Highlight title/description/content bằng `ts_headline`, service sanitize trước khi trả response.
- [x] Áp dụng `unaccent` cho tiếng Việt
    - Ghi chú: Search query, suggestion và search vector refresh đều dùng `unaccent`.
- [x] Áp dụng resource access policy trực tiếp trong SQL search query
    - Ghi chú: Result/count/facet query dùng ACL predicate trong SQL trước khi select dữ liệu.
- [x] Đảm bảo không leak title/snippet/count của document không có quyền
    - Ghi chú: Result, total count và facet đều tính từ ACL-filtered CTE; không filter hậu kỳ trong Java.
- [x] Triển khai `GET /api/v1/search/suggestions`
    - Ghi chú: Đã triển khai theo API spec tại `GET /api/v1/documents/search/suggestions`.
- [x] Áp dụng resource access policy cho suggestions
    - Ghi chú: Suggestions query dùng visible set đã lọc ACL trước khi lấy title/code/tag.
- [x] Ghi `search_logs`
    - Ghi chú: `DocumentSearchRepository` ghi `search_logs` cho search và suggestions kèm keyword/filter/result_count/latency_ms.

### 1.9 Frontend MVP

- [x] Tạo màn hình login
    - Ghi chú: `frontend/src/features/auth/components/LoginForm.jsx` submit thật qua `useLoginAction`, hiển thị lỗi đăng nhập và redirect theo role.
- [x] Lưu access token trong memory only
    - Ghi chú: Access token giữ trong Zustand `authStore`, không dùng `localStorage`/`sessionStorage`.
- [x] Cấu hình Axios/API client
    - Ghi chú: `axiosClient` dùng `VITE_API_URL`, `withCredentials`, gắn Bearer token và unwrap response qua helper dùng chung.
- [x] Cấu hình refresh token flow
    - Ghi chú: Bootstrap session gọi `/auth/refresh`; interceptor xử lý 401 bằng refresh một lần rồi retry request gốc.
- [x] Tạo màn hình danh sách tài liệu
    - Ghi chú: `DocumentsPage` gọi `GET /api/v1/documents`, hỗ trợ filter cơ bản, pagination, loading/error/empty state.
- [x] Tạo màn hình upload tài liệu
    - Ghi chú: `UploadDocumentPage` có form metadata/file, validate size/extension/access level và progress upload.
- [x] Frontend gọi `upload-init`
    - Ghi chú: `useUploadDocument` gọi `POST /api/v1/documents/upload-init` với metadata và khai báo file.
- [x] Frontend PUT file trực tiếp lên presigned URL
    - Ghi chú: PUT dùng Axios riêng, không dùng `axiosClient`, để không gửi Authorization của app tới object storage.
- [x] Frontend gọi `upload-complete`
    - Ghi chú: Sau PUT thành công gọi `POST /api/v1/documents/{id}/upload-complete` và invalidate document/search queries.
- [x] Hiển thị trạng thái `PROCESSING`, `INDEXED`, `EXTRACTION_FAILED`
    - Ghi chú: Dùng status helper chung cho list/detail/search; list/detail polling nhẹ khi có trạng thái `PROCESSING`.
- [x] Tạo màn hình chi tiết tài liệu
    - Ghi chú: `DocumentDetailPage` gọi `GET /api/v1/documents/{id}`, hiển thị metadata thật và disable action khi chưa `INDEXED`.
- [x] Tạo chức năng preview qua presigned URL
    - Ghi chú: Detail gọi `GET /api/v1/documents/{id}/preview-url`; PDF/image mở trong modal iframe, HTML sanitize bằng DOMPurify nếu có.
- [x] Tạo chức năng download qua presigned URL
    - Ghi chú: Detail gọi `GET /api/v1/documents/{id}/download-url` rồi kích hoạt tải qua anchor tạm.
- [x] Tạo màn hình search cơ bản
    - Ghi chú: `SearchPage` gọi `GET /api/v1/documents/search`, đồng bộ query params, filter cơ bản, pagination và sanitize highlight.

### 1.10 Kiểm thử MVP

- [x] Test login/refresh/logout
    - Ghi chú: Covered by `AuthServiceTest`; full backend suite `backend/mvnw -f backend/pom.xml test` pass 61 tests.
- [x] Test upload PDF thành công
    - Ghi chú: `DocumentPresignedUrlServiceTest.completeUpload_pdfValidatesObjectAndPublishesExtractionRequest` cover upload-complete chuyển `PROCESSING` và publish extraction event.
- [x] Test upload DOCX thành công
    - Ghi chú: `DocumentPresignedUrlServiceTest.completeUpload_docxValidatesObjectAndPublishesExtractionRequest` cover DOCX MIME và publish extraction event.
- [x] Test file quá 50MB bị chặn
    - Ghi chú: `FileValidationServiceTest` cover boundary 50MB pass và 50MB + 1 byte fail.
- [x] Test file nguy hiểm bị chặn
    - Ghi chú: `FileValidationServiceTest` parameterized dangerous extensions `.exe/.sh/.bat/.cmd/.js/.html/.htm/.jar/.msi/.ps1/.vbs`; frontend smoke also rejects `.exe` before submit.
- [x] Test MIME spoofing bị chặn
    - Ghi chú: `FileValidationServiceTest.validateDetected_rejectsMimeMismatch` và `DocumentPresignedUrlServiceTest.completeUpload_mimeSpoofingDeletesObjectAndRejectsUpload`.
- [x] Test worker extract và index thành công
    - Ghi chú: `DocumentExtractionPipelineTest.process_successStoresContentRefreshesIndexAndSetsIndexed` và `DocumentExtractWorkerTest` pass.
- [x] Test search có kết quả đúng
    - Ghi chú: `DocumentSearchServiceTest` cover response/highlight/facets; `DocumentSearchRepositoryTest` cover PostgreSQL FTS SQL.
- [x] Test user không thuộc audience không thấy document khi enforcement bật
    - Ghi chú: `DocumentAccessPolicyServiceTest` cover ACL policy; `DocumentSearchRepositoryTest` assert SQL visible set gồm status `INDEXED`, `PUBLIC`, owner, department ACL và user ACL.
- [x] Test preview URL hoạt động
    - Ghi chú: `DocumentPresignedUrlServiceTest.createPreviewUrl_allowedLogsAccessAndIncrementsViewCount` cover presigned preview URL, log và counter.
- [x] Test download URL hoạt động
    - Ghi chú: `DocumentPresignedUrlServiceTest.createDownloadUrl_allowedLogsAccessAndIncrementsDownloadCount` cover presigned download URL, log và counter.
- [x] Test access/search logs được ghi
    - Ghi chú: Access logs covered by `DocumentPresignedUrlServiceTest`; search/suggestion logs covered by `DocumentSearchServiceTest` and `DocumentSearchRepositoryTest.logSearch_serializesNullFilters`.
- [x] Test Docker Compose chạy toàn bộ stack
    - Ghi chú: `docker compose down -v && docker compose up --build -d`; backend healthy, worker up, PostgreSQL/RabbitMQ/Redis/MinIO healthy, `/api/v1/actuator/health` returns `UP`. Added V2 migration, dev JWT secret, ObjectMapper bean and MinIO init fixes for clean startup.

---

## Milestone 2 — Hoàn thiện nghiệp vụ

### 2.1 OCR

- [x] Bổ sung Tesseract vào worker Docker image
    - Ghi chú: `backend/Dockerfile` cài `tesseract-ocr`; API/worker hiện vẫn dùng chung image theo phạm vi 2.1.
- [x] Cài language data `eng`
    - Ghi chú: `backend/Dockerfile` cài `tesseract-ocr-eng`.
- [x] Cài language data `vie`
    - Ghi chú: `backend/Dockerfile` cài `tesseract-ocr-vie`.
- [x] Tạo queue `dms.ocr`
    - Ghi chú: `DocumentProcessingRabbitConfig` khai báo durable queue `dms.ocr` và binding routing key `ocr`; OCR vẫn chạy trong extract pipeline để tái sử dụng retry hiện có.
- [x] OCR ảnh JPG/PNG/TIFF
    - Ghi chú: `DocumentTextExtractionService` route `jpg/jpeg/png/tif/tiff` sang `DocumentOcrService` dùng Tesseract CLI.
- [x] OCR scanned PDF
    - Ghi chú: PDFBox extract trước; nếu text native dưới ngưỡng cấu hình thì render từng page bằng PDFBox và OCR bằng Tesseract.
- [x] Lưu OCR text vào `document_contents`
    - Ghi chú: OCR trả `ExtractedDocumentText` với method `TESSERACT_IMAGE`/`TESSERACT_PDF`, dùng lại `DocumentExtractionPipeline` + `DocumentContentService.saveSuccess`.
- [x] Refresh search index sau OCR
    - Ghi chú: Dùng lại `PostgresSearchEngine.refreshIndex(document, extractedText.text())`; đã chạy `backend/mvnw -f backend/pom.xml test` pass 64 tests. Cần smoke Docker thực tế với ảnh/scanned PDF khi dựng stack.

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

- [x] Triển khai `POST /api/v1/documents/{id}/versions/init`
    - Ghi chú: Đã thêm version init dùng chung validation và presigned PUT flow.
- [x] Triển khai `POST /api/v1/documents/{id}/versions/{versionId}/complete`
    - Ghi chú: Đã validate object bằng HEAD/Tika, chuyển version/document sang `PROCESSING` và publish message có `versionId`.
- [x] Xử lý worker pipeline cho version mới
    - Ghi chú: Extract/preview worker xử lý candidate version theo `versionId` và object key của version.
- [x] Chỉ switch current version sau khi version mới xử lý thành công
    - Ghi chú: Current snapshot trên `documents` chỉ được cập nhật qua finalization sau extraction/preview thành công.
- [x] Giữ version hiện tại nếu version mới fail
    - Ghi chú: Failure path đánh dấu candidate `EXTRACTION_FAILED` và không ghi đè current content/preview/search.
- [x] Triển khai version history API
    - Ghi chú: Đã thêm `GET /documents/{id}/versions` với ACL đọc document.
- [x] Triển khai version download URL
    - Ghi chú: Đã thêm download URL theo object key của version và log `VERSION_DOWNLOAD`.
- [x] Triển khai restore old version
    - Ghi chú: Đã thêm restore endpoint, reprocess target version trước khi switch current.
- [x] Refresh search index sau restore version
    - Ghi chú: Restore dùng lại pipeline extraction/search refresh trước finalization.

### 2.4 Trash, archive, restore

- [x] Triển khai archive document
    - Ghi chú: Đã thêm `POST /documents/{id}/archive`, admin-only, chuyển `INDEXED`/`EXTRACTION_FAILED` sang `ARCHIVED` và loại khỏi search index.
- [x] Triển khai soft delete document
    - Ghi chú: Đã thêm `DELETE /documents/{id}`, admin-only, chuyển tài liệu hợp lệ vào trash mà không xóa object storage.
- [x] Set `deleted_at`, `deleted_by`, `purge_after`, `previous_status`
    - Ghi chú: `DocumentLifecycleService` set đủ trash metadata theo retention `app.trash.retention-days`.
- [x] Triển khai trash list
    - Ghi chú: Đã thêm `GET /documents/trash` và frontend `/admin/trash` dùng dữ liệu thật.
- [x] Triển khai restore from trash
    - Ghi chú: Đã thêm restore đơn `POST /documents/{id}/restore` và batch `POST /documents/trash/restore`.
- [x] Triển khai permanent delete
    - Ghi chú: Đã thêm `DELETE /documents/trash/permanent-delete`, xóa object/content/search và tombstone bằng `permanently_deleted_at` để bảo toàn log/FK.
- [x] Triển khai daily purge job
    - Ghi chú: Đã thêm scheduled `DocumentTrashPurgeJob` dùng cron `app.trash.purge-cron`.
- [x] Đảm bảo purge idempotent
    - Ghi chú: Purge bỏ qua document đã purge/missing metadata và xử lý lỗi theo từng document trong batch.

### 2.5 Batch upload và batch operations

- [x] Triển khai `POST /api/v1/documents/batch-upload-init` và `POST /api/v1/documents/batch-upload-complete`
    - Ghi chú: Đã thêm endpoint `/documents/batch-upload-init` và `/documents/batch-upload-complete` trong `DocumentController`, dùng response partial `total/succeeded/failed/items`.
- [x] Áp dụng giới hạn `BATCH_UPLOAD_MAX_FILES`
    - Ghi chú: Đã thêm `app.storage.batch-upload.max-files` với env `BATCH_UPLOAD_MAX_FILES`, default 20.
- [x] Trả presigned URL riêng cho từng file
    - Ghi chú: Mỗi item hợp lệ tạo document riêng và presigned PUT URL riêng qua `DocumentPresignedUrlService`.
- [x] Xử lý partial success/failure theo từng file
    - Ghi chú: Batch init/complete và batch operations catch lỗi theo item, không rollback toàn batch.
- [x] Triển khai batch move
    - Ghi chú: Đã thêm `DocumentMoveService` và endpoint `/documents/batch-move`; cập nhật categoryId theo từng document, trả partial result.
- [x] Triển khai batch archive
    - Ghi chú: Đã thêm endpoint `/documents/batch-archive`, reuse lifecycle archive theo từng document.
- [x] Triển khai batch delete
    - Ghi chú: Đã thêm endpoint `/documents/batch-delete`, reuse soft delete/trash lifecycle theo từng document.
- [x] Triển khai batch restore nếu cần
    - Ghi chú: Đã thêm endpoint `/documents/batch-restore`, reuse restore lifecycle theo từng document.
- [x] Ghi audit log theo từng document trong batch
    - Ghi chú: Upload complete ghi `UPLOAD`; move ghi `MOVE`; archive/delete/restore reuse lifecycle audit theo từng document. Backend tests pass; frontend build pass; Vitest hiện fail do lỗi test environment React `Invalid hook call` ở cả test cũ `LoginForm`.

### 2.6 Dashboard và logs nâng cao

- [x] Triển khai dashboard tổng số tài liệu
    - Ghi chú: Đã thêm `GET /admin/dashboard/summary` và wire `DashboardPage.jsx` hiển thị KPI từ API.
- [x] Triển khai dashboard theo trạng thái tài liệu
    - Ghi chú: `summary` trả `documentsByStatus`; frontend render breakdown theo trạng thái.
- [x] Triển khai dashboard dung lượng active/trash/version từ DB metadata
    - Ghi chú: Đã thêm `GET /admin/dashboard/storage`, tính active/trash từ `documents.file_size` và version từ `document_versions.file_size`.
- [x] Triển khai dashboard lượt preview/download theo thời gian
    - Ghi chú: Đã thêm `GET /admin/dashboard/access-stats`, gom `access_logs` theo granularity ngày/tuần/tháng và render chart preview/download.
- [x] Triển khai màn hình audit logs
    - Ghi chú: Đã thêm `GET /admin/audit-logs` unified feed và wire tab Audit trong `AuditLogsPage.jsx` với filter/pagination.
- [x] Triển khai màn hình access logs
    - Ghi chú: Dùng cùng `GET /admin/audit-logs` với `logType=ACCESS`, tab Access có filter theo action/document/date/keyword.
- [x] Triển khai màn hình search logs nếu cần
    - Ghi chú: Dùng cùng `GET /admin/audit-logs` với `logType=SEARCH`; dashboard cũng có top search keywords. Verification: `mvn -q -f backend/pom.xml -DskipTests compile` và `npm --prefix frontend run build` passed.

### 2.7 Frontend nghiệp vụ mở rộng

- [x] Tạo UI version history
    - Ghi chú: `DocumentHistoryPage.jsx` hiển thị version history từ `GET /documents/{id}/versions`, download version cũ và upload version mới.
- [x] Tạo UI restore version
    - Ghi chú: `DocumentHistoryPage.jsx` gọi `POST /documents/{id}/versions/{versionId}/restore` với confirm trước khi restore.
- [x] Tạo UI trash
    - Ghi chú: `DocumentTrashPage.jsx` hiển thị `/admin/trash`, filter/pagination, restore và permanent delete một/nhiều tài liệu.
- [x] Tạo UI archive/restore
    - Ghi chú: `DocumentsPage.jsx` có action archive tài liệu `INDEXED`, restore tài liệu `ARCHIVED`, delete mềm sang trash.
- [x] Tạo UI batch upload
    - Ghi chú: `UploadDocumentPage.jsx` hỗ trợ nhiều file qua batch presigned URL, validate extension/size và progress từng file.
- [x] Tạo UI batch operations
    - Ghi chú: `DocumentsPage.jsx` hỗ trợ chọn nhiều tài liệu để batch move/archive/delete và hiển thị partial result.
- [x] Tạo UI dashboard
    - Ghi chú: `DashboardPage.jsx` dùng API dashboard thật cho KPI, status breakdown, storage và access stats.
- [x] Tạo UI audit logs
    - Ghi chú: `AuditLogsPage.jsx` dùng `GET /admin/audit-logs` cho audit/access/search logs với filter/pagination.
- [x] Tạo UI retry indexing
    - Ghi chú: `ProcessingErrorsPage.jsx` gọi `POST /documents/{id}/retry-indexing`; backend chuyển `EXTRACTION_FAILED` về `PROCESSING` và publish lại extract task.

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
