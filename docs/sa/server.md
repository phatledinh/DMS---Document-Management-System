# Server & Deployment — DMS

> Cấu hình server, triển khai và môi trường chạy cho hệ thống DMS.

---

## 1. Server Architecture

### Phase 1 — Single Server (Development & MVP)

Elasticsearch được triển khai ngay từ Phase 1 theo kiến trúc **Elasticsearch-first**. MySQL lưu metadata và dữ liệu quan hệ; Elasticsearch phục vụ full-text search, permission-aware filter, facets, highlight và suggestions. Phase 1 không dùng MySQL Full-text Search làm fallback.

```text
┌──────────────────────────────────────────────────────────────┐
│                    Single Server / VPS                       │
│                                                              │
│  ┌─────────────────────┐  ┌──────────────────────────────┐  │
│  │  Frontend Container │  │  Backend Container           │  │
│  │  (Nginx + React)    │  │  (Spring Boot + LibreOffice) │  │
│  │  Port: 80/443       │  │  Port: 8080                  │  │
│  └─────────────────────┘  └──────────────────────────────┘  │
│                                                              │
│  ┌─────────────────────┐  ┌──────────────────────────────┐  │
│  │  MySQL Container    │  │  Redis Container             │  │
│  │  Port: 3306         │  │  Port: 6379                  │  │
│  └─────────────────────┘  └──────────────────────────────┘  │
│                                                              │
│  ┌─────────────────────┐  ┌──────────────────────────────┐  │
│  │ Elasticsearch       │  │ File Storage (Local Disk)    │  │
│  │ Single-node         │  │ /storage/documents/...       │  │
│  │ Port: 9200          │  │                              │  │
│  └─────────────────────┘  └──────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### Phase 2 — Separated Services / Production Scale

```text
┌──────────┐     ┌──────────────────┐     ┌───────────────┐
│  CDN /   │────→│   Load Balancer  │────→│  Backend xN   │
│  Nginx   │     │   (Nginx)        │     │  Spring Boot  │
└──────────┘     └──────────────────┘     └───────┬───────┘
                                                   │
                          ┌────────────────────────┼────────────┐
                          ▼                        ▼            ▼
                  ┌──────────────┐          ┌──────────┐  ┌────────────┐
                  │   MySQL      │          │  Redis   │  │    S3 /    │
                  │   Primary    │          │  Cluster │  │   MinIO    │
                  └──────┬───────┘          └──────────┘  └────────────┘
                         │
                  ┌──────▼───────┐
                  │ Elasticsearch│
                  │   Cluster    │
                  └──────────────┘
