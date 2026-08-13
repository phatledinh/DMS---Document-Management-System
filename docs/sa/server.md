# Server & Deployment — DMS

> Cấu hình server, triển khai và môi trường chạy cho hệ thống DMS.

---

## 1. Server Architecture

### Single Server — Development & MVP

Hệ thống dùng **PostgreSQL-only**: PostgreSQL là source of truth cho metadata/audience/lifecycle/log và đồng thời là search engine bằng Full-Text Search (`tsvector`/`tsquery`), GIN index, `pg_trgm`, `unaccent` và tùy chọn `pgvector`. Không triển khai Elasticsearch/OpenSearch trong MVP.

```text
Single Server / VPS
├── Frontend Container (Nginx + React): 80/443
├── Backend API Container (Spring Boot profile=api): 8080
│   └── REST API, auth, resource access policy, metadata, presigned URL signing, RabbitMQ publish
├── Worker Container (Spring Boot profile=worker)
│   └── RabbitMQ consumers, PDFBox/POI, LibreOffice, VietOCR, PostgreSQL FTS refresh
├── RabbitMQ Container: 5672 / 15672
│   └── dms.tasks, retry queues, DLQ
├── PostgreSQL Container: 5432
│   └── DB + Full-Text Search + pg_trgm + optional pgvector
├── Redis Container: 6379
│   └── Cache/suggestions
└── MinIO Object Storage
    └── Private dev bucket: dms-documents, S3-compatible API, CORS for frontend
```

### Separated Services — Production Scale

```text
CDN / Nginx ──> Load Balancer ──> Backend API xN ──publish──> RabbitMQ
       │                                      │                     │
       └──────────── presigned PUT/GET ──────▶│                     ▼
                                      ├── PostgreSQL managed/HA   Worker xN
                                      ├── Redis cluster             │
                                      └── Cloudflare R2 ◀───────────┘
                                          (private S3-compatible object storage)
```

---


## Trash Purge & Batch Operation Runtime

- Backend chạy scheduled job `purgeDeletedDocuments` hằng ngày, mặc định 02:00 server time.
- Job xử lý các document `status = DELETED` và `purge_after <= now()`; soft delete thông thường không xóa object storage ngay.
- Production nhiều backend instance phải dùng ShedLock hoặc cơ chế distributed lock tương đương để tránh nhiều node purge cùng một document.
- Object storage deletion phải idempotent: object đã mất được xem là thành công, lỗi tạm thời được log để retry.
- Batch upload nên giới hạn số file/request bằng `BATCH_UPLOAD_MAX_FILES`; mỗi file vẫn chịu `FILE_MAX_SIZE`.
- Trash storage và total storage trên dashboard lấy từ PostgreSQL metadata, không gọi object storage provider trong request dashboard.

---

## 2. Docker Compose (Development)

