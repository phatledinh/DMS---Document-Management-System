package com.dms.approval.repository;

import com.dms.approval.dto.ApprovalItemResponse;
import com.dms.approval.dto.ApprovalSummaryResponse;
import com.dms.document.dto.PageResponse;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Arrays;
import java.util.List;

@Repository
public class AdminApprovalRepository {
    private final NamedParameterJdbcTemplate jdbcTemplate;

    public AdminApprovalRepository(NamedParameterJdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public PageResponse<ApprovalItemResponse> search(String status, String keyword, String department, String category, int page, int size) {
        MapSqlParameterSource parameters = new MapSqlParameterSource()
                .addValue("status", normalizeStatus(status), java.sql.Types.VARCHAR)
                .addValue("keyword", blankToNull(keyword), java.sql.Types.VARCHAR)
                .addValue("department", blankToNull(department), java.sql.Types.VARCHAR)
                .addValue("category", blankToNull(category), java.sql.Types.VARCHAR)
                .addValue("limit", size)
                .addValue("offset", page * size);
        String baseSql = baseSql();
        List<ApprovalItemResponse> content = jdbcTemplate.query(baseSql + """
                SELECT * FROM approval_versions
                ORDER BY submitted_at DESC, version_id DESC
                LIMIT :limit OFFSET :offset
                """, parameters, (rs, rowNum) -> mapItem(rs));
        Long total = jdbcTemplate.queryForObject(baseSql + "SELECT count(*) FROM approval_versions", parameters, Long.class);
        long totalElements = total == null ? 0 : total;
        return new PageResponse<>(content, page, size, totalElements, totalPages(totalElements, size));
    }

    public ApprovalSummaryResponse summary() {
        return jdbcTemplate.queryForObject("""
                SELECT count(*) FILTER (WHERE v.status = 'PENDING_APPROVAL') AS pending,
                       count(*) FILTER (WHERE v.status = 'INDEXED') AS approved,
                       count(*) FILTER (WHERE v.status = 'REJECTED') AS rejected
                FROM document_versions v
                JOIN documents d ON d.id = v.document_id
                WHERE d.permanently_deleted_at IS NULL
                  AND v.status IN ('PENDING_APPROVAL', 'INDEXED', 'REJECTED')
                """, new MapSqlParameterSource(), (rs, rowNum) -> new ApprovalSummaryResponse(
                rs.getLong("pending"),
                rs.getLong("approved"),
                rs.getLong("rejected")
        ));
    }

    private String baseSql() {
        return """
                WITH approval_versions AS (
                    SELECT v.id AS version_id,
                           v.version_number,
                           d.id AS document_id,
                           d.document_code,
                           d.title,
                           d.slug,
                           CASE WHEN v.status = 'PENDING_APPROVAL' THEN 'PENDING'
                                WHEN v.status = 'INDEXED' THEN 'APPROVED'
                                ELSE 'REJECTED' END AS approval_status,
                           v.status,
                           u.name AS submitter,
                           v.created_at AS submitted_at,
                           (
                               SELECT string_agg(dep.name, ', ')
                               FROM user_departments ud
                               JOIN category_department_permissions cdp ON cdp.department_id = ud.department_id
                               JOIN departments dep ON dep.id = ud.department_id
                               WHERE ud.user_id = v.uploaded_by
                                 AND cdp.category_id = d.category_id
                                 AND cdp.permission = 'UPLOAD'
                           ) AS department,
                           c.name AS category,
                           v.file_name,
                           v.file_size,
                           coalesce(string_agg(DISTINCT t.name, ','), '') AS tags,
                           coalesce(v.extracted_text, d.description, '') AS summary,
                           d.effective_date,
                           d.expiry_date,
                           v.reject_reason AS reason
                    FROM document_versions v
                    JOIN documents d ON d.id = v.document_id
                    LEFT JOIN users u ON u.id = v.uploaded_by
                    LEFT JOIN categories c ON c.id = d.category_id
                    LEFT JOIN document_tags dt ON dt.document_id = d.id
                    LEFT JOIN tags t ON t.id = dt.tag_id
                    WHERE d.permanently_deleted_at IS NULL
                      AND v.status IN ('PENDING_APPROVAL', 'INDEXED', 'REJECTED')
                      AND (:status IS NULL OR CASE WHEN v.status = 'PENDING_APPROVAL' THEN 'PENDING'
                                                   WHEN v.status = 'INDEXED' THEN 'APPROVED'
                                                   ELSE 'REJECTED' END = :status)
                      AND (:keyword IS NULL OR lower(d.title) LIKE concat('%', lower(:keyword), '%') OR lower(d.document_code) LIKE concat('%', lower(:keyword), '%') OR lower(u.name) LIKE concat('%', lower(:keyword), '%'))
                      AND (:department IS NULL OR EXISTS (
                          SELECT 1 FROM user_departments ud2
                          JOIN category_department_permissions cdp2 ON cdp2.department_id = ud2.department_id
                          JOIN departments dep2 ON dep2.id = ud2.department_id
                          WHERE ud2.user_id = v.uploaded_by
                            AND cdp2.category_id = d.category_id
                            AND cdp2.permission = 'UPLOAD'
                            AND (dep2.name = :department OR dep2.id::text = :department)
                      ))
                      AND (:category IS NULL OR c.name = :category OR c.id::text = :category)
                    GROUP BY v.id, v.version_number, d.id, d.document_code, d.title, d.slug, v.status, u.name, v.created_at, c.name, v.file_name, v.file_size, v.extracted_text, v.reject_reason, d.description, d.effective_date, d.expiry_date
                )
                """;
    }

    private ApprovalItemResponse mapItem(ResultSet rs) throws SQLException {
        String fileName = rs.getString("file_name");
        String fileType = fileName != null && fileName.contains(".") ? fileName.substring(fileName.lastIndexOf('.') + 1).toUpperCase() : "";
        return new ApprovalItemResponse(
                rs.getLong("document_id"),
                rs.getLong("version_id"),
                rs.getString("version_number"),
                rs.getString("document_code"),
                rs.getString("title"),
                rs.getString("approval_status"),
                rs.getString("submitter"),
                offsetDateTime(rs, "submitted_at"),
                rs.getString("department"),
                rs.getString("category"),
                fileType,
                rs.getLong("file_size"),
                split(rs.getString("tags")),
                truncate(rs.getString("summary")),
                localDate(rs, "effective_date"),
                localDate(rs, "expiry_date"),
                rs.getString("slug"),
                rs.getString("reason")
        );
    }

    private String normalizeStatus(String status) {
        String value = blankToNull(status);
        return value == null || "ALL".equalsIgnoreCase(value) ? null : value.toUpperCase();
    }

    private List<String> split(String value) {
        if (value == null || value.isBlank()) {
            return List.of();
        }
        return Arrays.stream(value.split(",")).toList();
    }

    private String truncate(String value) {
        if (value == null) {
            return "";
        }
        return value.length() <= 300 ? value : value.substring(0, 300);
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

    private java.time.LocalDate localDate(ResultSet rs, String column) throws SQLException {
        java.sql.Date date = rs.getDate(column);
        return date == null ? null : date.toLocalDate();
    }
}
