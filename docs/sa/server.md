# Server & Deployment — DMS

> Cấu hình server, triển khai và môi trường chạy cho hệ thống DMS.

---

## 1. Server Architecture

### Phase 1 — Single Server (Development & MVP)

```text
┌──────────────────────────────────────────────────────────┐
│                   Single Server / VPS                     │
│                                                          │
│  ┌─────────────────────┐  ┌────────────────────────────┐ │
│  │  Frontend Container │  │  Backend Container         │ │
│  │  (Nginx + React)    │  │  (Spring Boot JAR)         │ │
│  │  Port: 80/443       │  │  Port: 8080                │ │
│  └─────────────────────┘  └────────────────────────────┘ │
│                                                          │
│  ┌─────────────────────┐  ┌────────────────────────────┐ │
│  │  MySQL Container    │  │  Redis Container           │ │
│  │  Port: 3306         │  │  Port: 6379                │ │
│  └─────────────────────┘  └────────────────────────────┘ │
│                                                          │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  File Storage (Local Disk)                           │ │
│  │  /storage/documents/YYYY/MM/{uuid}_original.ext      │ │
│  └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### Phase 2 — Separated Services

```text
┌──────────┐     ┌──────────────────┐     ┌───────────────┐
│  CDN /   │────→│   Load Balancer  │────→│  Backend x2   │
│  Nginx   │     │   (Nginx)        │     │  (Spring Boot)│
└──────────┘     └──────────────────┘     └───────┬───────┘
                                                   │
                          ┌────────────────────────┼────────┐
                          ▼                        ▼        ▼
                  ┌──────────────┐  ┌──────────┐  ┌────────────┐
                  │   MySQL      │  │  Redis   │  │    S3 /    │
                  │   (Primary)  │  │  Cluster │  │   MinIO    │
                  └──────────────┘  └──────────┘  └────────────┘
                          │
                  ┌──────────────┐
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
  # --- Frontend ---
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "3000:80"
    depends_on:
      - backend
    environment:
      - VITE_API_URL=http://localhost:8080/api/v1

  # --- Backend ---
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "8080:8080"
    depends_on:
      - mysql
      - redis
    environment:
      - SPRING_PROFILES_ACTIVE=dev
      - SPRING_DATASOURCE_URL=jdbc:mysql://mysql:3306/dms?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Ho_Chi_Minh
      - SPRING_DATASOURCE_USERNAME=dms_user
      - SPRING_DATASOURCE_PASSWORD=dms_password
      - SPRING_REDIS_HOST=redis
      - SPRING_REDIS_PORT=6379
      - JWT_SECRET=your-256-bit-secret-key-here
      - JWT_ACCESS_EXPIRATION=900000       # 15 phút (ms)
      - JWT_REFRESH_EXPIRATION=604800000   # 7 ngày (ms)
      - FILE_STORAGE_PATH=/storage/documents
      - FILE_MAX_SIZE=52428800             # 50MB
    volumes:
      - document-storage:/storage/documents

  # --- MySQL ---
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
      - ./backend/src/main/resources/schema.sql:/docker-entrypoint-initdb.d/01-schema.sql
    command: --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci --default-time-zone='+07:00'

  # --- Redis ---
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data

volumes:
  mysql-data:
  redis-data:
  document-storage:
```

---

## 3. Environment Configuration

### Backend — application.yml

```yaml
# application.yml (common)
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

# Custom properties
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
```

### Profiles

| Profile | Mô tả | Database | File Storage |
|---------|-------|----------|-------------|
| `dev` | Development local | MySQL localhost:3306 | Local disk |
| `test` | Unit/Integration tests | H2 in-memory | Temp directory |
| `prod` | Production | MySQL cloud | S3/MinIO (Phase 2) |

---

## 4. Nginx Configuration (Frontend + Reverse Proxy)

```nginx
# nginx.conf
server {
    listen 80;
    server_name dms.example.com;

    # Frontend (React SPA)
    location / {
        root /usr/share/nginx/html;
        index index.html;
        try_files $uri $uri/ /index.html;  # SPA fallback
    }

    # Backend API Proxy
    location /api/ {
        proxy_pass http://backend:8080/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # File upload
        client_max_body_size 50M;
        proxy_read_timeout 300s;
    }

    # Swagger UI
    location /swagger-ui/ {
        proxy_pass http://backend:8080/swagger-ui/;
    }
}
```

---

## 5. Dockerfiles

### Backend Dockerfile

```dockerfile
# backend/Dockerfile
FROM eclipse-temurin:17-jdk-alpine AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN ./mvnw clean package -DskipTests

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar

# Create storage directory
RUN mkdir -p /storage/documents

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

### Frontend Dockerfile

```dockerfile
# frontend/Dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

---

## 6. Storage Configuration

### File Storage Structure

```text
/storage/documents/
  ├── 2026/
  │   ├── 07/
  │   │   ├── {uuid}_original.pdf
  │   │   ├── {uuid}_preview.pdf
  │   │   └── {uuid}_thumbnail.png
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
| Phase 1 | `LocalStorageService` | Lưu file trên disk server |
| Phase 2 | `S3StorageService` | AWS S3 / MinIO với Pre-signed URL |

---

## 7. Server Requirements

### Minimum Requirements (Phase 1)

| Resource | Yêu cầu |
|----------|---------|
| **CPU** | 2 vCPUs |
| **RAM** | 4 GB |
| **Storage** | 50 GB SSD (OS + App + Documents) |
| **OS** | Ubuntu 22.04 LTS / CentOS 8+ |
| **Network** | 100 Mbps |

### Recommended (Phase 2)

| Resource | Yêu cầu |
|----------|---------|
| **CPU** | 4 vCPUs |
| **RAM** | 8 GB |
| **Storage** | 200 GB SSD + Object Storage (S3) |
| **OS** | Ubuntu 22.04 LTS |
| **Network** | 1 Gbps |

---

## 8. Port Mapping

| Service | Internal Port | External Port | Mô tả |
|---------|:---:|:---:|-------|
| Nginx (Frontend) | 80 | 80/443 | Web UI |
| Spring Boot (Backend) | 8080 | 8080 | REST API |
| MySQL | 3306 | 3306 | Database |
| Redis | 6379 | 6379 | Cache |
| Elasticsearch | 9200 | 9200 | Search |
| Swagger UI | 8080 | 8080 | `/swagger-ui.html` |

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
GET /actuator/health         → Application health
GET /actuator/info           → Application info
GET /actuator/metrics        → Application metrics
```

---

## 10. Backup Strategy

| Đối tượng | Tần suất | Phương pháp | Retention |
|-----------|----------|-------------|-----------|
| MySQL Database | Hàng ngày (2:00 AM) | `mysqldump` + gzip | 30 ngày |
| File Storage | Hàng ngày | `rsync` → backup server | 90 ngày |
| Redis | Không backup (cache) | — | — |
| Application Logs | — | Rotate hàng ngày | 30 ngày |
