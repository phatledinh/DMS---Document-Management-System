# Project Rules — DMS (Document Management System)

> Coding conventions, design rules và best practices cho hệ thống Quản Lý Tài Liệu Nội Bộ.
> Đây là single source of truth — AI tools (Gemini, Cursor, Copilot) và developer đều phải tuân thủ.
> **BẮT BUỘC đọc file này đầu tiên mỗi khi bắt đầu cuộc hội thoại mới.**

---

## 0. Tổng quan dự án

| Thuộc tính | Giá trị |
|---|---|
| **Tên dự án** | DMS — Quản lý & Tìm kiếm Tài liệu Doanh nghiệp |
| **Mục tiêu** | Upload, phân loại, tìm kiếm full-text, preview/download tài liệu nội bộ có phân quyền |
| **Actors** | `ADMIN` (quản trị toàn bộ) / `USER` (search, preview, download) |
| **Repository** | Monorepo: `backend/` (Spring Boot) + `frontend/` (React Vite) - chưa triển khai FE |
| **Root package** | `com.dms` |

---

## 1. Tech Stack

### Backend

| Layer | Technology |
|-------|-----------|
| Language | Java 25 |
| Framework | Spring Boot 4.1.x / Spring Framework 7 |
| Security | Spring Security + oauth2-resource-server (Nimbus JOSE JWT, HS256) |
| Database | Spring Data JPA + PostgreSQL 17+ |
| Search Engine | PostgreSQL Full-Text Search (`tsvector`/`tsquery`, GIN, `pg_trgm`, `unaccent`) |
| Cache | Spring Data Redis (Lettuce) |
| Message Broker | RabbitMQ + Spring AMQP |
| Object Storage | AWS SDK v2 S3-compatible (MinIO dev / Cloudflare R2 prod) |
| File Processing | Apache Tika (MIME detect) + PDFBox (PDF) + POI (Office) + JODConverter + LibreOffice headless |
| Migration | Flyway |
| Build | Maven Wrapper (`mvnw`) |
| Mapping | MapStruct 1.6.x (compile-time) |
| Utility | Lombok (`@Getter`, `@Setter`, `@Builder`) |
| Scheduler | Spring `@Scheduled` + ShedLock (distributed lock) |
| API Docs | SpringDoc OpenAPI (Swagger UI) |
| Validation | Jakarta Bean Validation |
| Test | JUnit 5 + Mockito + Testcontainers (PostgreSQL, RabbitMQ) |

### Frontend (kế hoạch)

| Layer | Technology |
|-------|-----------|
| Framework | React 18+ / Vite 5+ / JavaScript ES2022+ |
| UI Library | Ant Design |
| Styling | CSS Modules |
| State | TanStack Query + Zustand |
| HTTP Client | Axios |
| Routing | React Router v6 |
| Package Manager | pnpm |

### Infrastructure

| Service | Port (Dev) | Image |
|---------|-----------|-------|
| Backend API | 8080 | Spring Boot `profile=api` |
| Worker | — | Spring Boot `profile=worker` |
| PostgreSQL | 5432 | `pgvector/pgvector:pg17` |
| Redis | 6379 | `redis:7-alpine` |
| RabbitMQ | 5672 / 15672 | `rabbitmq:3-management` |
| MinIO | 9000 / 9001 | `minio/minio:latest` |
| Frontend (kế hoạch) | 3000 | Nginx + React build |

---

## 2. Package Structure

```
com.dms/
├── DmsApplication.java
│
├── common/                              ← Shared utilities (cross-cutting)
│   ├── config/                          ← AppConfig, CorsConfig, CacheConfig, RabbitMQConfig
│   ├── exception/                       ← GlobalExceptionHandler, AppException, custom exceptions
│   ├── security/                        ← SecurityConfig, JwtProvider, CustomUserDetailsService
│   └── dto/                             ← ApiResponse<T>, PageResponse<T>
│
├── identity/                            ← PH1: Identity & Auth module
│   ├── controller/                      ← AuthController, UserController
│   ├── service/
│   ├── entity/                          ← User, RefreshToken, Role (enum), UserStatus (enum)
│   ├── repository/
│   ├── dto/
│   └── mapper/
│
├── document/                            ← PH2: Document Management (Core Domain)
│   ├── controller/
│   ├── service/
│   │   ├── DocumentService.java
│   │   ├── DocumentBatchService.java
│   │   ├── DocumentLifecycleService.java
│   │   ├── DocumentStorageStatsService.java
│   │   ├── DocumentAccessPolicyService.java
│   │   ├── StorageService.java          ← S3-compatible presigned URL
│   │   ├── ContentExtractorService.java ← Strategy pattern cho file extraction
│   │   └── PreviewService.java          ← JODConverter/LibreOffice + HtmlSanitizer
│   ├── entity/
│   ├── repository/
│   ├── dto/
│   └── mapper/
│
├── search/                              ← PH3: Search Engine (PostgreSQL FTS)
│   ├── controller/
│   ├── service/                         ← SearchService, SearchRefreshService, SuggestionService
│   └── dto/
│
├── masterdata/                          ← PH4: Master Data (Category, Department, Tag)
│   ├── controller/
│   ├── service/
│   ├── entity/
│   ├── repository/
│   ├── dto/
│   └── mapper/
│
├── dashboard/                           ← PH5: Dashboard & Analytics (Admin only)
│   ├── controller/
│   ├── service/
│   └── dto/
│
└── audit/                               ← PH6: Audit & Access Log
    ├── controller/                      ← AuditLogController (/admin/audit-logs)
    ├── service/                         ← AuditLogService, AccessLogService, SearchLogService
    ├── entity/                          ← AuditLog, AccessLog, SearchLog
    ├── repository/
    └── dto/
```

