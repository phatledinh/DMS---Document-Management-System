package com.dms.dashboard.repository;

import com.dms.dashboard.dto.AccessTrendPointResponse;
import com.dms.dashboard.dto.ProcessingErrorResponse;
import com.dms.dashboard.dto.RecentUploadResponse;
import com.dms.dashboard.dto.TopDocumentResponse;
import com.dms.dashboard.dto.TopSearchKeywordResponse;
import com.dms.dashboard.dto.TopUserAccessResponse;
import com.dms.document.dto.PageResponse;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Repository
public class DashboardQueryRepository {
    private final NamedParameterJdbcTemplate jdbcTemplate;

    public DashboardQueryRepository(NamedParameterJdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public long countDocuments() {
        return longValue("SELECT count(*) FROM documents WHERE permanently_deleted_at IS NULL", params());
    }

    public long countUsers() {
        return longValue("SELECT count(*) FROM users WHERE status <> 'DELETED'", params());
    }

    public long countCategories() {
        return longValue("SELECT count(*) FROM categories WHERE deleted_at IS NULL", params());
    }

    public long countDepartments() {
        return longValue("SELECT count(*) FROM departments WHERE deleted_at IS NULL", params());
    }

    public Map<String, Long> countDocumentsByStatus() {
        return mapCounts("""
                SELECT status AS label, count(*) AS count
                FROM documents
                WHERE permanently_deleted_at IS NULL
                GROUP BY status
                ORDER BY status
                """, params());
    }

    public Map<String, Long> countDocumentsByFileType() {
        return mapCounts("""
                SELECT file_type AS label, count(*) AS count
                FROM documents
                WHERE permanently_deleted_at IS NULL
                GROUP BY file_type
                ORDER BY count DESC, file_type ASC
                """, params());
    }

    public long activeStorageBytes() {
        return longValue("""
                SELECT coalesce(sum(file_size), 0)
                FROM documents
                WHERE status <> 'DELETED' AND permanently_deleted_at IS NULL
                """, params());
    }

    public long trashStorageBytes() {
        return longValue("""
                SELECT coalesce(sum(file_size), 0)
                FROM documents
                WHERE status = 'DELETED' AND permanently_deleted_at IS NULL
                """, params());
    }

    public long versionStorageBytes() {
        return longValue("SELECT coalesce(sum(file_size), 0) FROM document_versions", params());
    }

    public long trashDocumentCount() {
        return longValue("""
                SELECT count(*)
                FROM documents
                WHERE status = 'DELETED' AND permanently_deleted_at IS NULL
                """, params());
    }

    public long accessCount(String action, OffsetDateTime dateFrom, OffsetDateTime dateTo) {
        MapSqlParameterSource parameters = dateParams(dateFrom, dateTo).addValue("action", action);
        return longValue("""
                SELECT count(*)
                FROM access_logs
                WHERE access_granted = true
                  AND action = :action
                  AND (CAST(:dateFrom AS timestamptz) IS NULL OR created_at >= :dateFrom)
                  AND (CAST(:dateTo AS timestamptz) IS NULL OR created_at <= :dateTo)
                """, parameters);
    }

    public long deniedAccessCount(OffsetDateTime dateFrom, OffsetDateTime dateTo) {
        return longValue("""
                SELECT count(*)
                FROM access_logs
                WHERE access_granted = false
                  AND (CAST(:dateFrom AS timestamptz) IS NULL OR created_at >= :dateFrom)
                  AND (CAST(:dateTo AS timestamptz) IS NULL OR created_at <= :dateTo)
                """, dateParams(dateFrom, dateTo));
    }

    public long searchCount(OffsetDateTime dateFrom, OffsetDateTime dateTo) {
        return longValue("""
                SELECT count(*)
                FROM search_logs
                WHERE (CAST(:dateFrom AS timestamptz) IS NULL OR created_at >= :dateFrom)
                  AND (CAST(:dateTo AS timestamptz) IS NULL OR created_at <= :dateTo)
                """, dateParams(dateFrom, dateTo));
    }

    public long loginCount(OffsetDateTime dateFrom, OffsetDateTime dateTo) {
        return longValue("""
                SELECT count(*)
                FROM audit_logs
                WHERE action = 'LOGIN'
                  AND (CAST(:dateFrom AS timestamptz) IS NULL OR created_at >= :dateFrom)
                  AND (CAST(:dateTo AS timestamptz) IS NULL OR created_at <= :dateTo)
                """, dateParams(dateFrom, dateTo));
    }

    public long activeUserCount(OffsetDateTime dateFrom, OffsetDateTime dateTo) {
        return longValue("""
                SELECT count(DISTINCT user_id) FROM (
                    SELECT actor_id AS user_id FROM audit_logs
                    WHERE actor_id IS NOT NULL AND (CAST(:dateFrom AS timestamptz) IS NULL OR created_at >= :dateFrom) AND (CAST(:dateTo AS timestamptz) IS NULL OR created_at <= :dateTo)
                    UNION
                    SELECT user_id FROM access_logs
                    WHERE (CAST(:dateFrom AS timestamptz) IS NULL OR created_at >= :dateFrom) AND (CAST(:dateTo AS timestamptz) IS NULL OR created_at <= :dateTo)
                    UNION
                    SELECT user_id FROM search_logs
                    WHERE (CAST(:dateFrom AS timestamptz) IS NULL OR created_at >= :dateFrom) AND (CAST(:dateTo AS timestamptz) IS NULL OR created_at <= :dateTo)
                ) active_users
                """, dateParams(dateFrom, dateTo));
    }

    public long processingErrorCount() {
        return longValue("""
                SELECT count(*)
                FROM documents d
                LEFT JOIN document_contents c ON c.document_id = d.id
                WHERE d.permanently_deleted_at IS NULL
                  AND (d.status = 'EXTRACTION_FAILED' OR c.extraction_status = 'FAILED')
                """, params());
    }

    public List<TopDocumentResponse> topDocuments(String metric, OffsetDateTime dateFrom, OffsetDateTime dateTo, int limit) {
        String orderMetric = "download".equalsIgnoreCase(metric) ? "download_count" : "view_count";
        MapSqlParameterSource parameters = dateParams(dateFrom, dateTo).addValue("limit", limit);
        return jdbcTemplate.query("""
                SELECT d.id, d.title, d.document_code,
                       count(*) FILTER (WHERE al.action IN ('VIEW', 'PREVIEW')) AS view_count,
                       count(*) FILTER (WHERE al.action IN ('DOWNLOAD', 'VERSION_DOWNLOAD')) AS download_count,
                       max(al.created_at) AS last_accessed_at
                FROM documents d
                LEFT JOIN access_logs al ON al.document_id = d.id
                    AND al.access_granted = true
                    AND (CAST(:dateFrom AS timestamptz) IS NULL OR al.created_at >= :dateFrom)
                    AND (CAST(:dateTo AS timestamptz) IS NULL OR al.created_at <= :dateTo)
                WHERE d.permanently_deleted_at IS NULL
                GROUP BY d.id, d.title, d.document_code, d.view_count, d.download_count
                ORDER BY %s DESC, max(al.created_at) DESC NULLS LAST, d.id DESC
                LIMIT :limit
                """.formatted(orderMetric), parameters, (rs, rowNum) -> new TopDocumentResponse(
                rs.getLong("id"),
                rs.getString("title"),
                rs.getString("document_code"),
                rs.getLong("view_count"),
                rs.getLong("download_count"),
                offsetDateTime(rs, "last_accessed_at")
        ));
    }

    public PageResponse<RecentUploadResponse> recentUploads(int page, int size) {
        MapSqlParameterSource parameters = params().addValue("limit", size).addValue("offset", page * size);
        List<RecentUploadResponse> content = jdbcTemplate.query("""
                SELECT d.id, d.title, d.document_code, d.file_type, d.file_size, d.status, d.uploaded_by,
                       u.name AS uploader_name, d.created_at
                FROM documents d
                LEFT JOIN users u ON u.id = d.uploaded_by
                WHERE d.permanently_deleted_at IS NULL
                ORDER BY d.created_at DESC
                LIMIT :limit OFFSET :offset
                """, parameters, (rs, rowNum) -> new RecentUploadResponse(
                rs.getLong("id"),
                rs.getString("title"),
                rs.getString("document_code"),
                rs.getString("file_type"),
                rs.getLong("file_size"),
                rs.getString("status"),
                rs.getLong("uploaded_by"),
                rs.getString("uploader_name"),
                offsetDateTime(rs, "created_at")
        ));
        long total = countDocuments();
        return new PageResponse<>(content, page, size, total, totalPages(total, size));
    }

    public List<TopSearchKeywordResponse> topSearchKeywords(OffsetDateTime dateFrom, OffsetDateTime dateTo, int limit) {
        MapSqlParameterSource parameters = dateParams(dateFrom, dateTo).addValue("limit", limit);
        return jdbcTemplate.query("""
                SELECT keyword, count(*) AS search_count,
                       coalesce(avg(result_count), 0) AS average_result_count,
                       coalesce(avg(latency_ms), 0) AS average_latency_ms
                FROM search_logs
                WHERE keyword IS NOT NULL AND keyword <> ''
                  AND (CAST(:dateFrom AS timestamptz) IS NULL OR created_at >= :dateFrom)
                  AND (CAST(:dateTo AS timestamptz) IS NULL OR created_at <= :dateTo)
                GROUP BY keyword
                ORDER BY search_count DESC, keyword ASC
                LIMIT :limit
                """, parameters, (rs, rowNum) -> new TopSearchKeywordResponse(
                rs.getString("keyword"),
                rs.getLong("search_count"),
                rs.getDouble("average_result_count"),
                rs.getDouble("average_latency_ms")
        ));
    }

    public List<AccessTrendPointResponse> accessTrend(OffsetDateTime dateFrom, OffsetDateTime dateTo, String granularity) {
        MapSqlParameterSource parameters = dateParams(dateFrom, dateTo).addValue("granularity", granularity);
        return jdbcTemplate.query("""
                WITH access_points AS (
                    SELECT date_trunc(:granularity, created_at) AS bucket,
                           count(*) FILTER (WHERE action = 'PREVIEW' AND access_granted = true) AS previews,
                           count(*) FILTER (WHERE action IN ('DOWNLOAD', 'VERSION_DOWNLOAD') AND access_granted = true) AS downloads,
                           count(*) FILTER (WHERE action = 'VIEW' AND access_granted = true) AS views,
                           0::bigint AS searches,
                           0::bigint AS logins,
                           count(DISTINCT user_id) AS unique_users
                    FROM access_logs
                    WHERE (CAST(:dateFrom AS timestamptz) IS NULL OR created_at >= :dateFrom)
                      AND (CAST(:dateTo AS timestamptz) IS NULL OR created_at <= :dateTo)
                    GROUP BY bucket
                    UNION ALL
                    SELECT date_trunc(:granularity, created_at) AS bucket,
                           0, 0, 0, count(*), 0, count(DISTINCT user_id)
                    FROM search_logs
                    WHERE (CAST(:dateFrom AS timestamptz) IS NULL OR created_at >= :dateFrom)
                      AND (CAST(:dateTo AS timestamptz) IS NULL OR created_at <= :dateTo)
                    GROUP BY bucket
                    UNION ALL
                    SELECT date_trunc(:granularity, created_at) AS bucket,
                           0, 0, 0, 0, count(*), count(DISTINCT actor_id)
                    FROM audit_logs
                    WHERE action = 'LOGIN'
                      AND (CAST(:dateFrom AS timestamptz) IS NULL OR created_at >= :dateFrom)
                      AND (CAST(:dateTo AS timestamptz) IS NULL OR created_at <= :dateTo)
                    GROUP BY bucket
                )
                SELECT bucket::date::text AS bucket_date,
                       sum(previews) AS previews,
                       sum(downloads) AS downloads,
                       sum(views) AS views,
                       sum(searches) AS searches,
                       sum(logins) AS logins,
                       sum(unique_users) AS unique_users
                FROM access_points
                GROUP BY bucket
                ORDER BY bucket
                """, parameters, (rs, rowNum) -> new AccessTrendPointResponse(
                rs.getString("bucket_date"),
                rs.getLong("previews"),
                rs.getLong("downloads"),
                rs.getLong("views"),
                rs.getLong("searches"),
                rs.getLong("logins"),
                rs.getLong("unique_users")
        ));
    }

    public Map<String, Long> accessByAction(OffsetDateTime dateFrom, OffsetDateTime dateTo) {
        return mapCounts("""
                SELECT action AS label, count(*) AS count
                FROM access_logs
                WHERE access_granted = true
                  AND (CAST(:dateFrom AS timestamptz) IS NULL OR created_at >= :dateFrom)
                  AND (CAST(:dateTo AS timestamptz) IS NULL OR created_at <= :dateTo)
                GROUP BY action
                ORDER BY action
                """, dateParams(dateFrom, dateTo));
    }

    public List<TopUserAccessResponse> topUsersByAccess(OffsetDateTime dateFrom, OffsetDateTime dateTo, int limit) {
        MapSqlParameterSource parameters = dateParams(dateFrom, dateTo).addValue("limit", limit);
        return jdbcTemplate.query("""
                SELECT u.id AS user_id, u.name, dep.name AS department, count(al.id) AS access_count
                FROM access_logs al
                JOIN users u ON u.id = al.user_id
                LEFT JOIN departments dep ON dep.id = u.department_id
                WHERE (CAST(:dateFrom AS timestamptz) IS NULL OR al.created_at >= :dateFrom)
                  AND (CAST(:dateTo AS timestamptz) IS NULL OR al.created_at <= :dateTo)
                GROUP BY u.id, u.name, dep.name
                ORDER BY access_count DESC, u.name ASC
                LIMIT :limit
                """, parameters, (rs, rowNum) -> new TopUserAccessResponse(
                rs.getLong("user_id"),
                rs.getString("name"),
                rs.getString("department"),
                rs.getLong("access_count")
        ));
    }

    public PageResponse<ProcessingErrorResponse> processingErrors(int page, int size) {
        MapSqlParameterSource parameters = params().addValue("limit", size).addValue("offset", page * size);
        List<ProcessingErrorResponse> content = jdbcTemplate.query("""
                SELECT d.id AS document_id, d.slug, d.title, d.file_type, d.status,
                       coalesce(c.retry_count, 0) AS retry_count, c.error_message,
                       coalesce(d.updated_at, c.extracted_at, d.created_at) AS updated_at
                FROM documents d
                LEFT JOIN document_contents c ON c.document_id = d.id
                WHERE d.permanently_deleted_at IS NULL
                  AND (d.status = 'EXTRACTION_FAILED' OR c.extraction_status = 'FAILED')
                ORDER BY coalesce(d.updated_at, c.extracted_at, d.created_at) DESC
                LIMIT :limit OFFSET :offset
                """, parameters, (rs, rowNum) -> new ProcessingErrorResponse(
                rs.getLong("document_id"),
                rs.getString("slug"),
                rs.getString("title"),
                rs.getString("file_type"),
                rs.getString("status"),
                rs.getInt("retry_count"),
                rs.getString("error_message"),
                offsetDateTime(rs, "updated_at")
        ));
        long total = processingErrorCount();
        return new PageResponse<>(content, page, size, total, totalPages(total, size));
    }

    private Map<String, Long> mapCounts(String sql, MapSqlParameterSource parameters) {
        Map<String, Long> counts = new LinkedHashMap<>();
        jdbcTemplate.query(sql, parameters, (org.springframework.jdbc.core.RowCallbackHandler) rs -> counts.put(rs.getString("label"), rs.getLong("count")));
        return counts;
    }

    private long longValue(String sql, MapSqlParameterSource parameters) {
        Long value = jdbcTemplate.queryForObject(sql, parameters, Long.class);
        return value == null ? 0 : value;
    }

    private MapSqlParameterSource params() {
        return new MapSqlParameterSource();
    }

    private MapSqlParameterSource dateParams(OffsetDateTime dateFrom, OffsetDateTime dateTo) {
        return params()
                .addValue("dateFrom", dateFrom, java.sql.Types.TIMESTAMP_WITH_TIMEZONE)
                .addValue("dateTo", dateTo, java.sql.Types.TIMESTAMP_WITH_TIMEZONE);
    }

    private int totalPages(long total, int size) {
        return total == 0 ? 0 : (int) Math.ceil((double) total / size);
    }

    private OffsetDateTime offsetDateTime(ResultSet rs, String column) throws SQLException {
        Timestamp timestamp = rs.getTimestamp(column);
        return timestamp == null ? null : timestamp.toInstant().atOffset(ZoneOffset.UTC);
    }
}
