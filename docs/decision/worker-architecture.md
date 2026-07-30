# Thiết Kế: Worker & Message Queue (RabbitMQ)

> **Trạng thái:** Nội dung thiết kế trong file này đã được gộp vào các tài liệu chính (`API_SPEC.md`, `DATABASE.md`, `design.md`, `sa/sa.md`, `sa/server.md`, `sa/techstack.md`). File này được giữ như ADR/tài liệu tham khảo quyết định.
>
> Doc thiết kế riêng cho việc tách các tác vụ xử lý nền nặng (content extraction, OCR, LibreOffice convert, PostgreSQL search refresh) ra khỏi API server, chạy trên **tiến trình worker riêng** điều phối qua **RabbitMQ**.
>
> Doc này bổ sung cho [presigned-url.md](./presigned-url.md): presigned URL gỡ phần proxy byte khỏi API server; worker gỡ phần xử lý CPU/memory nặng. Hai thay đổi cùng mục tiêu giải phóng thread pool của app server. Chưa chỉnh sửa docs gốc cho tới khi kế hoạch được chốt.

---

## 1. Bối cảnh & Động lực

### Kiến trúc hiện tại (xử lý nền in-process)

Trong [sa/techstack.md](./techstack.md) và [sa/sa.md](./sa.md), các tác vụ nền chạy **cùng tiến trình** với API server bằng Spring `@Async` + `ThreadPoolTaskExecutor`:

- **Content extraction**: PDFBox / POI trích xuất text.
- **OCR**: Tesseract cho scanned PDF / image (rất nặng CPU, chạy lâu).
- **Preview convert**: JODConverter điều khiển LibreOffice headless (nặng CPU/memory, quá trình con).
- **PostgreSQL search refresh**: refresh `document_search_index.search_vector` và các field search denormalized.
- **Scheduled retry / search refresh** hàng đêm.

### Vấn đề

Ngay cả sau khi áp presigned URL (byte không còn qua backend), các tác vụ trên vẫn chạy **trong app server**:

- OCR một file scan 50MB hoặc convert Excel lớn chiếm CPU/RAM kéo dài → giành tài nguyên với luồng phục vụ HTTP request → tăng latency toàn hệ thống.
- Không thể scale riêng phần xử lý: muốn tăng năng lực OCR phải scale cả API server.
- `@Async` in-process **mất task khi app restart/crash** giữa chừng (queue nằm trong bộ nhớ JVM) → document kẹt `PROCESSING`.
- Spike upload đồng thời → thread pool đầy, task xếp hàng trong RAM không giới hạn rõ ràng.

### Mục tiêu

Đẩy tác vụ nền vào **RabbitMQ**, xử lý bởi **worker process tách biệt**, scale độc lập với API server. API server chỉ **publish message** rồi trả response ngay; worker consume và xử lý.

```text
        ┌──────────────┐  publish   ┌──────────────┐  consume   ┌──────────────┐
        │  API Server  │ ──────────▶│  RabbitMQ    │ ──────────▶│   Worker(s)  │
        │ (Spring Boot)│            │  (broker)    │            │ (Spring Boot │
        │  publish-only│◀───────────│              │            │  consumer)   │
        └──────────────┘  (không có  └──────────────┘            └──────┬───────┘
                          reply — fire & forget)                        │
                                                                        │ đọc object, ghi
                                                                        ▼
                                                    ┌──────────────┬──────────────┐
                                                    │ PostgreSQL   │ Object Store │
                                                    │ status + FTS │ file/artifact│
                                                    └──────────────┴──────────────┘
```

---

## 2. Nguyên tắc thiết kế

1. **PostgreSQL vẫn là source of truth.** Worker cập nhật `status`, `document_contents`, không thay đổi vai trò nguồn sự thật của PostgreSQL.
2. **API server publish-only, không chờ kết quả.** Upload response trả ngay với `status = PROCESSING` (giữ đúng contract async hiện có trong [API_SPEC.md](../API_SPEC.md)).
3. **Publish SAU khi transaction PostgreSQL commit** (after-commit), tránh publish message trỏ tới row chưa commit / bị rollback.
4. **Message chỉ mang tham chiếu, không mang byte.** Payload chứa `documentId`, `versionId`, `objectKey` — worker tự pull object từ storage. RabbitMQ không phải nơi truyền file.
5. **Task idempotent.** Mỗi task có thể bị redeliver (at-least-once). Worker phải chịu được xử lý lặp mà không hỏng dữ liệu.
6. **Thất bại có đường thoát.** Retry giới hạn → Dead Letter Queue (DLQ); document chuyển `EXTRACTION_FAILED`, không kẹt `PROCESSING` mãi.

