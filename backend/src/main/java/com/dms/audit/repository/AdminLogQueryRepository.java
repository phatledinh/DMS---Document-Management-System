package com.dms.audit.repository;

import com.dms.audit.dto.AdminLogFilterRequest;
import com.dms.audit.dto.AdminLogResponse;
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
import java.util.ArrayList;
import java.util.List;

@Repository
public class AdminLogQueryRepository {
    private final NamedParameterJdbcTemplate jdbcTemplate;

    public AdminLogQueryRepository(NamedParameterJdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public PageResponse<AdminLogResponse> search(AdminLogFilterRequest filter, int page, int size) {
        MapSqlParameterSource parameters = parameters(filter)
                .addValue("limit", size)
                .addValue("offset", page * size);
        String baseSql = baseSql(filter);
        List<AdminLogResponse> content = jdbcTemplate.query(baseSql + """
                SELECT * FROM unified_logs
                ORDER BY created_at DESC, id DESC
                LIMIT :limit OFFSET :offset
                """, parameters, (rs, rowNum) -> mapLog(rs));
        Long total = jdbcTemplate.queryForObject(baseSql + "SELECT count(*) FROM unified_logs", parameters, Long.class);
        long totalElements = total == null ? 0 : total;
        return new PageResponse<>(content, page, size, totalElements, totalPages(totalElements, size));
    }

    private String baseSql(AdminLogFilterRequest filter) {
        List<String> branches = new ArrayList<>();
        if (include(filter.logType(), "AUDIT")) {
            branches.add("""
                    SELECT al.id,
                           'AUDIT' AS log_type,
                           al.actor_id,
                           u.name AS actor_name,
                           al.action,
                           al.target_type,
                           al.target_id,
                           NULL::bigint AS document_id,
                           NULL::bigint AS version_id,
                           NULL::text AS document_slug,
                           NULL::text AS document_title,
                           NULL::text AS keyword,
                           NULL::bigint AS result_count,
                           NULL::bigint AS latency_ms,
                           NULL::boolean AS access_granted,
                           NULL::text AS denial_reason,
                           al.ip_address,
                           al.user_agent,
                           al.old_value::text AS old_value,
                           al.new_value::text AS new_value,
                           NULL::text AS filters,
                           al.created_at
                    FROM audit_logs al
                    LEFT JOIN users u ON u.id = al.actor_id
                    WHERE (:actorId IS NULL OR al.actor_id = :actorId)
                      AND (:action IS NULL OR al.action = :action)
                      AND (:targetType IS NULL OR al.target_type = :targetType)
                      AND (:targetId IS NULL OR al.target_id = :targetId)
                      AND (:documentId IS NULL OR false)
                      AND (:keyword IS NULL OR false)
                      AND (CAST(:dateFrom AS timestamptz) IS NULL OR al.created_at >= :dateFrom)
                      AND (CAST(:dateTo AS timestamptz) IS NULL OR al.created_at <= :dateTo)
                    """);
        }
        if (include(filter.logType(), "ACCESS")) {
            branches.add("""
                    SELECT al.id,
                           'ACCESS' AS log_type,
                           al.user_id AS actor_id,
                           u.name AS actor_name,
                           al.action,
                           'DOCUMENT' AS target_type,
                           al.document_id AS target_id,
                           al.document_id AS document_id,
                           al.version_id AS version_id,
                           d.slug AS document_slug,
                           d.title AS document_title,
                           NULL::text AS keyword,
                           NULL::bigint AS result_count,
                           NULL::bigint AS latency_ms,
                           al.access_granted,
                           al.denial_reason,
                           al.ip_address,
                           al.user_agent,
                           NULL::text AS old_value,
                           NULL::text AS new_value,
                           NULL::text AS filters,
                           al.created_at
                    FROM access_logs al
                    LEFT JOIN users u ON u.id = al.user_id
                    LEFT JOIN documents d ON d.id = al.document_id
                    WHERE (:actorId IS NULL OR al.user_id = :actorId)
                      AND (:action IS NULL OR al.action = :action)
                      AND (:targetType IS NULL OR :targetType = 'DOCUMENT')
                      AND (:targetId IS NULL OR al.document_id = :targetId)
                      AND (:documentId IS NULL OR al.document_id = :documentId)
                      AND (:keyword IS NULL OR lower(d.title) LIKE concat('%', lower(:keyword), '%'))
                      AND (CAST(:dateFrom AS timestamptz) IS NULL OR al.created_at >= :dateFrom)
                      AND (CAST(:dateTo AS timestamptz) IS NULL OR al.created_at <= :dateTo)
                    """);
        }
        if (include(filter.logType(), "SEARCH")) {
            branches.add("""
                    SELECT sl.id,
                           'SEARCH' AS log_type,
                           sl.user_id AS actor_id,
                           u.name AS actor_name,
                           'SEARCH' AS action,
                           'SEARCH' AS target_type,
                           NULL::bigint AS target_id,
                           NULL::bigint AS document_id,
                           NULL::bigint AS version_id,
                           NULL::text AS document_slug,
                           NULL::text AS document_title,
                           sl.keyword,
                           sl.result_count::bigint AS result_count,
                           sl.latency_ms::bigint AS latency_ms,
                           NULL::boolean AS access_granted,
                           NULL::text AS denial_reason,
                           NULL::text AS ip_address,
                           NULL::text AS user_agent,
                           NULL::text AS old_value,
                           NULL::text AS new_value,
                           sl.filters::text AS filters,
                           sl.created_at
                    FROM search_logs sl
                    LEFT JOIN users u ON u.id = sl.user_id
                    WHERE (:actorId IS NULL OR sl.user_id = :actorId)
                      AND (:action IS NULL OR :action = 'SEARCH')
                      AND (:targetType IS NULL OR :targetType = 'SEARCH')
                      AND (:targetId IS NULL OR false)
                      AND (:documentId IS NULL OR false)
                      AND (:keyword IS NULL OR lower(sl.keyword) LIKE concat('%', lower(:keyword), '%'))
                      AND (CAST(:dateFrom AS timestamptz) IS NULL OR sl.created_at >= :dateFrom)
                      AND (CAST(:dateTo AS timestamptz) IS NULL OR sl.created_at <= :dateTo)
                    """);
        }
        if (branches.isEmpty()) {
            branches.add("""
                    SELECT NULL::bigint AS id, NULL::text AS log_type, NULL::bigint AS actor_id, NULL::text AS actor_name,
                           NULL::text AS action, NULL::text AS target_type, NULL::bigint AS target_id, NULL::bigint AS document_id, NULL::bigint AS version_id,
                           NULL::text AS document_slug, NULL::text AS document_title, NULL::text AS keyword, NULL::bigint AS result_count, NULL::bigint AS latency_ms,
                           NULL::boolean AS access_granted, NULL::text AS denial_reason, NULL::text AS ip_address, NULL::text AS user_agent,
                           NULL::text AS old_value, NULL::text AS new_value, NULL::text AS filters, NULL::timestamptz AS created_at
                    WHERE false
                    """);
        }
        return "WITH unified_logs AS (" + String.join(" UNION ALL ", branches) + ") ";
    }

    private MapSqlParameterSource parameters(AdminLogFilterRequest filter) {
        return new MapSqlParameterSource()
                .addValue("actorId", filter.actorId(), Types.BIGINT)
                .addValue("action", blankToNull(filter.action()), Types.VARCHAR)
                .addValue("targetType", blankToNull(filter.targetType()), Types.VARCHAR)
                .addValue("targetId", filter.targetId(), Types.BIGINT)
                .addValue("documentId", filter.documentId(), Types.BIGINT)
                .addValue("keyword", blankToNull(filter.keyword()), Types.VARCHAR)
                .addValue("dateFrom", filter.dateFrom(), Types.TIMESTAMP_WITH_TIMEZONE)
                .addValue("dateTo", filter.dateTo(), Types.TIMESTAMP_WITH_TIMEZONE);
    }

    private boolean include(String requestedType, String type) {
        return requestedType == null || requestedType.isBlank() || "ALL".equalsIgnoreCase(requestedType) || type.equalsIgnoreCase(requestedType);
    }

    private AdminLogResponse mapLog(ResultSet rs) throws SQLException {
        return new AdminLogResponse(
                rs.getLong("id"),
                rs.getString("log_type"),
                nullableLong(rs, "actor_id"),
                rs.getString("actor_name"),
                rs.getString("action"),
                rs.getString("target_type"),
                nullableLong(rs, "target_id"),
                nullableLong(rs, "document_id"),
                nullableLong(rs, "version_id"),
                rs.getString("document_slug"),
                rs.getString("document_title"),
                rs.getString("keyword"),
                nullableLong(rs, "result_count"),
                nullableLong(rs, "latency_ms"),
                nullableBoolean(rs, "access_granted"),
                rs.getString("denial_reason"),
                rs.getString("ip_address"),
                rs.getString("user_agent"),
                rs.getString("old_value"),
                rs.getString("new_value"),
                rs.getString("filters"),
                offsetDateTime(rs, "created_at")
        );
    }

    private Long nullableLong(ResultSet rs, String column) throws SQLException {
        long value = rs.getLong(column);
        return rs.wasNull() ? null : value;
    }

    private Boolean nullableBoolean(ResultSet rs, String column) throws SQLException {
        boolean value = rs.getBoolean(column);
        return rs.wasNull() ? null : value;
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private int totalPages(long total, int size) {
        return total == 0 ? 0 : (int) Math.ceil((double) total / size);
    }

    private OffsetDateTime offsetDateTime(ResultSet rs, String column) throws SQLException {
        Timestamp timestamp = rs.getTimestamp(column);
        return timestamp == null ? null : timestamp.toInstant().atOffset(ZoneOffset.UTC);
    }
}