```yaml
# docker-compose.yml
version: "3.8"

services:
    frontend:
        build:
            context: ./frontend
            dockerfile: Dockerfile
        ports:
            - "3000:80"
        depends_on:
            backend:
                condition: service_healthy
        environment:
            - VITE_API_URL=http://localhost:8080/api/v1

    backend:
        build:
            context: ./backend
            dockerfile: Dockerfile
        ports:
            - "8080:8080"
        depends_on:

    worker:
        build:
            context: ./backend
            dockerfile: Dockerfile
        depends_on:
            postgresql:
                condition: service_healthy
            minio:
                condition: service_healthy
            rabbitmq:
                condition: service_healthy
        environment:
            - SPRING_PROFILES_ACTIVE=worker,dev
            - SPRING_DATASOURCE_URL=jdbc:postgresql://postgresql:5432/dms
            - SPRING_DATASOURCE_USERNAME=dms_user
            - SPRING_DATASOURCE_PASSWORD=dms_password
            - SPRING_RABBITMQ_HOST=rabbitmq
            - SPRING_RABBITMQ_PORT=5672
            - SPRING_RABBITMQ_USERNAME=dms
            - SPRING_RABBITMQ_PASSWORD=dms_password
            - STORAGE_ENDPOINT=http://minio:9000
            - STORAGE_BUCKET=dms-documents
            - STORAGE_ACCESS_KEY=dms_minio
            - STORAGE_SECRET_KEY=dms_minio_password
            - STORAGE_REGION=auto
            - STORAGE_PATH_STYLE_ACCESS=true
            - PROCESSING_MAX_ATTEMPTS=3

    rabbitmq:
        image: rabbitmq:3-management
        ports:
            - "5672:5672"
            - "15672:15672"
        environment:
            - RABBITMQ_DEFAULT_USER=dms
            - RABBITMQ_DEFAULT_PASS=dms_password
        volumes:
            - rabbitmq-data:/var/lib/rabbitmq
        healthcheck:
            test: ["CMD", "rabbitmq-diagnostics", "ping"]
            interval: 10s
            timeout: 5s
            retries: 10

    postgresql:
                condition: service_healthy
            redis:
                condition: service_healthy
            minio:
                condition: service_healthy
            rabbitmq:
                condition: service_healthy
        environment:
            - SPRING_PROFILES_ACTIVE=dev
            - SPRING_DATASOURCE_URL=jdbc:postgresql://postgresql:5432/dms
            - SPRING_DATASOURCE_USERNAME=dms_user
            - SPRING_DATASOURCE_PASSWORD=dms_password
            - SPRING_REDIS_HOST=redis
            - SPRING_REDIS_PORT=6379
            - JWT_SECRET=your-256-bit-secret-key-here
            - JWT_ACCESS_EXPIRATION=900000
            - JWT_REFRESH_EXPIRATION=604800000
            - STORAGE_ENDPOINT=http://minio:9000
            - STORAGE_BUCKET=dms-documents
            - STORAGE_ACCESS_KEY=dms_minio
            - STORAGE_SECRET_KEY=dms_minio_password
            - STORAGE_REGION=auto
            - STORAGE_PATH_STYLE_ACCESS=true
            - FILE_MAX_SIZE=52428800
            - CORS_ORIGINS=http://localhost:3000
            - PROCESSING_THREAD_POOL_SIZE=4
            - PROCESSING_RETRY_INTERVAL=PT30M
            - PROCESSING_MAX_RETRY_COUNT=5
            - TRASH_RETENTION_DAYS=30
            - TRASH_PURGE_CRON=0 0 2 * * *
            - BATCH_UPLOAD_MAX_FILES=20
            - STORAGE_PRESIGNED_UPLOAD_TTL=PT5M
            - STORAGE_PRESIGNED_DOWNLOAD_TTL=PT5M
            - SPRING_RABBITMQ_HOST=rabbitmq
            - SPRING_RABBITMQ_PORT=5672
            - SPRING_RABBITMQ_USERNAME=dms
            - SPRING_RABBITMQ_PASSWORD=dms_password
            - PROCESSING_MAX_ATTEMPTS=3
        healthcheck:
            test: ["CMD", "wget", "-qO-", "http://localhost:8080/api/v1/actuator/health"]
            interval: 30s
            timeout: 10s
            retries: 5
            start_period: 60s

    postgresql:
        image: pgvector/pgvector:pg17
        ports:
            - "5432:5432"
        environment:
            - POSTGRES_DB=dms
            - POSTGRES_USER=dms_user
            - POSTGRES_PASSWORD=dms_password
            - TZ=Asia/Ho_Chi_Minh
        volumes:
            - postgresql-data:/var/lib/postgresql/data
            - ./backend/src/main/resources/db/migration:/docker-entrypoint-initdb.d
        healthcheck:
            test: ["CMD-SHELL", "pg_isready -U dms_user -d dms"]
            interval: 10s
            timeout: 5s
            retries: 10

    redis:
        image: redis:7-alpine
        ports:
            - "6379:6379"
        volumes:
            - redis-data:/data
        healthcheck:
            test: ["CMD", "redis-cli", "ping"]
            interval: 10s
            timeout: 5s
            retries: 10

    minio:
        image: minio/minio:latest
        command: server /data --console-address ":9001"
        ports:
            - "9000:9000"
            - "9001:9001"
        environment:
            - MINIO_ROOT_USER=dms_minio
            - MINIO_ROOT_PASSWORD=dms_minio_password
        volumes:
            - minio-data:/data
        healthcheck:
            test: ["CMD", "curl", "-fsS", "http://localhost:9000/minio/health/live"]
            interval: 30s
            timeout: 10s
            retries: 5

volumes:
    postgresql-data:
    redis-data:
    minio-data:
    rabbitmq-data:
```