---

## 3. Phân loại tác vụ → hàng đợi

Tách theo đặc tính tài nguyên để scale và cô lập lỗi độc lập:

| Task | Queue | Đặc tính | Trigger |
|------|-------|----------|---------|
| Extract text (PDFBox/POI) | `dms.extract` | CPU vừa, nhanh | upload-complete, version complete, retry |
| OCR (Tesseract) | `dms.ocr` | CPU rất nặng, chậm | khi extract phát hiện scanned PDF/image |
| Preview convert (LibreOffice) | `dms.preview` | CPU/RAM nặng, spawn process con | upload-complete (nếu pre-gen artifact — xem [presigned-url.md §4](./presigned-url.md)) |
| Refresh PostgreSQL search vector | `dms.index` | Nhẹ, I/O | sau extract thành công; khi metadata/audience đổi |

> Tách `dms.ocr` và `dms.preview` khỏi `dms.extract`/`dms.index` là điểm quan trọng: task nặng không làm nghẽn task nhẹ, và có thể scale số worker OCR riêng khi hàng đợi OCR dồn.

### Topology RabbitMQ

```text
Exchange: dms.tasks   (type: direct, durable)

  routing key = "extract"  ──▶ queue dms.extract  (durable, DLX=dms.dlx)
  routing key = "ocr"      ──▶ queue dms.ocr      (durable, DLX=dms.dlx)
  routing key = "preview"  ──▶ queue dms.preview  (durable, DLX=dms.dlx)
  routing key = "index"    ──▶ queue dms.index    (durable, DLX=dms.dlx)

Exchange: dms.dlx     (type: direct, durable)   ← Dead Letter Exchange
  routing key = <same>     ──▶ queue dms.dlq     (durable, không TTL)

Exchange: dms.retry   (type: direct, durable)   ← Retry với TTL
  queue dms.retry.30s   (message-ttl=30000, DLX=dms.tasks)  ← quay lại queue gốc sau 30s
```

- **Queue durable + message persistent** → tồn tại qua broker restart.
- **DLX/DLQ** → message vượt số retry rơi vào `dms.dlq` để admin điều tra thủ công, không mất.
- **Retry có độ trễ**: dùng queue TTL trung gian (`dms.retry.30s`) thay vì retry ngay lập tức, tránh dồn CPU khi lỗi tạm thời (VD: PostgreSQL search tạm down).

---

## 4. Hợp đồng message (message contract)

Payload JSON tối giản, chỉ tham chiếu — không mang nội dung file:

```json
{
  "taskId": "uuid-idempotency-key",
  "type": "EXTRACT",
  "documentId": 42,
  "versionId": 101,
  "objectKey": "8f3b...uuid",
  "mimeType": "application/pdf",
  "attempt": 1,
  "issuedAt": "2026-07-24T10:30:00Z"
}
```

| Field | Vai trò |
|-------|---------|
| `taskId` | Idempotency key (UUID). Worker dùng để nhận diện redelivery. |
| `type` | `EXTRACT` / `OCR` / `PREVIEW` / `INDEX`. |
| `documentId`, `versionId` | Trỏ về PostgreSQL (source of truth). |
| `objectKey` | Worker pull object từ storage bằng key này. |
| `attempt` | Số lần đã thử; worker tăng khi requeue, so với `maxAttempts`. |

> `mimeType` mang theo để worker chọn extractor nhanh, nhưng worker vẫn **đọc lại trạng thái từ PostgreSQL** (VD current version, status) trước khi xử lý — không tin mù message vì message có thể cũ (VD document đã bị xóa giữa chừng).

---

## 5. Luồng xử lý đầy đủ

Nối tiếp flow presigned upload (bước `upload-complete`):