```

---

## 2. Docker Compose (Development)

```yaml
# docker-compose.yml
version: '3.8'

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
      mysql:
        condition: service_healthy
      redis:
        condition: service_healthy
      elasticsearch:
        condition: service_healthy
    environment:
      - SPRING_PROFILES_ACTIVE=dev
      - SPRING_DATASOURCE_URL=jdbc:mysql://mysql:3306/dms?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Ho_Chi_Minh
      - SPRING_DATASOURCE_USERNAME=dms_user
      - SPRING_DATASOURCE_PASSWORD=dms_password
      - SPRING_REDIS_HOST=redis
      - SPRING_REDIS_PORT=6379
      - ELASTICSEARCH_URL=http://elasticsearch:9200
      - JWT_SECRET=your-256-bit-secret-key-here
      - JWT_ACCESS_EXPIRATION=900000
      - JWT_REFRESH_EXPIRATION=604800000
      - FILE_STORAGE_PATH=/storage/documents
      - FILE_MAX_SIZE=52428800
      - CORS_ORIGINS=http://localhost:3000
      - PROCESSING_THREAD_POOL_SIZE=4
      - PROCESSING_RETRY_INTERVAL=PT30M
      - PROCESSING_MAX_RETRY_COUNT=5
    volumes:
      - document-storage:/storage/documents
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:8080/api/v1/actuator/health"]
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 60s

  mysql:
    image: mysql:8.0
    ports:
      - "3306:3306"
    environment:
      - MYSQL_ROOT_PASSWORD=root_password
      - MYSQL_DATABASE=dms
      - MYSQL_USER=dms_user
      - MYSQL_PASSWORD=dms_password
    volumes:
      - mysql-data:/var/lib/mysql
      - ./backend/src/main/resources/db/migration:/docker-entrypoint-initdb.d
    command: --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci --default-time-zone='+07:00'
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-u", "dms_user", "-pdms_password"]
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

  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.11.4
    ports:
      - "9200:9200"
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
      - ES_JAVA_OPTS=-Xms1g -Xmx1g
    volumes:
      - es-data:/usr/share/elasticsearch/data
    healthcheck:
      test: ["CMD-SHELL", "curl -fsS http://localhost:9200/_cluster/health || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 10
      start_period: 60s

volumes:
  mysql-data:
  redis-data:
  es-data:
  document-storage:
```

> Compose trên phục vụ development. Production không expose MySQL, Redis hoặc Elasticsearch ra public network.

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
      max-file-size: 50MB
      max-request-size: 50MB

  jpa:
    hibernate:
      ddl-auto: validate
    show-sql: false
    properties:
      hibernate:
        format_sql: true
        dialect: org.hibernate.dialect.MySQLDialect

  jackson:
    date-format: yyyy-MM-dd'T'HH:mm:ss
    time-zone: Asia/Ho_Chi_Minh

app:
  jwt:
    secret: ${JWT_SECRET}
    access-expiration: ${JWT_ACCESS_EXPIRATION:900000}
    refresh-expiration: ${JWT_REFRESH_EXPIRATION:604800000}
  storage:
    path: ${FILE_STORAGE_PATH:/storage/documents}
    max-file-size: ${FILE_MAX_SIZE:52428800}
  cors:
    allowed-origins: ${CORS_ORIGINS:http://localhost:3000}
  elasticsearch:
    url: ${ELASTICSEARCH_URL:http://localhost:9200}
    index-name: ${ELASTICSEARCH_INDEX_NAME:documents}
  processing:
    thread-pool-size: ${PROCESSING_THREAD_POOL_SIZE:4}
    retry-interval: ${PROCESSING_RETRY_INTERVAL:PT30M}
    max-retry-count: ${PROCESSING_MAX_RETRY_COUNT:5}
```

### Profiles

| Profile | Mô tả | Database | Search | File Storage |
|---------|-------|----------|--------|-------------|
| `dev` | Development local | MySQL container/localhost | Elasticsearch single-node | Local disk |
| `test` | Unit/Integration tests | H2 hoặc Testcontainers MySQL | Testcontainers Elasticsearch | Temp directory |
| `prod` | Production | MySQL managed/cluster | Elasticsearch cluster | S3/MinIO |

### Async Processing & Scheduler

- Content extraction và indexing chạy nền bằng Spring `@Async` + `ThreadPoolTaskExecutor`.
- Retry job chạy mỗi 30 phút cho lỗi extraction/indexing tạm thời.
- Khi chạy nhiều backend instance ở Phase 2, scheduler phải dùng locking như ShedLock để tránh nhiều node retry cùng một tài liệu.
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
FROM eclipse-temurin:17-jdk AS build
WORKDIR /app
COPY mvnw .
COPY .mvn .mvn
COPY pom.xml .
COPY src ./src
RUN chmod +x ./mvnw && ./mvnw clean package -DskipTests

FROM eclipse-temurin:17-jre
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends libreoffice libreoffice-writer libreoffice-calc fontconfig fonts-dejavu wget \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /storage/documents
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

Backend runtime cần LibreOffice headless để JODConverter convert Word/Excel sang PDF hoặc HTML preview. Nếu dùng Alpine, cần kiểm tra lại khả năng cài LibreOffice và font tiếng Việt.

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

### File Storage Structure

Storage path dùng UUID, không dùng trực tiếp tên file user nhập. Version mới không ghi đè version cũ.

```text
/storage/documents/
  ├── 2026/
  │   ├── 07/
  │   │   ├── {documentUuid}/
  │   │   │   ├── versions/
  │   │   │   │   ├── {versionUuid}/
  │   │   │   │   │   ├── original.pdf
  │   │   │   │   │   ├── preview.pdf
  │   │   │   │   │   └── thumbnail.png
  │   │   │   │   └── {versionUuid}/
  │   │   │   │       └── original.docx
  │   │   │   └── current -> versions/{currentVersionUuid}
  │   │   └── ...
  │   └── 08/
  │       └── ...
  └── ...
```

### Storage Service Abstraction

```java
public interface StorageService {
    StorageResult upload(MultipartFile file, String path);
    void delete(String storagePath);
    Resource download(String storagePath);
    String generatePreviewUrl(String storagePath);
}
```

| Phase | Implementation | Mô tả |
|-------|---------------|-------|
| Phase 1 | `LocalStorageService` | Lưu file trên disk server theo path có document/version UUID |
| Phase 2 | `S3StorageService` | AWS S3 / MinIO với Pre-signed URL |

---

## 7. Server Requirements

### Minimum Requirements (Phase 1)

| Resource | Yêu cầu |
|----------|---------|
| **CPU** | 2 vCPUs |
| **RAM** | 6 GB |
| **Storage** | 80 GB SSD (OS + App + Documents + Elasticsearch data) |
| **OS** | Ubuntu 22.04 LTS / Debian 12 |
| **Network** | 100 Mbps |

### Recommended (Phase 2)

| Resource | Yêu cầu |
|----------|---------|
| **CPU** | 4+ vCPUs cho backend, tách node DB/Search khi tăng tải |
| **RAM** | 8+ GB cho backend/app server, Elasticsearch node sizing riêng |
| **Storage** | 200 GB SSD + Object Storage (S3/MinIO) |
| **OS** | Ubuntu 22.04 LTS |
| **Network** | 1 Gbps |

---

## 8. Port Mapping

### Development

| Service | Internal Port | External Port | Mô tả |
|---------|:---:|:---:|-------|
| Nginx (Frontend) | 80 | 3000 | Web UI dev |
| Spring Boot (Backend) | 8080 | 8080 | REST API |
| MySQL | 3306 | 3306 | Database dev |
| Redis | 6379 | 6379 | Cache dev |
| Elasticsearch | 9200 | 9200 | Search dev |
| Swagger UI | 8080 | 8080 | `/api/v1/swagger-ui/index.html` |

### Production

| Service | Public Port | Ghi chú |
|---------|:---:|---------|
| Nginx / Load Balancer | 80/443 | Chỉ public entrypoint; HTTP redirect sang HTTPS |
| Backend | Không public | Private network sau Nginx/LB |
| MySQL | Không public | Private network / managed database |
| Redis | Không public | Private network |
| Elasticsearch | Không public | Private network / protected cluster |

---

## 9. Monitoring & Logging (Phase 2+)

| Công cụ | Mô tả |
|---------|-------|
| **Spring Boot Actuator** | Health check, metrics |
| **Prometheus** | Metrics collection |
| **Grafana** | Dashboard monitoring |
| **ELK Stack** | Centralized logging |

### Health Check Endpoints

```text
GET /api/v1/actuator/health         → Application health
GET /api/v1/actuator/info           → Application info
GET /api/v1/actuator/metrics        → Application metrics
GET /_cluster/health                → Elasticsearch health
```

Actuator production chỉ nên expose endpoint cần thiết, không public toàn bộ metrics/env/config.

---

## 10. Backup Strategy

| Đối tượng | Tần suất | Phương pháp | Retention |
|-----------|----------|-------------|-----------|
| MySQL Database | Hàng ngày (2:00 AM) | `mysqldump`/snapshot + gzip | 30 ngày |
| File Storage | Hàng ngày | `rsync` hoặc object storage replication | 90 ngày |
| Elasticsearch | Không bắt buộc Phase 1; snapshot Phase 2 | Re-index từ MySQL hoặc ES snapshot repository | 7–30 ngày |
| Redis | Không backup (cache) | — | — |
| Application Logs | Hàng ngày | Logrotate / centralized logging | 30 ngày |

Elasticsearch index có thể rebuild từ MySQL + `document_contents`; Phase 2 nên cấu hình snapshot nếu index lớn, analyzer/dictionary phức tạp hoặc thời gian rebuild không chấp nhận được.

---

## 11. Production Hardening

- Không commit secrets; `JWT_SECRET`, database password và object storage keys lấy từ `.env`, Docker secrets hoặc secret manager.
- `JWT_SECRET` phải đủ mạnh cho HMAC 256-bit trở lên; không dùng placeholder ở production.
- Refresh Token lưu HttpOnly Cookie; production bật `Secure`, `SameSite=Lax` hoặc `Strict`, domain/path rõ ràng.
- Chỉ expose 80/443 ra public; MySQL, Redis và Elasticsearch chỉ nằm trong private network.
- CORS giới hạn theo domain thật, không dùng wildcard cho credentialed requests.
- Bật HTTPS/TLS và redirect HTTP sang HTTPS.
- Giới hạn upload ở cả Nginx và Spring Boot (`50MB`) để tránh timeout hoặc bypass validation.
- HTML preview và Elasticsearch highlight phải được sanitize trước khi render để tránh XSS.
- Backup dữ liệu nhạy cảm nên mã hóa và kiểm thử restore định kỳ.