> Compose trên phục vụ development. Production không expose PostgreSQL, Redis, RabbitMQ management UI hoặc object storage nội bộ ra public network. Bucket object storage luôn private; browser chỉ truy cập bằng presigned URL và CORS allowlist theo frontend origin. PostgreSQL cần extension `unaccent`, `pg_trgm` và tùy chọn `vector`; dev/local có thể tạo bằng Flyway migration, còn staging/production cần DBA/platform pre-provision hoặc cấp quyền tạo extension cho migration user trước khi chạy migration.

---

## 3. Environment Configuration

### Backend — application.yml

```yaml
server:
    port: 8080
    servlet:
        context-path: /api/v1

spring:
    servlet:
        multipart:
            max-file-size: 1MB
            max-request-size: 1MB

    rabbitmq:
        host: ${SPRING_RABBITMQ_HOST:localhost}
        port: ${SPRING_RABBITMQ_PORT:5672}
        username: ${SPRING_RABBITMQ_USERNAME:dms}
        password: ${SPRING_RABBITMQ_PASSWORD:dms_password}

    datasource:
        url: ${SPRING_DATASOURCE_URL:jdbc:postgresql://localhost:5432/dms}
        username: ${SPRING_DATASOURCE_USERNAME:dms_user}
        password: ${SPRING_DATASOURCE_PASSWORD:dms_password}

    jpa:
        hibernate:
            ddl-auto: validate
        show-sql: false
        properties:
            hibernate:
                format_sql: true
                dialect: org.hibernate.dialect.PostgreSQLDialect

    jackson:
        date-format: yyyy-MM-dd'T'HH:mm:ss
        time-zone: Asia/Ho_Chi_Minh

app:
    jwt:
        secret: ${JWT_SECRET}
        access-expiration: ${JWT_ACCESS_EXPIRATION:900000}
        refresh-expiration: ${JWT_REFRESH_EXPIRATION:604800000}
    storage:
        s3:
            endpoint: ${STORAGE_ENDPOINT:http://localhost:9000}
            bucket: ${STORAGE_BUCKET:dms-documents}
            access-key: ${STORAGE_ACCESS_KEY}
            secret-key: ${STORAGE_SECRET_KEY}
            region: ${STORAGE_REGION:auto}
            path-style-access: ${STORAGE_PATH_STYLE_ACCESS:true}
        max-file-size: ${FILE_MAX_SIZE:52428800}
        presigned-upload-ttl: ${STORAGE_PRESIGNED_UPLOAD_TTL:PT5M}
        presigned-download-ttl: ${STORAGE_PRESIGNED_DOWNLOAD_TTL:PT5M}
    cors:
        allowed-origins: ${CORS_ORIGINS:http://localhost:3000}
    search:
        language: ${SEARCH_LANGUAGE:simple}
        enable-unaccent: true
        enable-trigram: true
        enable-vector-search: ${SEARCH_ENABLE_VECTOR:false}
    processing:
        thread-pool-size: ${PROCESSING_THREAD_POOL_SIZE:4}
        retry-interval: ${PROCESSING_RETRY_INTERVAL:PT30M}
        max-retry-count: ${PROCESSING_MAX_RETRY_COUNT:5}
```

### Profiles

| Profile | Mô tả                  | Database/Search              | Object Storage                       |
| ------- | ---------------------- | ---------------------------- | ------------------------------------ |
| `dev`   | Development local      | PostgreSQL container + FTS   | MinIO container                      |
| `test`  | Unit/Integration tests | Testcontainers PostgreSQL    | Testcontainers MinIO hoặc S3 mock    |
| `prod`  | Production             | PostgreSQL managed/HA + FTS  | Cloudflare R2 qua S3-compatible API  |

### Async Processing & Scheduler