### Package Rules

- **1 module = 1 phân hệ (PH)**, chứa đầy đủ: `controller/`, `service/`, `entity/`, `repository/`, `dto/`, `mapper/` (nếu cần)
- **Module DTOs** nằm trong `dto/` của module đó, KHÔNG đặt ở `common/dto/`
- `common/dto/` chỉ chứa cross-cutting DTOs: `ApiResponse<T>`, `PageResponse<T>`
- `common/config/`, `common/security/`, `common/exception/` phục vụ toàn bộ ứng dụng
- Test files mirror cùng package structure dưới `src/test/java`
- **Không tạo module mới** ngoài 6 phân hệ + common trừ khi có quyết định kiến trúc rõ ràng

---

## 3. Naming Convention

### Classes

| Type | Pattern | Example |
|---|---|---|
| Entity | `[Name]` | `User`, `Document`, `Category` |
| Controller | `[Feature]Controller` | `AuthController`, `DocumentController` |
| Service | `[Feature]Service` | `DocumentService`, `SearchService` |
| Repository | `[Feature]Repository` | `UserRepository`, `DocumentRepository` |
| DTO request | `[Action/Feature]Request` | `LoginRequest`, `UploadInitRequest` |
| DTO response | `[Feature]Response` | `UserResponse`, `DocumentResponse` |
| Exception | `[Name]Exception` | `ResourceNotFoundException` |
| Config | `[Feature]Config` | `SecurityConfig`, `RabbitMQConfig` |
| Mapper | `[Feature]Mapper` | `UserMapper`, `DocumentMapper` |
| Enum | `[Name]` (PascalCase) | `Role`, `UserStatus`, `DocumentStatus`, `AccessLevel` |

### Methods

| Layer | Convention | Example |
|---|---|---|
| Controller | HTTP verb-oriented | `getUser()`, `createUser()`, `uploadInit()` |
| Service | Business action | `authenticate()`, `softDelete()`, `refreshSearchVector()` |
| Repository | Spring Data convention | `findByEmail()`, `existsByDocumentCode()` |

### Variables & Constants

- `camelCase` cho variables và methods
- `UPPER_SNAKE_CASE` cho constants
- Tên có ý nghĩa, không viết tắt: `userRepository` không phải `userRepo`
- Boolean prefix: `is/has/can` — `isActive`, `hasPermission`, `canDelete`

---

## 4. Entity Rules

```java
@Entity
@Table(name = "documents")
@Getter
@Setter
public class Document {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 500)
    private String title;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private DocumentStatus status = DocumentStatus.AWAITING_UPLOAD;

    @Column(nullable = false, updatable = false)
    private ZonedDateTime createdAt = ZonedDateTime.now();

    private ZonedDateTime updatedAt;
    private ZonedDateTime deletedAt;
}
```

### Rules

- `@Table(name = "...")` với snake_case table name — BẮT BUỘC
- `@Column(nullable, length, unique)` constraints rõ ràng
- `@Enumerated(EnumType.STRING)` — **TUYỆT ĐỐI KHÔNG dùng ORDINAL**
- Dùng `ZonedDateTime` cho timestamp fields
- Dùng **Lombok `@Getter` / `@Setter`** — KHÔNG dùng `@Data` (tránh lỗi JPA `equals/hashCode`)
- `createdAt` / `updatedAt` / `deletedAt` pattern nhất quán cho tất cả entity chính
- Password: LUÔN lưu dạng BCrypt hash
- ID type: `Long` (BIGINT GENERATED BY DEFAULT AS IDENTITY)
- User entity implements `UserDetails` — roles mapping qua `getAuthorities()`

---

## 5. DTO Rules — Java Records

```java
// Request DTO — với Jakarta validation
public record CreateUserRequest(
        @NotBlank(message = "Email is required")
        @Email(message = "Invalid email format")
        String email,

        @NotBlank(message = "Name is required")
        String name,

        @NotBlank(message = "Password is required")
        @Size(min = 8, max = 100)
        String password
) {}

// Response DTO — mapping bằng MapStruct, KHÔNG dùng fromEntity()
public record UserResponse(
        Long id,
        String email,
        String name,
        String role,
        String departmentName,
        ZonedDateTime createdAt
) {}
```

### Rules

- Dùng `record` cho tất cả DTOs — immutable by design
- Request DTOs: **BẮT BUỘC** có Jakarta Bean Validation annotations
- Response DTOs: mapping qua **MapStruct** (xem Section 12)
- **KHÔNG** expose Entity ra ngoài service layer
- **KHÔNG** đặt sensitive fields (password, token) trong response DTOs
- **KHÔNG** đặt `@Entity` hoặc JPA annotations trên DTOs

---

## 6. Service Layer

