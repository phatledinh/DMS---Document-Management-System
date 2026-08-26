package com.dms.dashboard.repository;

import com.dms.dashboard.dto.MyDocumentVersionResponse;
import com.dms.dashboard.dto.UserActivityResponse;
import com.dms.dashboard.dto.UserDashboardMetricResponse;
import com.dms.dashboard.dto.UserPermissionGroupResponse;
import com.dms.dashboard.dto.UserRecentDocumentResponse;
import com.dms.document.dto.PageResponse;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.sql.Types;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Arrays;
import java.util.List;

@Repository
public class UserDashboardQueryRepository {
    private final NamedParameterJdbcTemplate jdbcTemplate;

    public UserDashboardQueryRepository(NamedParameterJdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<UserDashboardMetricResponse> metrics(Long userId, OffsetDateTime dateFrom, OffsetDateTime dateTo) {
        MapSqlParameterSource parameters = params(userId)
                .addValue("dateFrom", dateFrom, Types.TIMESTAMP_WITH_TIMEZONE)
                .addValue("dateTo", dateTo, Types.TIMESTAMP_WITH_TIMEZONE);
        long uploaded = longValue("""
                SELECT count(*)
                FROM documents
                WHERE uploaded_by = :currentUserId AND permanently_deleted_at IS NULL
                """, parameters);
        long uploadedInRange = longValue("""
                SELECT count(*)
                FROM documents
                WHERE uploaded_by = :currentUserId
                  AND permanently_deleted_at IS NULL
                  AND created_at >= :dateFrom
                  AND created_at <= :dateTo
                """, parameters);
        long previews = accessCount(parameters, "PREVIEW", true);
        long downloads = accessCount(parameters, "DOWNLOAD", true) + accessCount(parameters, "VERSION_DOWNLOAD", true);
        long denied = longValue("""
                SELECT count(*)
                FROM access_logs
                WHERE user_id = :currentUserId
                  AND access_granted = false
                  AND created_at >= :dateFrom
                  AND created_at <= :dateTo
                """, parameters);
        return List.of(
                new UserDashboardMetricResponse("uploads", "Tài liệu đã upload", uploaded, "+" + uploadedInRange + " trong 30 ngày"),
                new UserDashboardMetricResponse("previews", "Lượt xem gần đây", previews, "30 ngày qua"),
                new UserDashboardMetricResponse("downloads", "Lượt tải", downloads, "30 ngày qua"),
                new UserDashboardMetricResponse("denied", "Thao tác bị từ chối", denied, "Thiếu quyền")
        );
    }

    public List<UserRecentDocumentResponse> recentDocuments(Long userId, int limit) {
        return jdbcTemplate.query("""
                SELECT d.id, d.slug, d.title, d.document_code, c.name AS category_name, d.status
                FROM documents d
                JOIN categories c ON c.id = d.category_id
                WHERE d.status = 'INDEXED'
                  AND d.permanently_deleted_at IS NULL
                  AND EXISTS (
                      SELECT 1
                      FROM category_department_permissions cdp
                      WHERE cdp.category_id = d.category_id
                        AND cdp.permission = 'VIEW'
                        AND cdp.department_id IN (
                            SELECT department_id FROM user_departments WHERE user_id = :currentUserId
                            UNION
                            SELECT department_id FROM users WHERE id = :currentUserId AND department_id IS NOT NULL
                        )
                  )
                ORDER BY coalesce(d.updated_at, d.created_at) DESC
                LIMIT :limit
                """, params(userId).addValue("limit", limit), (rs, rowNum) -> new UserRecentDocumentResponse(
                rs.getLong("id"),
                rs.getString("slug"),
                rs.getString("title"),
                rs.getString("document_code"),
                rs.getString("category_name"),
                rs.getString("status")
        ));
    }

    public List<UserPermissionGroupResponse> permissionGroups(Long userId) {
        return jdbcTemplate.query("""
                WITH user_dept_ids AS (
                    SELECT department_id FROM user_departments WHERE user_id = :currentUserId
                    UNION
                    SELECT department_id FROM users WHERE id = :currentUserId AND department_id IS NOT NULL
                )
                SELECT c.id AS category_id, c.name AS category_name, string_agg(DISTINCT cdp.permission, ',' ORDER BY cdp.permission) AS permissions
                FROM user_dept_ids ud
                JOIN category_department_permissions cdp ON cdp.department_id = ud.department_id
                JOIN categories c ON c.id = cdp.category_id
                WHERE c.deleted_at IS NULL
                GROUP BY c.id, c.name
                ORDER BY c.name
                """, params(userId), (rs, rowNum) -> new UserPermissionGroupResponse(
                rs.getLong("category_id"),
                rs.getString("category_name"),
                splitPermissions(rs.getString("permissions"))
        ));
    }

    public List<UserActivityResponse> recentActivities(Long userId, int limit) {
        return jdbcTemplate.query(activityBaseSql() + """
                SELECT * FROM filtered_activity
                ORDER BY created_at DESC, id DESC
                LIMIT :limit
                """, params(userId)
                .addValue("dateFrom", null, Types.TIMESTAMP_WITH_TIMEZONE)
                .addValue("dateTo", null, Types.TIMESTAMP_WITH_TIMEZONE)
                .addValue("action", null, Types.VARCHAR)
                .addValue("category", null, Types.VARCHAR)
                .addValue("permission", null, Types.VARCHAR)
                .addValue("result", null, Types.VARCHAR)
                .addValue("limit", limit), (rs, rowNum) -> mapActivity(rs));
    }

    public PageResponse<UserActivityResponse> activityHistory(Long userId, String action, String category, String permission, String result, OffsetDateTime dateFrom, OffsetDateTime dateTo, int page, int size) {
        MapSqlParameterSource parameters = params(userId)
                .addValue("action", blankToNull(action), Types.VARCHAR)
                .addValue("category", blankToNull(category), Types.VARCHAR)
                .addValue("permission", blankToNull(permission), Types.VARCHAR)
                .addValue("result", blankToNull(result), Types.VARCHAR)
                .addValue("dateFrom", dateFrom, Types.TIMESTAMP_WITH_TIMEZONE)
                .addValue("dateTo", dateTo, Types.TIMESTAMP_WITH_TIMEZONE)
                .addValue("limit", size)
                .addValue("offset", page * size);
        String baseSql = activityBaseSql();
        List<UserActivityResponse> content = jdbcTemplate.query(baseSql + """
                SELECT * FROM filtered_activity
                ORDER BY created_at DESC, id DESC
                LIMIT :limit OFFSET :offset
                """, parameters, (rs, rowNum) -> mapActivity(rs));
        Long total = jdbcTemplate.queryForObject(baseSql + "SELECT count(*) FROM filtered_activity", parameters, Long.class);
        long totalElements = total == null ? 0 : total;
        return new PageResponse<>(content, page, size, totalElements, totalPages(totalElements, size));
    }

    public PageResponse<MyDocumentVersionResponse> myDocumentVersions(Long userId, String keyword, String category, String status, OffsetDateTime dateFrom, OffsetDateTime dateTo, int page, int size) {
        MapSqlParameterSource parameters = params(userId)
                .addValue("keyword", blankToNull(keyword), Types.VARCHAR)
                .addValue("category", blankToNull(category), Types.VARCHAR)
                .addValue("status", blankToNull(status), Types.VARCHAR)
                .addValue("dateFrom", dateFrom, Types.TIMESTAMP_WITH_TIMEZONE)
                .addValue("dateTo", dateTo, Types.TIMESTAMP_WITH_TIMEZONE)
                .addValue("limit", size)
                .addValue("offset", page * size);
        String baseSql = """
                WITH my_versions AS (
                    SELECT d.id AS document_id, d.title AS document_title, d.document_code,
                           dv.id AS version_id, dv.version_number, dv.changelog, dv.file_size,
                           dv.created_at AS uploaded_at, c.name AS category_name, dv.status,
                           (dv.id = d.current_version_id) AS current_version
                    FROM document_versions dv
                    JOIN documents d ON d.id = dv.document_id
                    JOIN categories c ON c.id = d.category_id
                    WHERE dv.uploaded_by = :currentUserId
                      AND d.permanently_deleted_at IS NULL
                      AND (:keyword IS NULL OR lower(d.title) LIKE concat('%', lower(:keyword), '%') OR lower(d.document_code) LIKE concat('%', lower(:keyword), '%'))
                      AND (:category IS NULL OR c.name = :category OR c.id::text = :category)
                      AND (:status IS NULL OR dv.status = :status OR d.status = :status)
                      AND (CAST(:dateFrom AS timestamptz) IS NULL OR dv.created_at >= :dateFrom)
                      AND (CAST(:dateTo AS timestamptz) IS NULL OR dv.created_at <= :dateTo)
                )
                """;
        List<MyDocumentVersionResponse> content = jdbcTemplate.query(baseSql + """
                SELECT * FROM my_versions
                ORDER BY uploaded_at DESC, version_id DESC
                LIMIT :limit OFFSET :offset
                """, parameters, (rs, rowNum) -> new MyDocumentVersionResponse(
                rs.getLong("document_id"),
                rs.getString("document_title"),
                rs.getString("document_code"),
                rs.getLong("version_id"),
                rs.getString("version_number"),
                rs.getBoolean("current_version"),
                rs.getString("changelog"),
                rs.getLong("file_size"),
                offsetDateTime(rs, "uploaded_at"),
                rs.getString("category_name"),
                rs.getString("status")
        ));
        Long total = jdbcTemplate.queryForObject(baseSql + "SELECT count(*) FROM my_versions", parameters, Long.class);
        long totalElements = total == null ? 0 : total;
        return new PageResponse<>(content, page, size, totalElements, totalPages(totalElements, size));
    }

    private long accessCount(MapSqlParameterSource parameters, String action, boolean granted) {
        return longValue("""
                SELECT count(*)
                FROM access_logs
                WHERE user_id = :currentUserId
                  AND action = :action
                  AND access_granted = :granted
                  AND created_at >= :dateFrom
                  AND created_at <= :dateTo
                """, parameters.addValue("action", action).addValue("granted", granted));
    }

    private String activityBaseSql() {
        return """
                WITH user_activity AS (
                    SELECT concat('ACCESS-', al.id) AS id,
                           al.action,
                           c.name AS category,
                           CASE WHEN al.action IN ('DOWNLOAD', 'VERSION_DOWNLOAD') THEN 'DOWNLOAD'
                                WHEN al.action IN ('VIEW', 'PREVIEW') THEN 'VIEW'
                                ELSE al.action END AS required_permission,
                           CASE WHEN al.access_granted THEN 'Được phép' ELSE coalesce(al.denial_reason, 'Bị từ chối') END AS result,
                           CASE WHEN al.access_granted THEN 'allowed' ELSE 'denied' END AS result_type,
                           d.title AS detail,
                           al.created_at
                    FROM access_logs al
                    JOIN documents d ON d.id = al.document_id
                    LEFT JOIN categories c ON c.id = d.category_id
                    WHERE al.user_id = :currentUserId
                      AND (CAST(:dateFrom AS timestamptz) IS NULL OR al.created_at >= :dateFrom)
                      AND (CAST(:dateTo AS timestamptz) IS NULL OR al.created_at <= :dateTo)
                    UNION ALL
                    SELECT concat('SEARCH-', sl.id),
                           'SEARCH',
                           NULL,
                           'SEARCH',
                           'Được phép',
                           'allowed',
                           concat('Từ khoá: "', coalesce(sl.keyword, ''), '"'),
                           sl.created_at
                    FROM search_logs sl
                    WHERE sl.user_id = :currentUserId
                      AND (CAST(:dateFrom AS timestamptz) IS NULL OR sl.created_at >= :dateFrom)
                      AND (CAST(:dateTo AS timestamptz) IS NULL OR sl.created_at <= :dateTo)
                    UNION ALL
                    SELECT concat('AUDIT-', audit.id),
                           audit.action,
                           NULL,
                           audit.action,
                           'Được phép',
                           'allowed',
                           concat(audit.target_type, coalesce(concat(' #', audit.target_id), '')),
                           audit.created_at
                    FROM audit_logs audit
                    WHERE audit.actor_id = :currentUserId
                      AND (CAST(:dateFrom AS timestamptz) IS NULL OR audit.created_at >= :dateFrom)
                      AND (CAST(:dateTo AS timestamptz) IS NULL OR audit.created_at <= :dateTo)
                ), filtered_activity AS (
                    SELECT * FROM user_activity
                    WHERE (:action IS NULL OR action = :action)
                      AND (:category IS NULL OR category = :category)
                      AND (:permission IS NULL OR required_permission = :permission)
                      AND (:result IS NULL OR result_type = :result)
                )
                """;
    }

    private UserActivityResponse mapActivity(ResultSet rs) throws SQLException {
        return new UserActivityResponse(
                rs.getString("id"),
                rs.getString("action"),
                rs.getString("category"),
                rs.getString("required_permission"),
                rs.getString("result"),
                rs.getString("result_type"),
                rs.getString("detail"),
                offsetDateTime(rs, "created_at")
        );
    }

    private long longValue(String sql, MapSqlParameterSource parameters) {
        Long value = jdbcTemplate.queryForObject(sql, parameters, Long.class);
        return value == null ? 0 : value;
    }

    private MapSqlParameterSource params(Long userId) {
        return new MapSqlParameterSource().addValue("currentUserId", userId);
    }

    private List<String> splitPermissions(String value) {
        if (value == null || value.isBlank()) {
            return List.of();
        }
        return Arrays.stream(value.split(",")).toList();
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() || "all".equalsIgnoreCase(value) ? null : value.trim();
    }

    private int totalPages(long total, int size) {
        return total == 0 ? 0 : (int) Math.ceil((double) total / size);
    }

    private OffsetDateTime offsetDateTime(ResultSet rs, String column) throws SQLException {
        Timestamp timestamp = rs.getTimestamp(column);
        return timestamp == null ? null : timestamp.toInstant().atOffset(ZoneOffset.UTC);
    }
}