```text
1. upload-complete (API server)
   - Tika validate MIME  ✓
   - status = PROCESSING, commit PostgreSQL
   - AFTER-COMMIT: publish {type:EXTRACT} → dms.tasks (key=extract)
   - trả response ngay (không chờ)

2. Worker consume dms.extract
   - đọc document từ PostgreSQL; nếu DELETED/không phải current version → ack & bỏ (idempotent)
   - pull object từ storage
   - chọn extractor theo mimeType:
       ├─ text-based (PDF có text layer, DOCX...) → PDFBox/POI → extracted_text
       └─ scanned/image → publish {type:OCR} → dms.ocr; ack task extract
   - lưu document_contents, extraction_status=SUCCESS
   - publish {type:INDEX} → dms.index
   - (nếu là Office & pre-gen preview) publish {type:PREVIEW} → dms.preview
   - ack

3. Worker consume dms.index
   - rebuild `document_search_index`/`search_vector` từ metadata + extracted_text
   - thành công → status = INDEXED, commit; ack
   - lỗi PostgreSQL tạm thời → nack/requeue qua dms.retry.30s

4. Worker consume dms.ocr (nếu có)
   - Tesseract OCR → extracted_text → publish {type:INDEX}; ack

5. Worker consume dms.preview (nếu pre-gen)
   - LibreOffice convert → PDF/HTML artifact → upload lên storage key preview/{objectKey}
   - lưu preview_object_key vào documents; ack
```

### Chuyển trạng thái

```text
AWAITING_UPLOAD ──(upload-complete)──▶ PROCESSING ──(index OK)──▶ INDEXED
                                            │
                                            └──(vượt maxAttempts)──▶ EXTRACTION_FAILED
```

Worker xử lý các trạng thái `PROCESSING`, `INDEXED`, `EXTRACTION_FAILED`; trạng thái `AWAITING_UPLOAD` thuộc flow presigned upload trước khi API publish task cho worker.

---

## 6. Độ tin cậy: ack, retry, idempotency

### Manual acknowledgement

- Worker dùng **manual ack** (`spring.rabbitmq.listener.simple.acknowledge-mode=manual` hoặc `AUTO` với exception → nack).
- Ack **chỉ sau khi** đã ghi PostgreSQL/object storage thành công. Worker crash trước khi ack → RabbitMQ redeliver cho worker khác → không mất task.

### Retry có giới hạn

- Lỗi tạm thời (PostgreSQL timeout, storage 5xx, LibreOffice busy): nack → route qua `dms.retry.30s` → quay lại queue gốc sau TTL. Tăng `attempt`.
- Vượt `maxAttempts` (đề xuất **3**): reject → rơi vào `dms.dlq`, đồng thời cập nhật document `EXTRACTION_FAILED` + `document_contents.error_message`, `retry_count`.
- Lỗi vĩnh viễn (file corrupt, MIME không hỗ trợ): không retry, chuyển thẳng `EXTRACTION_FAILED` + ack (không để lại DLQ vô ích) — hoặc DLQ tùy chính sách điều tra.

### Idempotency (bắt buộc vì at-least-once)

- Trước khi xử lý, worker kiểm tra trạng thái hiện tại: nếu document đã `INDEXED` với đúng version, hoặc content đã `SUCCESS` cho version này → ack & bỏ qua.
- Ghi PostgreSQL search là **upsert theo `document_id`** (idempotent tự nhiên).
- Ghi `document_contents` theo `document_id` (UNIQUE) — upsert, không insert trùng.
- `taskId` có thể lưu tạm (Redis SET, TTL ngắn) để chặn xử lý lặp trong cửa sổ redeliver nhanh nếu cần.

### Scheduled job vẫn giữ (self-heal)

- **Retry `EXTRACTION_FAILED` mỗi 30 phút** ([sa/sa.md §6](./sa.md)): giờ = publish lại `{type:EXTRACT}` vào queue thay vì gọi `@Async`.
- **Search refresh batch hàng đêm**: publish loạt `{type:INDEX}` cho các document lệch index.
- Dùng **ShedLock** để job chỉ chạy 1 instance khi có nhiều API server.

---

## 7. Concurrency & Backpressure

| Tham số | Đề xuất | Ghi chú |
|---------|---------|---------|
| `prefetch` (QoS) mỗi consumer | 1 cho `dms.ocr`/`dms.preview`; 5–10 cho `dms.extract`/`dms.index` | Task nặng lấy 1 message/lần tránh ôm nhiều task dài. |
| Concurrent consumers/worker | = số core dành cho worker (OCR thấp hơn) | Cấu hình `spring.rabbitmq.listener.simple.concurrency`. |
| Scale worker OCR | Tách deployment riêng, scale theo độ dài `dms.ocr` | Đây là lợi ích chính của việc tách queue. |