```java
@Service
public class CategoryService {

    private final CategoryRepository categoryRepository;
    private final CategoryMapper categoryMapper;

    public CategoryService(CategoryRepository categoryRepository,
                           CategoryMapper categoryMapper) {
        this.categoryRepository = categoryRepository;
        this.categoryMapper = categoryMapper;
    }

    @Transactional(readOnly = true)
    public CategoryResponse getCategoryById(Long id) {
        Category category = categoryRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Category", "id", id));
        return categoryMapper.toResponse(category);
    }

    @Transactional
    public CategoryResponse createCategory(CreateCategoryRequest request) {
        // Business validation
        if (categoryRepository.existsBySlug(request.slug())) {
            throw new InvalidRequestException("Slug already exists");
        }
        Category category = categoryMapper.toEntity(request);
        return categoryMapper.toResponse(categoryRepository.save(category));
    }
}
```

### Rules

- **Mặc định dùng class trực tiếp** (không interface) cho service đơn giản
- **Dùng Interface + Impl** chỉ khi: có nhiều implementation hoặc cần abstraction (VD: `StorageService`, `ContentExtractor`, `SearchEngine`)
- `@Service` đặt trên class
- `@Transactional` trên method ghi dữ liệu
- `@Transactional(readOnly = true)` trên method chỉ đọc
- Constructor injection — `final` fields, explicit constructor, **KHÔNG dùng `@Autowired`**
- Entity → DTO conversion qua **MapStruct**, KHÔNG dùng manual mapping
- Service **KHÔNG biết** về HTTP (`HttpServletRequest`, `ResponseEntity`, `HttpStatus`)
- `@Transactional` **chỉ đặt ở Service** — KHÔNG ở Controller hay Repository

---

## 7. Controller Layer

```java
@RestController
@RequestMapping("/categories")
public class CategoryController {

    private final CategoryService categoryService;

    public CategoryController(CategoryService categoryService) {
        this.categoryService = categoryService;
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<CategoryResponse>> getCategory(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(categoryService.getCategoryById(id)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<CategoryResponse>> createCategory(
            @RequestBody @Valid CreateCategoryRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(categoryService.createCategory(request)));
    }
}
```

### Rules

- Controller chỉ làm 3 việc: **nhận request → gọi service → trả response**
- **KHÔNG** có business logic trong controller
- **LUÔN** dùng `@Valid` trên `@RequestBody`
- **LUÔN** trả `ResponseEntity<ApiResponse<T>>`
- **LUÔN** dùng constructor injection — `final` fields
- **KHÔNG** dùng `@Autowired` field injection
- API prefix: context-path đã là `/api/v1` — controller chỉ cần `@RequestMapping("/resources")`
- Logging ở controller: chỉ log nếu có auditing/tracing, KHÔNG log business logic

---

## 8. ApiResponse Wrapper

```java
public record ApiResponse<T>(
        boolean success,
        String message,
        String code,
        T data
) {
    public static <T> ApiResponse<T> success(T data) { ... }
    public static <T> ApiResponse<T> error(String code, String message) { ... }
}
```

### Rules

- **TẤT CẢ** endpoints trả `ApiResponse<T>` — không ngoại lệ
- Dùng factory methods `success()`, `error()` — KHÔNG construct thủ công trong controller
- Pagination: dùng `ApiResponse<PageResponse<T>>`
- Error responses đi qua `GlobalExceptionHandler`

### Error Code Convention

Dùng error code string thay vì HTTP status code trong response body:

| Code | Mô tả |
|------|--------|
| `USER_NOT_FOUND` | User không tồn tại |
| `DOCUMENT_NOT_FOUND` | Tài liệu không tồn tại |
| `CATEGORY_NOT_FOUND` | Danh mục không tồn tại |
| `FILE_TYPE_NOT_SUPPORTED` | Loại file không được hỗ trợ |
| `FILE_SIZE_EXCEEDED` | File vượt quá 50MB |
| `ACCESS_DENIED` | Không có quyền truy cập |
| `EXTRACTION_FAILED` | Trích xuất nội dung thất bại |
| `BATCH_OPERATION_PARTIAL_FAILED` | Batch có item lỗi |

> Danh sách đầy đủ: xem [design.md — Error Codes](./design.md)

---

## 9. Exception Handling

```java
// Base exception
public class AppException extends RuntimeException {
    private final HttpStatus status;
    private final String code;

    public AppException(String code, String message, HttpStatus status) {
        super(message);
        this.code = code;
        this.status = status;
    }
}

// Specific exceptions
public class ResourceNotFoundException extends AppException {
    public ResourceNotFoundException(String resource, String field, Object value) {
        super(resource.toUpperCase() + "_NOT_FOUND",
              "%s not found with %s: %s".formatted(resource, field, value),
              HttpStatus.NOT_FOUND);
    }
}

// Global handler
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(AppException.class)
    public ResponseEntity<ApiResponse<Void>> handleAppException(AppException ex) {
        return ResponseEntity.status(ex.getStatus())
                .body(ApiResponse.error(ex.getCode(), ex.getMessage()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleGeneral(Exception ex) {
        log.error("Unexpected error: ", ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("INTERNAL_ERROR", "Internal server error"));
    }
}
```

### Rules

- Custom exceptions extend `AppException`
- `@RestControllerAdvice` xử lý TẤT CẢ exceptions — controller KHÔNG try/catch
- Validation errors trả field → message map
- Unexpected errors: log full stack trace, trả generic message cho client
- **KHÔNG** expose stack traces, SQL errors, internal details cho client