- Content extraction, OCR, preview convert và refresh search vector chạy nền qua RabbitMQ worker riêng.
- Retry job chạy mỗi 30 phút cho lỗi extraction/search refresh tạm thời.
- Khi chạy nhiều backend instance, scheduler phải dùng locking như ShedLock để tránh nhiều node retry cùng một tài liệu.
- Tài liệu lỗi tạm thời giữ `EXTRACTION_FAILED`, ghi retry count và cho phép Admin retry thủ công.

---

## 4. Nginx Configuration (Frontend + Reverse Proxy)

```nginx
# nginx.conf
server {
    listen 80;
    server_name dms.example.com;

    location / {
        root /usr/share/nginx/html;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    location /api/v1/ {
        proxy_pass http://backend:8080/api/v1/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        client_max_body_size 50M;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }

    location /api/v1/swagger-ui/ {
        proxy_pass http://backend:8080/api/v1/swagger-ui/;
    }

    location /api/v1/v3/api-docs {
        proxy_pass http://backend:8080/api/v1/v3/api-docs;
    }
}
```

Swagger UI dùng đường dẫn theo SpringDoc + context path: `/api/v1/swagger-ui/index.html`; OpenAPI JSON: `/api/v1/v3/api-docs`.

---

## 5. Dockerfiles

### Backend Dockerfile

```dockerfile
# backend/Dockerfile
FROM eclipse-temurin:25-jdk AS build
WORKDIR /app
COPY mvnw .
COPY .mvn .mvn
COPY pom.xml .
COPY src ./src
RUN chmod +x ./mvnw && ./mvnw clean package -DskipTests

FROM eclipse-temurin:25-jre
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends libreoffice libreoffice-writer libreoffice-calc fontconfig fonts-dejavu wget \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

Backend build/runtime chuẩn hóa trên Java 25 (`eclipse-temurin:25-jdk` / `25-jre`) và project build phải target release 25. Runtime cần LibreOffice headless để JODConverter convert Word/Excel sang PDF hoặc HTML preview. Nếu dùng Alpine, cần kiểm tra lại khả năng cài LibreOffice, font tiếng Việt và availability của image JRE 25 phù hợp.

### Frontend Dockerfile

```dockerfile
# frontend/Dockerfile
FROM node:20-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

---

## 6. Storage Configuration

Storage layer chuẩn hóa theo S3-compatible API: môi trường dev/local dùng MinIO container; production dùng Cloudflare R2. Backend chỉ phụ thuộc `StorageService`, không phụ thuộc trực tiếp nhà cung cấp storage.

### S3-compatible Object Key Structure

Object key dùng UUID, không dùng trực tiếp tên file user nhập. Version mới không ghi đè version cũ. Cùng một cấu trúc key được dùng cho MinIO dev và Cloudflare R2 production.

```text
Bucket: dms-documents

objects/
  ├── documents/2026/07/{documentUuid}/versions/{versionUuid}/original.pdf
  ├── documents/2026/07/{documentUuid}/versions/{versionUuid}/preview.pdf
  ├── documents/2026/07/{documentUuid}/versions/{versionUuid}/thumbnail.png
  └── documents/2026/08/{documentUuid}/versions/{versionUuid}/original.docx
```

### Storage Service Abstraction

```java
public interface StorageService {
    StorageResult upload(MultipartFile file, String objectKey);
    void delete(String objectKey);
    Resource download(String objectKey);
    String generatePreviewUrl(String objectKey);
}
```

| Môi trường                  | Implementation        | Mô tả                                                        |
| --------------------------- | --------------------- | ------------------------------------------------------------ |
| Development / single server | `S3StorageService`    | Kết nối MinIO container qua S3-compatible API                |
| Production scale            | `S3StorageService`    | Kết nối Cloudflare R2 qua S3-compatible API và pre-signed URL |

---

## 7. Server Requirements

### Minimum Requirements

| Resource    | Yêu cầu                                               |
| ----------- | ----------------------------------------------------- |
| **CPU**     | 2 vCPUs                                               |
| **RAM**     | 6 GB                                                  |
| **Storage** | 80 GB SSD (OS + App + Documents + PostgreSQL data/indexes) |
| **OS**      | Ubuntu 22.04 LTS / Debian 12                          |
| **Network** | 100 Mbps                                              |

### Recommended Production Scale

