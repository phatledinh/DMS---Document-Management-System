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
│  │  TypeScript    │  │  Spring Sec 6  │  │  ES (Phase 2) │  │
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
| **Day.js** | Date formatting |
| **React Hook Form** + **Zod** | Form validation |
| **React Toastify** | Toast notifications |

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
│   │   └── dashboard/
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
| **Apache Tika** | Content extraction framework |
| **Apache PDFBox** | PDF text extraction |
| **Apache POI** | DOC/DOCX/XLS/XLSX extraction |
| **Tesseract OCR** (Phase 2) | OCR cho scanned PDF & images |

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
| **H2 Database** | In-memory DB cho test |

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
│   │   │   └── PreviewService.java
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
│   └── dashboard/                      ← PH5: Dashboard
│       ├── controller/
│       ├── service/
│       └── dto/
├── src/main/resources/
│   ├── application.yml
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
- Hỗ trợ FULLTEXT Index (Phase 1 search)
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

### Search Engine (Phase 2)

| Công nghệ | Version | Mô tả |
|-----------|---------|-------|
| **Elasticsearch** | 8+ | Full-text search engine |

**Khi nào migrate:**
- Khi lượng tài liệu > 10k documents
- Khi cần fuzzy search, synonym, Vietnamese analyzer
- Khi cần faceted aggregations

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