---

## 10. Repository Layer

```java
public interface DocumentRepository extends JpaRepository<Document, Long> {
    Optional<Document> findBySlug(String slug);
    boolean existsByDocumentCode(String documentCode);

    @Query("SELECT d FROM Document d WHERE d.status = :status AND d.deletedAt IS NULL")
    List<Document> findActiveByStatus(@Param("status") DocumentStatus status);
}
```

### Rules

- Dùng Spring Data derived query methods khi có thể
- `@Query` với JPQL cho query phức tạp — native query khi cần PostgreSQL FTS features
- Return `Optional<T>` cho single results — **KHÔNG** return null
- **KHÔNG** có business logic trong repository
- Repository **KHÔNG inject** Repository khác
- Repository **KHÔNG gọi** Service

---

## 11. JWT với oauth2-resource-server

### Approach
Spring Security oauth2-resource-server xử lý JWT validation tự động.
Không cần custom `OncePerRequestFilter`. Cung cấp `JwtEncoder` (sign/create tokens)
và `JwtDecoder` (verify tokens) như Spring beans. Algorithm: **HS256** (symmetric secret key).

### Maven Dependencies
```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-oauth2-resource-server</artifactId>
</dependency>
<!-- spring-security-oauth2-jose is included transitively (Nimbus JOSE JWT) -->
```

### application.yml
```yaml
app:
  jwt:
    secret: ${JWT_SECRET}                        # Min 32 chars cho HS256 — load từ env variable
    access-expiration: ${JWT_ACCESS_EXPIRATION:900000}     # 15 phút (milliseconds)
    refresh-expiration: ${JWT_REFRESH_EXPIRATION:604800000} # 7 ngày (milliseconds)
```

### SecurityConfig.java
```java
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    private final CustomUserDetailsService customUserDetailsService;

    @Value("${app.jwt.secret}")
    private String jwtSecret;

    public SecurityConfig(CustomUserDetailsService customUserDetailsService) {
        this.customUserDetailsService = customUserDetailsService;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration authConfig) throws Exception {
        return authConfig.getAuthenticationManager();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public JwtDecoder jwtDecoder() {
        SecretKeySpec secretKey = new SecretKeySpec(jwtSecret.getBytes(), "HMACSHA256");
        return NimbusJwtDecoder.withSecretKey(secretKey)
                .macAlgorithm(MacAlgorithm.HS256)
                .build();
    }

    @Bean
    public JwtEncoder jwtEncoder() {
        return new NimbusJwtEncoder(new ImmutableSecret<>(jwtSecret.getBytes()));
    }

    @Bean
    public JwtAuthenticationConverter jwtAuthenticationConverter() {
        JwtGrantedAuthoritiesConverter grantedAuthoritiesConverter = new JwtGrantedAuthoritiesConverter();
        grantedAuthoritiesConverter.setAuthorityPrefix("ROLE_");
        grantedAuthoritiesConverter.setAuthoritiesClaimName("role");

        JwtAuthenticationConverter jwtAuthenticationConverter = new JwtAuthenticationConverter();
        jwtAuthenticationConverter.setJwtGrantedAuthoritiesConverter(grantedAuthoritiesConverter);
        return jwtAuthenticationConverter;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .cors(cors -> cors.configure(http))
                .csrf(csrf -> csrf.disable())                    // Stateless JWT — không cần CSRF
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(authorize -> authorize
                        .requestMatchers("/actuator/**").permitAll()
                        .requestMatchers("/auth/login", "/auth/refresh").permitAll()
                        .requestMatchers("/swagger-ui/**", "/v3/api-docs/**").permitAll()
                        .anyRequest().authenticated())
                .oauth2ResourceServer(oauth2 -> oauth2.jwt(Customizer.withDefaults()));

        return http.build();
    }
}
```

### JwtTokenProvider.java (tạo Access Token)
```java
@Component
public class JwtTokenProvider {

    private final JwtEncoder jwtEncoder;

    @Value("${app.jwt.access-expiration}")
    private long jwtAccessExpiration;

    public JwtTokenProvider(JwtEncoder jwtEncoder) {
        this.jwtEncoder = jwtEncoder;
    }

    public String generateAccessToken(Authentication authentication) {
        Instant now = Instant.now();
        Instant expiryDate = now.plus(jwtAccessExpiration, ChronoUnit.MILLIS);

        String role = authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .findFirst()
                .orElse("USER");

        if (role.startsWith("ROLE_")) {
            role = role.substring(5);
        }

        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer("dms")
                .issuedAt(now)
                .expiresAt(expiryDate)
                .subject(authentication.getName())     // email
                .claim("role", role)                   // ADMIN / USER
                .build();

        JwsHeader jwsHeader = JwsHeader.with(MacAlgorithm.HS256).build();
        return this.jwtEncoder.encode(JwtEncoderParameters.from(jwsHeader, claims)).getTokenValue();
    }
}
```

### CustomUserDetailsService.java
```java
@Service
public class CustomUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;

    public CustomUserDetailsService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        return userRepository.findByEmail(username)
                .orElseThrow(() -> new UsernameNotFoundException("User not found with email: " + username));
    }
}
```