- **Backpressure tự nhiên**: message dồn trong RabbitMQ (đĩa, bền) thay vì phình RAM của JVM app server như `@Async` cũ.
- Alert khi queue depth vượt ngưỡng → dấu hiệu cần thêm worker.

---

## 8. Cấu trúc triển khai (deployment)

Cùng codebase, hai chế độ chạy (profile), hoặc tách module worker riêng:

```text
backend/                       ← chung entity/repository/service core
  ├── (api profile)   DmsApplication      — @RestController, publish message
  └── (worker profile) DmsWorkerApp        — @RabbitListener, không expose HTTP
```

**Docker Compose (dev):**

```text
services:
  api          (Spring Boot, profile=api)      — scale 1..n
  worker       (Spring Boot, profile=worker)   — scale 1..n, image có LibreOffice + Tesseract
  worker-ocr   (tùy chọn tách riêng cho OCR)   — scale theo tải
  rabbitmq     (image rabbitmq:3-management)
  postgresql / redis / minio        — như hiện có
```

- **Image worker** phải cài **LibreOffice headless** (JODConverter) và **Tesseract** — API image không cần nữa nếu tách hẳn, giảm kích thước API image.
- Worker **không mở cổng HTTP** (trừ health/metrics endpoint nội bộ).

> Lưu ý kiến trúc: [sa/sa.md §10](./sa.md) đặt RabbitMQ ở "Enterprise scale". Việc đưa lên sớm là quyết định có chủ đích để lấy độ bền + scale độc lập; cần cập nhật lại bảng Scalability Tiers cho nhất quán (xem §11).

---

## 9. Bảo mật & vận hành

- **Credential RabbitMQ** (user/pass, vhost) trong secret, không hardcode. Worker và API dùng vhost riêng cho DMS.
- Worker cần **credential đọc/ghi object storage** (pull file, ghi preview artifact) và **ghi PostgreSQL** — tách credential theo quyền tối thiểu nếu có thể.
- **Message không chứa dữ liệu nhạy cảm** (chỉ ID/key) → giảm rủi ro nếu queue bị lộ.
- **Monitoring**: RabbitMQ Management UI + metrics (queue depth, consumer count, DLQ size, tuổi message). Alert khi DLQ > 0 hoặc queue depth tăng bất thường.
- **Poison message**: message trong DLQ cần quy trình xử lý (admin xem `dms.dlq`, sửa gốc, re-publish hoặc drop).

---

## 10. Đánh đổi cần chấp nhận

| Được | Mất / chi phí |
|------|---------------|
| API server nhẹ, latency ổn định | Thêm 1 hạ tầng (RabbitMQ) phải vận hành, backup, monitor |
| Scale OCR/convert độc lập | Deploy phức tạp hơn (2+ loại tiến trình, image worker nặng) |
| Task bền, không mất khi crash | Debug khó hơn (luồng async xuyên tiến trình, cần trace theo `taskId`) |
| Backpressure rõ ràng | Độ trễ end-to-end tăng nhẹ (qua broker) — chấp nhận được vì vốn đã async |
| Tách được image API (không cần LibreOffice/Tesseract) | Eventual consistency: có cửa sổ `PROCESSING` dài hơn khi queue dồn |

---

## 11. Danh sách thay đổi cần áp lên docs gốc

| Doc | Thay đổi |
|-----|----------|
| [sa/techstack.md](./techstack.md) | Thêm **RabbitMQ** + **Spring AMQP** vào stack (không còn "optional/enterprise"). Ghi rõ `@Async` chỉ còn cho task cực nhẹ, task nặng qua queue. |
| [sa/sa.md](./sa.md) §6 | "Background Jobs" viết lại: các job = publish message; ShedLock cho scheduler multi-instance. Sơ đồ high-level thêm RabbitMQ + Worker. |
| [sa/sa.md](./sa.md) §10 | Cập nhật Scalability Tiers: RabbitMQ + worker đưa vào từ Production scale (không chỉ Enterprise). |
| [sa/sa.md](./sa.md) §3 | "After-commit event" ghi rõ = publish RabbitMQ sau commit. |
| [presigned-url.md](./presigned-url.md) §3 | Bước `upload-complete` after-commit → publish `dms.extract` thay vì `@Async`. |
| [design.md](../design.md) §7 | Background Jobs cập nhật cơ chế (queue thay in-process). |
| [DATABASE.md](../DATABASE.md) | Không đổi schema (dùng lại `status`, `document_contents.retry_count`, `error_message`). Xác nhận đủ field cho retry/DLQ tracking. |

