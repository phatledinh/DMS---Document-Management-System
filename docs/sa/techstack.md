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
│  │  React 18+     │  │  Spring Boot 3 │  │  MySQL 8.0+   │  │
│  │  Vite          │  │  Java 17+      │  │  Redis        │  │
│  │  TypeScript    │  │  Spring Sec 6  │  │  Elasticsearch │  │
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
| **TypeScript** | 5+ | Type safety |

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
│   │   ├── axiosClient.ts
│   │   ├── authApi.ts
│   │   ├── documentApi.ts
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
│   │   ├── auth/
│   │   ├── documents/
│   │   ├── search/
│   │   ├── categories/
│   │   ├── departments/
│   │   ├── tags/
│   │   ├── users/
│   │   ├── dashboard/
│   │   ├── audit/              ← MH16 Audit & Access Log
│   │   └── profile/            ← MH06 Profile cá nhân
│   ├── hooks/                  ← Custom hooks
│   ├── pages/                  ← Route pages
│   ├── store/                  ← Global state
│   ├── types/                  ← TypeScript types/interfaces
│   ├── utils/                  ← Utility functions
│   ├── App.tsx
│   └── main.tsx
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## 2. Backend (BE)

### Core Framework

| Công nghệ | Version | Mô tả |
|-----------|---------|-------|
| **Java** | 17+ | Ngôn ngữ chính |
| **Spring Boot** | 3.x | Framework chính |
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
| **Tesseract OCR** (Phase 2) | OCR cho scanned PDF & images |

> **Phân định trách nhiệm**: **Tika** dùng để phát hiện MIME type thực tế phục vụ validate upload và làm fallback; **PDFBox/POI** là extractor chính lấy `extracted_content` cho Elasticsearch. **POI chỉ trích xuất text, không render** — nên preview Office cần **JODConverter** điều khiển **LibreOffice headless** convert sang PDF/HTML. Docker image backend phải cài sẵn LibreOffice. Với Excel có thể dựng HTML table từ POI rồi sanitize thay vì convert PDF.

### Content Sanitizer & Async Processing

| Thư viện | Mô tả |
|----------|-------|
| **OWASP Java HTML Sanitizer** / **Jsoup** | Sanitize HTML preview & search highlight chống XSS (NFR#11, `HtmlSanitizer`) |
| **Spring `@Async` + `ThreadPoolTaskExecutor`** | Chạy content extraction / indexing nền (F2.2) |
| **Spring `@Scheduled`** (+ **ShedLock** nếu multi-instance) | Auto retry `EXTRACTION_FAILED` mỗi 30 phút (spec §7, F2.2) |

### Data Access — Search, Cache & Migration

| Thư viện | Mô tả |
|----------|-------|
| **Elasticsearch Java Client** (`co.elastic.clients`) 8.x | Client chính cho ES: native query builder (multi-match, boosting, permission filter, facets, highlight) |
| **Spring Data Redis (Lettuce)** | Truy cập Redis cache (categories tree, tags, suggestions) |
| **Flyway** | Version hóa & migrate schema MySQL |

> **Lựa chọn ES client**: dùng **Elasticsearch Java Client 8.x** thay vì Spring Data Elasticsearch vì yêu cầu query phức tạp (permission-aware filter, boost theo thứ tự ưu tiên, faceted aggregation, native highlight) cần điều khiển query ở mức thấp. Kiểm tra ma trận tương thích client ↔ ES 8.11.

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
| **Testcontainers** (MySQL, Elasticsearch, Redis) | Integration test sát production cho ES query, cache, JPA |
| **H2 Database** | In-memory DB cho unit test JPA nhanh (lưu ý lệch hành vi với MySQL 8) |

> Logic cốt lõi (permission-aware ES query, faceted aggregation, Redis cache) không kiểm thử được bằng H2 — ưu tiên **Testcontainers** cho các test này; H2 chỉ dùng cho test JPA đơn giản.

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
│   ├── application.yml                 ← cấu hình multipart max-file-size/max-request-size = 50MB
│   ├── application-dev.yml
│   └── application-prod.yml
├── src/test/
├── pom.xml (hoặc build.gradle)
└── Dockerfile
```

---

## 3. Database (DB)

### Primary Database

| Công nghệ | Version | Mô tả |
|-----------|---------|-------|
| **MySQL** | 8.0+ | Relational database chính |

**Lý do chọn MySQL:**
- Lưu trữ dữ liệu quan hệ và metadata tài liệu
- Ổn định, phổ biến, dễ quản lý
- Tương thích tốt với Spring Data JPA / Hibernate
- Hỗ trợ InnoDB (transactions, foreign keys)

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
| **Elasticsearch** | 8+ | Full-text search engine chính |

**Sử dụng cho:**
- Full-text search trên tiêu đề, mô tả và nội dung trích xuất
- Fuzzy search, synonym, Vietnamese analyzer
- Faceted aggregations theo danh mục, phòng ban, loại file, tags
- Highlight matched snippets và relevance scoring

### Database Schema Overview

```text
┌──────────────────────────────────────────────────────────────┐
│                      MySQL Schema                            │
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
| **MySQL Workbench** / **DBeaver** | Database management |
| **Redis Insight** | Redis GUI |

### Build & Package

| Công cụ | Mô tả |
|---------|-------|
| **Maven** / **Gradle** | Java build tool |
| **npm** / **pnpm** | Frontend package manager |
| **Docker** | Containerization |
| **Docker Compose** | Multi-container orchestration |

### CI/CD (Phase 2+)

| Công cụ | Mô tả |
|---------|-------|
| **GitHub Actions** | CI/CD pipeline |
| **Docker Hub** | Container registry |

---

## 5. Version Compatibility Matrix

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| Java | 17 | 21 |
| Spring Boot | 3.0 | 3.2+ |
| Node.js | 18 | 20 LTS |
| React | 18 | 18.2+ |
| MySQL | 8.0 | 8.0.33+ |
| Redis | 7.0 | 7.2+ |
| Elasticsearch | 8.0 | 8.11+ |
| Elasticsearch Java Client | 8.0 | khớp version ES đang chạy |
| LibreOffice (headless, cho JODConverter) | 7.4 | 7.6+ |
| Flyway | 9.x | 10.x |