### Getting Current User in Controller/Service
```java
// Option 1: Từ @AuthenticationPrincipal trong Controller
@GetMapping("/me")
public ResponseEntity<ApiResponse<UserResponse>> getCurrentUser(
        @AuthenticationPrincipal Jwt jwt) {
    String email = jwt.getSubject();
    String role = jwt.getClaim("role");
    // ...
}

// Option 2: SecurityContextHolder helper trong Service
public UserDTO getCurrentUser() {
    Authentication auth = SecurityContextHolder.getContext().getAuthentication();
    if (auth != null && auth.getPrincipal() instanceof Jwt jwt) {
        String email = jwt.getSubject();
        return userRepository.findByEmail(email).map(this::mapToUserDTO).orElse(null);
    }
    return null;
}
```

### JWT Claims Convention

| Claim | Mô tả |
|-------|--------|
| `sub` | User email (dùng làm subject) |
| `role` | `ADMIN` / `USER` (không có prefix `ROLE_`) |
| `iss` | `dms` |
| `iat` | Issued at |
| `exp` | Expiration |

### Refresh Token

- Refresh Token là **UUID random** lưu trong bảng `refresh_tokens` (PostgreSQL), KHÔNG phải JWT
- Refresh Token gửi cho browser bằng **HttpOnly Cookie** (`Path=/api/v1/auth`), JavaScript không đọc trực tiếp
- Frontend lưu Access Token trong memory, KHÔNG lưu LocalStorage/SessionStorage
- Khi refresh: tạo access token mới + refresh token mới, revoke refresh token cũ
- Logout: revoke refresh token + clear SecurityContext + xóa cookie refresh token với cùng Path/SameSite/Secure
- Refresh token hết hạn hoặc đã revoke → yêu cầu đăng nhập lại

### JWT Security Rules
- Access token: **15 phút** (900000ms) — short-lived để giảm rủi ro leak
- Refresh token: **7 ngày** (604800000ms) — lưu DB, gửi qua HttpOnly Cookie, có thể revoke
- CSRF có thể disable cho API dùng Bearer Access Token stateless; riêng `/auth/refresh` và `/auth/logout` phải có CSRF protection nếu refresh cookie được gửi cross-site
- Spring oauth2ResourceServer xử lý validation tự động — không cần custom filter, không dùng jjwt/custom `OncePerRequestFilter`
- `JwtAuthenticationConverter` map claim `role` → authority `ROLE_ADMIN` / `ROLE_USER`
- User bị deactivate (`INACTIVE`/`BANNED`) không được cấp token mới; API phải check trạng thái user
- `JWT_SECRET` phải đủ mạnh cho HMAC 256-bit; không dùng placeholder ở production

---

## 12. Mapper (MapStruct)

```java
@Mapper(componentModel = "spring")
public interface UserMapper {
    UserResponse toResponse(User user);
    User toEntity(CreateUserRequest request);
}
```

### Rules

- Dùng **MapStruct** cho TẤT CẢ mapping Entity ↔ DTO
- **KHÔNG** gọi `new Response(...)` rải rác trong Service/Controller
- Mỗi module có mapper riêng trong `mapper/` sub-package
- `componentModel = "spring"` để inject mapper như Spring bean
- Lombok + MapStruct: cần `lombok-mapstruct-binding` trong `annotationProcessorPaths`

---

## 13. Validation Pipeline

```
HTTP Request
  ↓
DTO Validation (@Valid — file type, size, metadata format)
  ↓
Business Validation (trùng lặp? quyền? category tồn tại?)
  ↓
Authorization (JWT — Admin upload/xóa, User chỉ đọc/tải)
  ↓
Persistence
  ↓
Response
```

- **Syntax Validation (Controller)**: Jakarta Bean Validation (`@NotNull`, `@NotBlank`, `@Email`, `@Size`)
- **Business Validation (Service)**: Quy tắc nghiệp vụ (email trùng, category tồn tại, quyền truy cập...)

---

## 14. Document Access Control

| Access Level | Ai có quyền |
|-------------|------------|
| `PUBLIC` | Tất cả user đã đăng nhập |
| `DEPARTMENT` | User thuộc phòng ban được gán + Admin |
| `RESTRICTED` | Owner, Admin, hoặc user được chia sẻ trực tiếp |

### Rules

- Search, preview, download phải dùng **cùng một logic** ACL trong `DocumentAccessPolicyService`
- PostgreSQL FTS query **PHẢI** filter quyền trước khi trả kết quả — KHÔNG filter ở frontend
- User không có quyền **KHÔNG** nhìn thấy title, snippet, metadata, download URL
- Tài liệu `DELETED` không xuất hiện trong search/preview/download
- Admin mặc định không thấy `DELETED` trừ khi filter rõ `status = DELETED`

### ACL Query Pattern (cho cả search lẫn document detail)

```sql
d.status = 'INDEXED'
AND (
  d.access_level = 'PUBLIC'
  OR d.owner_id = :currentUserId
  OR EXISTS (SELECT 1 FROM document_department_accesses dda WHERE dda.document_id = d.id AND dda.department_id = :userDepartmentId)
  OR EXISTS (SELECT 1 FROM document_user_accesses dua WHERE dua.document_id = d.id AND dua.user_id = :currentUserId)
  OR :isAdmin = true
)
```

---

## 15. Document Lifecycle