---

## 12. Roadmap triển khai đề xuất

1. **Hạ tầng**: thêm RabbitMQ vào docker-compose, khai báo exchange/queue/DLX bằng config (Spring AMQP `@Bean Declarables` hoặc definitions.json).
2. **Publisher**: tách điểm gọi `@Async` hiện tại thành `TaskPublisher.publish(...)`; publish trong after-commit hook.
3. **Worker skeleton**: dựng profile/app worker với `@RabbitListener` cho `dms.extract` + `dms.index` trước (task nhẹ, ít rủi ro).
4. **Retry/DLQ**: cấu hình DLX + retry queue TTL, map lỗi → EXTRACTION_FAILED.
5. **Tách OCR & preview**: đẩy OCR và LibreOffice convert sang queue riêng, image worker cài Tesseract + LibreOffice.
6. **Scheduler**: chuyển job retry/search refresh sang publish message + ShedLock.
7. **Observability**: metrics queue depth/DLQ, alert, trace theo `taskId`.
8. **Test**: Testcontainers RabbitMQ — test publish→consume→status, redelivery (idempotency), vượt retry→DLQ→EXTRACTION_FAILED, PostgreSQL search down→retry.
9. **Docs**: áp §11 lên docs gốc sau khi flow ổn định.

---

## 13. Quyết định đã chốt

> Chốt ngày 2026-07-24. Các quyết định này là cơ sở để áp thay đổi lên docs gốc.

| # | Vấn đề | Quyết định |
|---|--------|-----------|
| 1 | `maxAttempts` + bậc thang delay | **`maxAttempts = 3`** cho mọi loại task. Bậc thang delay retry: **30s → 5m → 30m** (3 queue TTL: `dms.retry.30s`, `dms.retry.5m`, `dms.retry.30m`). Vượt lần 3 → DLQ + `EXTRACTION_FAILED`. |
| 2 | Tách `worker-ocr` riêng | **Gộp chung 1 worker deployment ban đầu.** Queue đã tách sẵn (`dms.ocr` riêng) nên khi tải tăng chỉ cần tách deployment + đổi config, không sửa code. |
| 3 | Codebase worker | **1 codebase, 2 Spring profile** (`api` / `worker`) trong cùng module `backend`. Không tách module Maven riêng ở MVP. |
| 4 | Idempotency store | **Dựa hoàn toàn vào state PostgreSQL** (kiểm tra status + current version + `extraction_status`, search row upsert theo `document_id`). Không cần Redis idempotency store riêng ở MVP. |
| 5 | Chính sách DLQ | **Giữ chờ admin + alert** khi `dms.dlq` có message. Không auto re-publish. Admin điều tra, sửa gốc rồi re-publish thủ công hoặc dùng `retry-indexing`. |
| 6 | RabbitMQ topology | **Single-node cho MVP.** Nâng lên **cluster + quorum queue** ở production HA (mốc: khi cần HA broker hoặc khi mất message do node down là không chấp nhận được). |

### Bậc thang retry chi tiết (chốt theo #1)

```text
Exchange: dms.retry (direct, durable)
  queue dms.retry.30s   (message-ttl=30000,   DLX=dms.tasks)  ← attempt 1 fail → chờ 30s
  queue dms.retry.5m    (message-ttl=300000,  DLX=dms.tasks)  ← attempt 2 fail → chờ 5m
  queue dms.retry.30m   (message-ttl=1800000, DLX=dms.tasks)  ← attempt 3 fail → chờ 30m
  → sau attempt 3 vẫn fail → reject sang dms.dlx → dms.dlq + document EXTRACTION_FAILED
```

Worker đọc `attempt` trong message để chọn queue retry tương ứng; header/property mang số lần đã thử.