| Resource    | Yêu cầu                                                       |
| ----------- | ------------------------------------------------------------- |
| **CPU**     | 4+ vCPUs cho backend, tách managed PostgreSQL khi tăng tải     |
| **RAM**     | 8+ GB cho backend/app server; PostgreSQL sizing riêng nếu managed/self-host |
| **Storage** | 200 GB SSD + MinIO/S3-compatible object storage               |
| **OS**      | Ubuntu 22.04 LTS                                              |
| **Network** | 1 Gbps                                                        |

---

## 8. Port Mapping

### Development

| Service               | Internal Port | External Port | Mô tả                           |
| --------------------- | :-----------: | :-----------: | ------------------------------- |
| Nginx (Frontend)      |      80       |     3000      | Web UI dev                      |
| Spring Boot (Backend) |     8080      |     8080      | REST API                        |
| PostgreSQL            |     5432      |     5432      | Database + search dev           |
| Redis                 |     6379      |     6379      | Cache dev                       |
| Swagger UI            |     8080      |     8080      | `/api/v1/swagger-ui/index.html` |

### Production

| Service               | Public Port  | Ghi chú                                         |
| --------------------- | :----------: | ----------------------------------------------- |
| Nginx / Load Balancer |    80/443    | Chỉ public entrypoint; HTTP redirect sang HTTPS |
| Backend               | Không public | Private network sau Nginx/LB                    |
| PostgreSQL            | Không public | Private network / managed database + FTS        |
| Redis                 | Không public | Private network                                 |

---

## 9. Monitoring & Logging

| Công cụ                  | Mô tả                 |
| ------------------------ | --------------------- |
| **Spring Boot Actuator** | Health check, metrics |
| **Prometheus**           | Metrics collection    |
| **Grafana**              | Dashboard monitoring  |
| **ELK Stack**            | Centralized logging   |

### Health Check Endpoints

```text
GET /api/v1/actuator/health         → Application health
GET /api/v1/actuator/info           → Application info
GET /api/v1/actuator/metrics        → Application metrics
PostgreSQL health được kiểm tra qua datasource health indicator / `pg_isready`
```

Actuator production chỉ nên expose endpoint cần thiết, không public toàn bộ metrics/env/config.

---

## 10. Backup Strategy

| Đối tượng            | Tần suất                                                 | Phương pháp                                   | Retention |
| -------------------- | -------------------------------------------------------- | --------------------------------------------- | --------- |
| PostgreSQL Database | Hàng ngày (2:00 AM) | `pg_dump`/managed snapshot + WAL backup; bao gồm search tables/index definitions | 30 ngày |
| MinIO Object Storage | Hàng ngày | Bucket replication hoặc object storage backup | 90 ngày |
| Redis | Không backup (cache) | — | — |
| Application Logs     | Hàng ngày                                                | Logrotate / centralized logging               | 30 ngày   |

`document_search_index` có thể rebuild từ PostgreSQL source tables + `document_contents`; backup PostgreSQL vẫn cần giữ migration tạo extension/index để restore đầy đủ.

---

## 11. Production Hardening

- Không commit secrets; `JWT_SECRET`, database password và object storage keys lấy từ `.env`, Docker secrets hoặc secret manager.
- `JWT_SECRET` phải đủ mạnh cho HMAC 256-bit trở lên; không dùng placeholder ở production.
- Refresh Token lưu HttpOnly Cookie; production cùng site/domain ưu tiên `Secure`, `SameSite=Strict`, domain/path rõ ràng. Nếu frontend/backend khác site, dùng `SameSite=None; Secure` kèm credentialed CORS allowlist và CSRF protection.
- Chỉ expose 80/443 ra public; PostgreSQL, Redis và PostgreSQL FTS chỉ nằm trong private network.
- CORS giới hạn theo domain thật, không dùng wildcard cho credentialed requests.
- Bật HTTPS/TLS và redirect HTTP sang HTTPS.
- Giới hạn upload ở cả Nginx và Spring Boot (`50MB`) để tránh timeout hoặc bypass validation.
- HTML preview và PostgreSQL FTS highlight phải được sanitize trước khi render để tránh XSS.
- Backup dữ liệu nhạy cảm nên mã hóa và kiểm thử restore định kỳ.