```
AWAITING_UPLOAD → PROCESSING → INDEXED
                             → EXTRACTION_FAILED → PROCESSING (retry)
INDEXED → ARCHIVED → INDEXED (restore)
INDEXED / ARCHIVED / EXTRACTION_FAILED → DELETED
DELETED → INDEXED / ARCHIVED (restore nếu còn retention window)
```

| Status | Hiển thị User | Mô tả |
|--------|:---:|--------|
| `AWAITING_UPLOAD` | Không | Đang chờ client PUT file qua presigned URL |
| `PROCESSING` | Không | Worker đang extract text / refresh search vector |
| `INDEXED` | Có (nếu có quyền) | Sẵn sàng search/preview/download |
| `EXTRACTION_FAILED` | Không | Lỗi extraction, Admin có thể retry |
| `ARCHIVED` | Không mặc định | Ngưng sử dụng, có thể restore |
| `DELETED` | Không | Thùng rác, auto purge sau 30 ngày |

### Version Current Switch Rules

- Upload version mới tạo `document_versions` mới nhưng chưa thay `current_version` ngay.
- Version mới chỉ trở thành current sau khi extraction, preview artifact cần thiết và refresh `document_search_index` thành công.
- Nếu version mới lỗi, version cũ tiếp tục phục vụ search/preview/download cho User; version lỗi chuyển `EXTRACTION_FAILED` và Admin có thể retry.
- Restore version cũ cũng phải refresh search vector trước khi User thấy nội dung mới.

---

## 16. Upload Flow (Presigned URL)

```
1. Admin → POST /documents/upload-init (metadata + file info)
2. Backend: validate metadata, tạo row AWAITING_UPLOAD, sinh presigned PUT URL
3. Client → PUT file trực tiếp lên MinIO/R2 qua presigned URL
4. Client → POST /documents/{id}/upload-complete
5. Backend: HEAD object, Tika validate MIME thực tế, chuyển PROCESSING
6. Backend: commit transaction → publish RabbitMQ message → worker extract + index
```

### Upload Rules

- File size tối đa: **50 MB** cho từng file
- Validate **cả** extension và MIME thực tế bằng Apache Tika
- Chặn extensions nguy hiểm: `.exe`, `.sh`, `.bat`, `.cmd`, `.js`, `.html`
- `storage_path` dùng UUID — **KHÔNG** dùng filename gốc
- `document_code` do backend tự sinh format `DMS-{yyyyMM}-{sequence6}`
- Request DTO tạo/cập nhật tài liệu **KHÔNG nhận** `documentCode`; nếu tài liệu khác còn mô tả input này thì xem là stale và phải sửa docs trước khi implement
- Batch upload cũng dùng presigned URL theo từng file/item; **KHÔNG dùng multipart upload qua Spring**
- Spring `multipart.max-file-size` set nhỏ (1MB) vì file upload qua presigned URL, không qua Spring

---

## 17. Worker & RabbitMQ Processing

### Queues

| Queue | Task | Trigger |
|-------|------|---------|
| `dms.extract` | Extract text (PDFBox/POI) | upload-complete, retry |
| `dms.ocr` | OCR scanned PDF/image (Tesseract) | Extract phát hiện scan |
| `dms.preview` | Generate preview PDF/HTML (LibreOffice) | File Office sau upload |
| `dms.index` | Refresh `document_search_index` | Extract thành công, metadata đổi |

### Rules

- Worker chạy `profile=worker`, tách biệt với API server
- Manual acknowledgement, message persistent, queue durable
- Retry: `maxAttempts = 3`, delay `30s → 5m → 30m`, vượt retry → `dms.dlq`
- Mỗi task idempotent: đọc lại PostgreSQL state trước khi xử lý
- After-commit event: API server publish message **SAU KHI** transaction commit thành công

---

## 18. Search Engine (PostgreSQL FTS)

### Rules

- **KHÔNG dùng Elasticsearch/OpenSearch** — PostgreSQL là search engine duy nhất
- Denormalized search table: `document_search_index` (1 row per document)
- Weighted `tsvector`: document code/title > tags > description > extracted content
- Query: `websearch_to_tsquery('simple', unaccent(:keyword))`
- Ranking: `ts_rank_cd` với weighted vector
- Highlight: `ts_headline` — backend sanitize HTML trước khi trả frontend
- Fuzzy/typeahead: `pg_trgm` (`similarity`, trigram GIN index)
- Facets: category, department, file type, tags bằng SQL `GROUP BY`
- Permission filter: JOIN ACL ngay trong SQL (xem Section 14)
- Suggestions: autocomplete cho title, document_code, tags — có thể cache Redis

---

## 19. Caching Strategy (Redis)

| Cache Key | TTL | Mô tả |
|----------|-----|-------|
| `categories:tree` | 1 giờ | Cây danh mục |
| `departments:all` | 1 giờ | Danh sách phòng ban |
| `tags:popular` | 30 phút | Tags phổ biến |
| `document:meta:{id}` | 15 phút | Metadata tài liệu |
| `search:suggest:{prefix}` | 10 phút | Autocomplete suggestions |

- Write operations → `@CacheEvict`
- Redis chỉ dùng cho cache/suggestions, **KHÔNG** dùng cho session

---

## 20. Testing

