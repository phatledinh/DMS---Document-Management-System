# Tech Stack — DMS

> Chi tiết công nghệ sử dụng cho Frontend, Backend và Database.

---

## Tổng quan

```text
┌──────────────────────────────────────────────────────────────┐
│                        TECH STACK                            │
│                                                              │
│  ┌────────────────┐  ┌────────────────┐  ┌───────────────┐  │
│  │   FRONTEND     │  │   BACKEND      │  │   DATABASE    │  │
│  │                │  │                │  │               │  │
│  │  React 18+     │  │  Spring Boot 4 │  │  PostgreSQL 17+ │  │
│  │  Vite          │  │  Java 25       │  │  Redis          │  │
│  │  JavaScript    │  │  Spring Sec 6  │  │  FTS + pg_trgm  │  │
│  └────────────────┘  └────────────────┘  └───────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

---

## 1. Frontend (FE)

### Core Framework

| Công nghệ | Version | Mô tả |
|-----------|---------|-------|
| **React** | 18+ | UI Library |
| **Vite** | 5+ | Build tool & Dev server |
| **JavaScript** | ES2022+ | Ngôn ngữ frontend thuần |

### UI & Styling

| Thư viện | Mô tả |
|----------|-------|
| **Ant Design** / **MUI** | Component library (Table, Form, Modal, Menu...) |
| **CSS Modules** / **Styled Components** | Styling solution |
| **React Icons** | Icon library |

### State Management & Data Fetching

| Thư viện | Mô tả |
|----------|-------|
| **TanStack Query (React Query)** | Server state management, caching, refetching |
| **Zustand** / **Context API** | Client state (auth, UI state) |
| **Axios** | HTTP client (interceptors cho JWT refresh) |

### Routing & Navigation

| Thư viện | Mô tả |
|----------|-------|
| **React Router v6** | Client-side routing |

### Utilities

| Thư viện | Mô tả |
|----------|-------|
| **React PDF** / **pdf.js** | PDF preview trong browser |
| **DOMPurify** | Sanitize HTML preview (Word/Excel convert) chống XSS trước khi render |
| **Day.js** | Date formatting |
| **React Hook Form** + **Zod** | Form validation |
| **React Toastify** | Toast notifications |

> **Chốt lựa chọn UI**: dùng **Ant Design** (component Table/Form/Modal/Tree/Upload phong phú, hợp Admin CMS) và **CSS Modules** cho styling tùy biến. Package manager thống nhất **pnpm**.

### Project Structure (FE)

```text
frontend/
├── public/
├── src/
│   ├── api/                    ← API client (Axios instances, interceptors)
│   │   ├── axiosClient.js
│   │   ├── authApi.js
│   │   ├── documentApi.js
│   │   └── ...
│   ├── assets/                 ← Images, fonts
│   ├── components/             ← Shared/reusable components
│   │   ├── Layout/
│   │   ├── Navbar/
│   │   ├── Sidebar/
│   │   ├── DataTable/
│   │   ├── FileUploadZone/
│   │   └── ...
│   ├── features/               ← Feature-based modules
│   │   ├── auth/               ← Ví dụ chi tiết cấu trúc bên trong 1 feature
│   │   │   ├── api/            ← Định nghĩa các API requests (login, refresh token,...)
│   │   │   ├── components/     ← UI components dùng riêng trong feature (LoginForm,...)
│   │   │   ├── hooks/          ← Custom hooks xử lý logic cục bộ (useAuth, useLogin,...)
│   │   │   ├── routes/         ← Định nghĩa các route thuộc nhánh auth
│   │   │   ├── store/          ← State management cục bộ (ví dụ: Zustand slice)
│   │   │   ├── utils/          ← Các helper functions nội bộ
│   │   │   └── index.js        ← Public API export (chỉ export những gì các module khác được dùng)
│   │   ├── documents/
│   │   ├── search/
│   │   ├── categories/
│   │   ├── departments/
│   │   ├── tags/
│   │   ├── users/
│   │   ├── dashboard/
│   │   ├── audit/              ← MH16 Audit & Access Log
│   │   └── profile/            ← MH06 Profile cá nhân
│   ├── hooks/                  ← Custom hooks global
│   ├── pages/                  ← Route pages
│   ├── store/                  ← Global state
│   ├── utils/                  ← Utility functions
│   ├── App.jsx
│   └── main.jsx
├── index.html
├── vite.config.js
└── package.json
```

---

## 2. Backend (BE)

### Core Framework

> Chuẩn runtime backend là **Java 25**. Cấu hình build nên đặt `maven.compiler.release=25` (Maven) hoặc `java.toolchain.languageVersion = JavaLanguageVersion.of(25)` (Gradle) để bytecode, CI và container image dùng cùng một phiên bản JDK.

| Công nghệ | Version | Mô tả |
|-----------|---------|-------|
| **Java** | 25 | Ngôn ngữ chính; dùng JDK 25 cho build/runtime |
| **Spring Boot** | 4.1.x | Framework chính, chạy trên Java 25 |
| **Spring Web** | — | REST API |
| **Spring Security** | 6.x | Authentication & Authorization |
| **Spring Data JPA** | — | ORM / Database access |
| **Spring Validation** | — | DTO validation (`@Valid`) |
| **Spring Cache** | — | Cache abstraction |

### Security & Auth

| Thư viện | Mô tả |
|----------|-------|
| **jjwt (io.jsonwebtoken)** | JWT token generation & validation |
| **BCrypt** (Spring Security) | Password hashing |

### File Processing

| Thư viện | Mô tả |
|----------|-------|
| **Apache Tika** | Detect MIME type thực tế (validate F2.1) + fallback extraction |
| **Apache PDFBox** | PDF text extraction (extractor chính cho PDF) |
| **Apache POI** | DOC/DOCX/XLS/XLSX text extraction (extractor chính cho Office) |
| **JODConverter + LibreOffice (headless)** | Convert Word/Excel → PDF/HTML cho Preview (F2.7, MH05) |
| **Tesseract OCR** | OCR cho scanned PDF & images |

> **Phân định trách nhiệm**: **Tika** dùng để phát hiện MIME type thực tế phục vụ validate upload và làm fallback; **PDFBox/POI** là extractor chính lấy `extracted_content` cho PostgreSQL FTS. **POI chỉ trích xuất text, không render** — nên preview Office cần **JODConverter** điều khiển **LibreOffice headless** convert sang PDF/HTML. Docker image worker phải cài sẵn LibreOffice; API image có thể bỏ LibreOffice/Tesseract nếu tách image runtime. Với Excel có thể dựng HTML table từ POI rồi sanitize thay vì convert PDF.

### Object Storage & Presigned URL

| Thư viện | Mô tả |
|----------|-------|
| **AWS SDK for Java v2** (`software.amazon.awssdk:s3`) | S3-compatible client cho MinIO (dev) / Cloudflare R2 (prod): put/get/head/delete object |
| **S3 Presigner** (`software.amazon.awssdk:s3` presigner) | Ký **presigned PUT/GET URL** cho upload & download/preview trực tiếp client ↔ storage (xem [presigned-url.md](./presigned-url.md)) |

> **Luồng file dùng Presigned URL**: client PUT/GET byte **trực tiếp** với object storage; backend chỉ ký URL sau khi check ACL, không nằm trên đường truyền byte. Bucket private hoàn toàn + CORS cho origin frontend. Flow này là contract chính của docs gốc: `upload-init`/`upload-complete`, `download-url`, `preview-url`; [presigned-url.md](./presigned-url.md) giữ vai trò ADR tham khảo.

### Messaging & Async Processing

| Thư viện | Mô tả |
|----------|-------|
| **RabbitMQ** + **Spring AMQP** (`spring-boot-starter-amqp`) | Message broker điều phối tác vụ nền nặng (extraction, OCR, LibreOffice convert, indexing) tới **worker process riêng** (xem [worker-architecture.md](./worker-architecture.md)) |
| **Spring `@Async` + `ThreadPoolTaskExecutor`** | Chỉ còn cho tác vụ **cực nhẹ** trong request (VD publish message, invalidate cache). Tác vụ nặng đã chuyển sang RabbitMQ worker |
| **OWASP Java HTML Sanitizer** / **Jsoup** | Sanitize HTML preview & search highlight chống XSS (NFR#11, `HtmlSanitizer`) |
| **Spring `@Scheduled`** + **ShedLock** | Retry `EXTRACTION_FAILED` mỗi 30 phút, search refresh batch hàng đêm — job = publish message vào queue; ShedLock đảm bảo chỉ 1 instance chạy scheduler khi multi-instance |

> **Worker & RabbitMQ**: Content extraction / OCR / preview convert / PostgreSQL search refresh không còn chạy `@Async` in-process mà được publish vào RabbitMQ (queue theo loại task: `dms.extract`, `dms.ocr`, `dms.preview`, `dms.index`) và xử lý bởi worker tách biệt, scale độc lập với API server. Topology đã chốt gồm `dms.extract`, `dms.ocr`, `dms.preview`, `dms.index`, retry `30s -> 5m -> 30m`, `maxAttempts = 3`, DLQ giữ để admin xử lý; [worker-architecture.md](./worker-architecture.md) giữ vai trò ADR tham khảo.

### Data Access — Search, Cache & Migration

| Thư viện / Extension | Mô tả |
|----------|-------|
| **PostgreSQL JDBC / JPA native query** | Thực thi query FTS nâng cao (`websearch_to_tsquery`, `ts_rank_cd`, `ts_headline`, filter ACL/facet) |
| **PostgreSQL `pg_trgm`** | Fuzzy search, typo tolerance, autocomplete/typeahead bằng trigram index |
| **PostgreSQL `unaccent`** | Chuẩn hóa dấu khi search tiếng Việt ở mức cơ bản |
| **PostgreSQL `pgvector`** (optional) | Vector/semantic search cho giai đoạn RAG nếu cần |
| **Spring Data Redis (Lettuce)** | Truy cập Redis cache (categories tree, tags, suggestions) |
| **Flyway** | Version hóa schema PostgreSQL và tạo extension/index search |

> **Lựa chọn PostgreSQL-only**: không dùng Elasticsearch/OpenSearch trong MVP. PostgreSQL vừa là source of truth vừa xử lý search bằng FTS + GIN index + `pg_trgm`; query phức tạp được viết bằng SQL/native query để kiểm soát ranking, highlight, facet và permission filter.

### Mapping & Utilities

| Thư viện | Mô tả |
|----------|-------|
| **MapStruct** | Entity ↔ DTO mapping (compile-time) |
| **Lombok** | Boilerplate reduction (@Data, @Builder...) |
| **Slugify** | Generate URL-friendly slugs |

### API Documentation

| Thư viện | Mô tả |
|----------|-------|
| **SpringDoc OpenAPI** | Swagger UI tự động từ annotations |

### Testing

| Thư viện | Mô tả |
|----------|-------|
| **JUnit 5** | Unit testing |
| **Mockito** | Mocking framework |
| **Spring Boot Test** | Integration testing |
| **Testcontainers** (PostgreSQL, Redis) | Integration test sát production cho FTS query, `pg_trgm`, cache, JPA |
| **H2 Database** | In-memory DB cho unit test JPA nhanh (lưu ý lệch hành vi với PostgreSQL FTS/extensions) |

> Logic cốt lõi (permission-aware FTS query, ranking/highlight, faceted aggregation, Redis cache) không kiểm thử được bằng H2 — ưu tiên **Testcontainers PostgreSQL** cho các test này; H2 chỉ dùng cho test JPA đơn giản.

### Project Structure (BE)

```text
backend/
├── src/main/java/com/dms/
│   ├── DmsApplication.java
│   ├── common/                         ← Shared utilities
│   │   ├── config/                     ← AppConfig, CorsConfig, CacheConfig
│   │   ├── exception/                  ← GlobalExceptionHandler, custom exceptions
│   │   ├── security/                   ← JwtFilter, SecurityConfig, JwtProvider
│   │   └── dto/                        ← ApiResponse<T>, PageResponse
│   ├── identity/                       ← PH1: Identity module
│   │   ├── controller/
│   │   ├── service/
│   │   ├── entity/
│   │   ├── repository/
│   │   ├── dto/
│   │   └── mapper/
│   ├── document/                       ← PH2: Document module
│   │   ├── controller/
│   │   ├── service/
│   │   │   ├── DocumentService.java
│   │   │   ├── DocumentBatchService.java
│   │   │   ├── DocumentLifecycleService.java
│   │   │   ├── DocumentStorageStatsService.java
│   │   │   ├── StorageService.java
│   │   │   ├── ContentExtractorService.java
│   │   │   └── PreviewService.java     ← JODConverter/LibreOffice + HtmlSanitizer
│   │   ├── entity/
│   │   ├── repository/
│   │   ├── dto/
│   │   └── mapper/
│   ├── search/                         ← PH3: Search module
│   │   ├── controller/
│   │   ├── service/
│   │   └── dto/
│   ├── masterdata/                     ← PH4: Master Data
│   │   ├── controller/
│   │   ├── service/
│   │   ├── entity/
│   │   ├── repository/
│   │   ├── dto/
│   │   └── mapper/
│   ├── dashboard/                      ← PH5: Dashboard
│   │   ├── controller/
│   │   ├── service/
│   │   └── dto/
│   └── audit/                          ← PH6: Audit & Access Log
│       ├── controller/                 ← AuditLogController (/admin/audit-logs)
│       ├── service/                    ← AuditLogService, AccessLogService, SearchLogService
│       ├── entity/                     ← AuditLog, AccessLog, SearchLog
│       ├── repository/
│       └── dto/
├── src/main/resources/
│   ├── db/migration/                   ← Flyway migration scripts (V1__init.sql...)
│   ├── application.yml                 ← cấu hình presigned upload TTL + small multipart limit for non-file forms
│   ├── application-dev.yml
│   └── application-prod.yml
├── src/test/
├── pom.xml (hoặc build.gradle)        ← target/release Java 25
└── Dockerfile                         ← base image JDK/JRE 25
```

---

## 3. Database (DB)

### Primary Database

| Công nghệ | Version | Mô tả |
|-----------|---------|-------|
| **PostgreSQL** | 17+ | Relational database chính + full-text search engine |

**Lý do chọn PostgreSQL:**
- Lưu trữ dữ liệu quan hệ, metadata tài liệu, ACL, audit/access/search logs
- Hỗ trợ transaction, foreign keys, JSONB, CTE/window functions và index phong phú
- Tích hợp Full-Text Search với `tsvector`, `tsquery`, `ts_rank_cd`, `ts_headline`
- Hỗ trợ `pg_trgm` cho fuzzy/typeahead và `pgvector` cho semantic search nếu cần
- Giảm hạ tầng vận hành vì không cần Elasticsearch/OpenSearch riêng trong MVP

### Cache Layer

| Công nghệ | Version | Mô tả |
|-----------|---------|-------|
| **Redis** | 7+ | In-memory cache |

**Sử dụng cho:**
- Cache categories tree, departments, tags
- Cache document metadata
- Search suggestions autocomplete
- Session management (nếu cần)

### Search Engine

| Công nghệ | Version | Mô tả |
|-----------|---------|-------|
| **PostgreSQL Full-Text Search** | built-in | Search keyword trên title, description, document code, tags, extracted content |
| **GIN index** | built-in | Index cho `tsvector` và trigram để giữ hiệu năng query |
| **pg_trgm** | extension | Fuzzy search, typo tolerance, autocomplete/typeahead |
| **unaccent** | extension | Normalize dấu cho search tiếng Việt cơ bản |
| **pgvector** | extension optional | Semantic/vector search cho RAG giai đoạn sau |

**Sử dụng cho:**
- Full-text search trên tiêu đề, mô tả và nội dung trích xuất
- Ranking bằng `ts_rank_cd` với boost theo `document_code`, title, tags, description, extracted content
- Highlight bằng `ts_headline` và sanitize HTML trước khi trả frontend
- Fuzzy search/typeahead bằng `pg_trgm`
- Faceted aggregations theo danh mục, phòng ban, loại file, tags bằng SQL `GROUP BY`
- Permission-aware query bằng JOIN/EXISTS với ACL ngay trong SQL

### Database Schema Overview

```text
┌──────────────────────────────────────────────────────────────┐
│                      PostgreSQL Schema                            │
│                                                              │
│  Identity:                                                   │
│  ├── users                    (thông tin người dùng)        │
│  └── refresh_tokens           (JWT refresh tokens)          │
│                                                              │
│  Document:                                                   │
│  ├── documents ⭐             (metadata tài liệu - core)   │
│  ├── document_contents        (nội dung text trích xuất)    │
│  ├── document_versions        (lịch sử phiên bản)          │
│  └── document_tags            (bảng trung gian N:N)         │
│                                                              │
│  Master Data:                                                │
│  ├── categories               (danh mục - cây phân cấp)    │
│  ├── departments              (phòng ban)                   │
│  └── tags                     (nhãn)                        │
└──────────────────────────────────────────────────────────────┘
```

> Chi tiết schema đầy đủ xem tại [DATABASE.md](../DATABASE.md)

---

## 4. DevOps & Tools

### Development Tools

| Công cụ | Mô tả |
|---------|-------|
| **IntelliJ IDEA** | Java IDE chính |
| **VS Code** | Frontend IDE |
| **Git** | Version control |
| **Postman** / **Swagger UI** | API testing |
| **pgAdmin** / **DBeaver** | PostgreSQL database management |
| **Redis Insight** | Redis GUI |

### Build & Package

| Công cụ | Mô tả |
|---------|-------|
| **Maven** / **Gradle** | Java build tool |
| **npm** / **pnpm** | Frontend package manager |
| **Docker** | Containerization |
| **Docker Compose** | Multi-container orchestration |

### CI/CD

| Công cụ | Mô tả |
|---------|-------|
| **GitHub Actions** | CI/CD pipeline |
| **Docker Hub** | Container registry |

---

## 5. Version Compatibility Matrix

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| Java | 25 | 25 |
| Spring Boot | 4.1.0 | 4.1+ |
| Node.js | 18 | 20 LTS |
| React | 18 | 18.2+ |
| PostgreSQL | 17 | 17+ / managed latest stable |
| Redis | 7.0 | 7.2+ |
| pg_trgm / unaccent | PostgreSQL built-in extensions | enabled by Flyway |
| pgvector | 0.7+ | optional, enable khi cần semantic search |
| LibreOffice (headless, cho JODConverter) | 7.4 | 7.6+ |
| Flyway | 9.x | 10.x |