```java
// Unit test — Service layer
@ExtendWith(MockitoExtension.class)
class CategoryServiceTest {
    @Mock private CategoryRepository categoryRepository;
    @Mock private CategoryMapper categoryMapper;
    @InjectMocks private CategoryService categoryService;

    @Test
    @DisplayName("Should throw ResourceNotFoundException when category not found")
    void getCategoryById_notFound_throwsException() { ... }
}

// Integration test — Testcontainers PostgreSQL
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class DocumentSearchIntegrationTest {
    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("pgvector/pgvector:pg17");
    // ...
}
```

### Rules

- Test naming: `[method]_[scenario]_[expected]`
- `@DisplayName` trên mọi test — mô tả behavior
- Unit tests: `@ExtendWith(MockitoExtension.class)`, mock dependencies
- Integration tests: `@SpringBootTest` + `@Testcontainers`
- **Ưu tiên Testcontainers PostgreSQL** cho test FTS query, ACL, facet, cache
- H2 chỉ dùng cho test JPA đơn giản — FTS/pg_trgm/extension không chạy trên H2
- Always test: happy path + validation error + not found + unauthorized + access denied
- Biến môi trường test phải set trước khi chạy

### Spring Boot 4 Breaking Changes

| What | Spring Boot 3 | Spring Boot 4 |
|------|--------------|--------------|
| `ObjectMapper` import | `com.fasterxml.jackson.databind` | `tools.jackson.databind` |
| `@AutoConfigureMockMvc` import | `...boot.test.autoconfigure.web.servlet` | `...boot.webmvc.test.autoconfigure` |

---

## 21. Logging

```java
@Service
public class DocumentService {

    private static final Logger log = LoggerFactory.getLogger(DocumentService.class);

    @Transactional
    public DocumentResponse uploadComplete(Long documentId) {
        log.info("Upload complete for document: {}", documentId);
        // ...
        log.error("Upload validation failed for document: {}", documentId, exception);
    }
}
```

### Rules

- Logger: `private static final Logger log = LoggerFactory.getLogger(ClassName.class)`
- Import: `org.slf4j.Logger`, `org.slf4j.LoggerFactory`
- **KHÔNG** log: passwords, tokens, PII
- Log levels: ERROR (cần xử lý), WARN (đáng chú ý), INFO (business events), DEBUG (dev only)
- Dùng `{}` parameterized — **KHÔNG** dùng string concatenation
- Controller: KHÔNG log business — chỉ log nếu cần auditing/tracing
- Service: log important business events
- Với presigned URL, `PREVIEW`/`DOWNLOAD` access log và `view_count`/`download_count` được ghi tại thời điểm backend cấp URL, không phải lúc object storage truyền byte hoàn tất

---

## 22. Code Size Limits

| Metric | Limit | Action |
|---|---|---|
| File | ~ 300 lines | Xem xét refactor hoặc split |
| Method | ~ 50 lines | Extract methods |
| Method parameters | < 5 | Group vào record |
| Constructor parameters | < 7 | Split responsibilities |
| Nested blocks (if/for) | < 3 levels | Early return hoặc extract |

---

## 23. Database & Schema Migration

### Rules

- **Flyway** quản lý toàn bộ schema migration
- File naming: `V{version}__{description}.sql` — VD: `V1__init.sql`, `V2__add_document_tags.sql`
- **KHÔNG** xóa hoặc sửa Flyway migration scripts đã chạy
- `ddl-auto: validate` — Hibernate chỉ validate, KHÔNG tạo/sửa schema
- PostgreSQL extensions (`unaccent`, `pg_trgm`) tạo bằng Flyway migration
- Soft delete dùng `deleted_at` (TIMESTAMP) cho User, Document, Category, Department, Tag
- Tất cả entity chính có: `id` (BIGINT AI), `created_at`, `updated_at`

### Source of Truth

- **PostgreSQL** là source of truth cho metadata, ACL, lifecycle, extracted text, search vector
- **Object storage** (MinIO/R2) chỉ lưu binary/artifact theo UUID object key
- `document_search_index` là derived table — có thể rebuild từ PostgreSQL + extracted content

---

## 24. API Design

### Base URL

```
Development: http://localhost:8080/api/v1
Production:  https://api.dms.example.com/api/v1
```

Context path `/api/v1` được set trong `application.yml` → Controller chỉ cần `@RequestMapping("/resources")`.

### Resource Naming

- Dùng **plural** resource names: `/categories`, `/departments`, `/tags`, `/documents`, `/users`
- Admin-only: `/admin/dashboard/**`, `/admin/audit-logs`
- KHÔNG dùng grouping prefix (VD: `/attributes/*`) trừ khi được phê duyệt

### HTTP Status Convention

| Code | Meaning | Usage |
|------|---------|-------|
| `200` | OK | GET, PUT thành công |
| `201` | Created | POST tạo resource thành công |
| `204` | No Content | DELETE thành công |
| `400` | Bad Request | Validation errors |
| `401` | Unauthorized | Missing/invalid JWT |
| `403` | Forbidden | JWT valid nhưng không đủ quyền |
| `404` | Not Found | Resource không tồn tại |
| `409` | Conflict | Duplicate data |
| `413` | Payload Too Large | File > 50MB |

---

## 25. Background Jobs

| Job | Tần suất | Mô tả |
|-----|---------|-------|
| Search refresh batch | Hàng đêm (2:00 AM) | Rebuild `document_search_index` self-heal |
| Extraction retry | Mỗi 30 phút | Retry `EXTRACTION_FAILED` do lỗi tạm |
| Trash purge | Hàng ngày | Purge `DELETED` documents quá `purge_after` |
| Analytics aggregation | Hàng ngày | Tổng hợp metrics cho dashboard |
| Storage cleanup | Hàng tuần | Xóa orphan objects không còn DB reference |

- Dùng `@Scheduled` + **ShedLock** — đảm bảo chỉ 1 instance chạy khi multi-node
- Job chỉ publish message vào RabbitMQ queue — xử lý nặng do worker thực hiện

---

## 26. Documentation Requirements

| When | Action |
|------|--------|
| Schema changes | Update `docs/DATABASE.md` + tạo Flyway migration |
| New API endpoints | Update `docs/API_SPEC.md` |
| Architecture decision | Tạo file mới trong `docs/decision/` |
| End of coding session | Update `docs/PROJECT_PROGRESS.md` |
| Feature non-obvious logic | Ghi chú trong code hoặc docs phù hợp |

### Documentation First Rule

Nếu `DATABASE.md` hoặc `API_SPEC.md` không nhất quán với code → **DỪNG implementation** và yêu cầu update documentation trước. **KHÔNG** tự infer hoặc extend thiết kế.

---

## 27. Commit Checklist

- [ ] KHÔNG có `@Autowired` field injection — constructor injection only
- [ ] KHÔNG có Entity trả ra từ controller — dùng DTO records
- [ ] `@Valid` trên mọi `@RequestBody`
- [ ] Custom exceptions — KHÔNG throw raw `RuntimeException`
- [ ] KHÔNG hardcode config — dùng `application.yml` + env variables
- [ ] KHÔNG có sensitive data trong JWT claims hoặc logs
- [ ] Responses bọc trong `ApiResponse<T>`
- [ ] Mapping dùng MapStruct — KHÔNG dùng manual mapping
- [ ] Flyway migration cho mọi schema change
- [ ] Tuân thủ Single Responsibility, refactor nếu vượt code size limits
- [ ] `PROJECT_PROGRESS.md` updated

---

## 28. Quy tắc cho AI Assistant

### BẮT BUỘC

- ✅ Đọc file `PROJECT-RULES.md` này đầu tiên mỗi cuộc hội thoại
- ✅ Tuân thủ cấu trúc 6 phân hệ + common (Section 2)
- ✅ Dùng đúng tech stack đã định nghĩa (Section 1)
- ✅ Mapping bằng MapStruct, KHÔNG manual mapping
- ✅ Kiểm tra file hiện có trước khi tạo mới
- ✅ Giữ nguyên comments/docstrings không liên quan khi sửa code
- ✅ Trả lời tiếng Việt khi user dùng tiếng Việt
- ✅ Tham khảo `docs/spec/`, `docs/sa/`, `docs/design.md` khi cần thông tin chi tiết
- ✅ Check `docs/DATABASE.md` và `docs/API_SPEC.md` trước khi implement feature mới

### KHÔNG ĐƯỢC

- ❌ Tạo module/package ngoài 6 phân hệ + common
- ❌ Dùng Elasticsearch/OpenSearch — PostgreSQL FTS only
- ❌ Dùng `@Data` trên Entity (gây lỗi JPA)
- ❌ Dùng `@Autowired` field injection
- ❌ Xóa hoặc sửa Flyway migration scripts đã chạy
- ❌ Expose Entity trực tiếp qua API
- ❌ Manual mapping (new Response(...)) khi đã dùng MapStruct
- ❌ Hardcode credentials hoặc config values
- ❌ Tự infer/extend thiết kế khi docs không nhất quán

---

## 29. Lệnh thường dùng

```bash
# Khởi động infrastructure
docker-compose up -d

# Chạy Backend API
cd backend && ./mvnw spring-boot:run

# Chạy Backend Worker (chưa implement)
cd backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=worker,dev

# Build (skip tests)
cd backend && ./mvnw clean package -DskipTests

# Swagger UI
# http://localhost:8080/api/v1/swagger-ui/index.html
```

---

## 30. Tài liệu liên quan

| Tài liệu | Đường dẫn |
|-----------|-----------|
| Đặc tả yêu cầu (SRS) | [specs.md](./spec/specs.md) |
| Luồng nghiệp vụ chính | [buss_mainflow.md](./spec/buss_mainflow.md) |
| Phân rã phân hệ | [phan_ra_phan_he_he_thong.md](./spec/phan_ra_phan_he_he_thong.md) |
| Phân rã tính năng | [phan_ra_tinh_nang.md](./spec/phan_ra_tinh_nang.md) |
| Phân rã màn hình | [phan_ra_man_hinh.md](./spec/phan_ra_man_hinh.md) |
| Thiết kế chi tiết | [design.md](./design.md) |
| System Architecture | [sa/sa.md](./sa/sa.md) |
| Tech Stack | [sa/techstack.md](./sa/techstack.md) |
| Server & Deployment | [sa/server.md](./sa/server.md) |
| Database Schema | [DATABASE.md](./DATABASE.md) |
| API Specification | [API_SPEC.md](./API_SPEC.md) |
| Project Progress | [PROJECT_PROGRESS.md](./PROJECT_PROGRESS.md) |

---

> 📌 **Cập nhật file này** mỗi khi có thay đổi lớn về kiến trúc, convention, hoặc tech stack.