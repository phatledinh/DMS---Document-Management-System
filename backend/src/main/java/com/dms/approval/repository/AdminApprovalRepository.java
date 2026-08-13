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
                SELECT * FROM approval_documents
                ORDER BY submitted_at DESC, id DESC
                LIMIT :limit OFFSET :offset
                """, parameters, (rs, rowNum) -> mapItem(rs));
        Long total = jdbcTemplate.queryForObject(baseSql + "SELECT count(*) FROM approval_documents", parameters, Long.class);
        long totalElements = total == null ? 0 : total;
        return new PageResponse<>(content, page, size, totalElements, totalPages(totalElements, size));
    }

    public ApprovalSummaryResponse summary() {
        return jdbcTemplate.queryForObject("""
                SELECT count(*) FILTER (WHERE status IN ('AWAITING_UPLOAD', 'PROCESSING')) AS pending,
                       count(*) FILTER (WHERE status = 'INDEXED') AS approved,
                       count(*) FILTER (WHERE status IN ('EXTRACTION_FAILED', 'ARCHIVED', 'DELETED')) AS rejected
                FROM documents
                WHERE permanently_deleted_at IS NULL
                """, new MapSqlParameterSource(), (rs, rowNum) -> new ApprovalSummaryResponse(
                rs.getLong("pending"),
                rs.getLong("approved"),
                rs.getLong("rejected")
        ));
    }

    private String baseSql() {
        return """
                WITH approval_documents AS (
                    SELECT d.id, d.document_code, d.title,
                           CASE WHEN d.status IN ('AWAITING_UPLOAD', 'PROCESSING') THEN 'PENDING'
                                WHEN d.status = 'INDEXED' THEN 'APPROVED'
                                ELSE 'REJECTED' END AS approval_status,
                           d.status,
                           u.name AS submitter,
                           d.created_at AS submitted_at,
                           dep.name AS department,
                           c.name AS category,
                           d.file_type,
                           d.file_size,
                           coalesce(string_agg(DISTINCT t.name, ','), '') AS tags,
                           coalesce(dc.extracted_text, d.description, '') AS summary
                    FROM documents d
                    LEFT JOIN users u ON u.id = d.uploaded_by
                    LEFT JOIN departments dep ON dep.id = d.department_id
                    LEFT JOIN categories c ON c.id = d.category_id
                    LEFT JOIN document_contents dc ON dc.document_id = d.id
                    LEFT JOIN document_tags dt ON dt.document_id = d.id
                    LEFT JOIN tags t ON t.id = dt.tag_id
                    WHERE d.permanently_deleted_at IS NULL
                      AND (:status IS NULL OR CASE WHEN d.status IN ('AWAITING_UPLOAD', 'PROCESSING') THEN 'PENDING'
                                                   WHEN d.status = 'INDEXED' THEN 'APPROVED'
                                                   ELSE 'REJECTED' END = :status)
                      AND (:keyword IS NULL OR lower(d.title) LIKE concat('%', lower(:keyword), '%') OR lower(d.document_code) LIKE concat('%', lower(:keyword), '%') OR lower(u.name) LIKE concat('%', lower(:keyword), '%'))
                      AND (:department IS NULL OR dep.name = :department OR dep.id::text = :department)
                      AND (:category IS NULL OR c.name = :category OR c.id::text = :category)
                    GROUP BY d.id, d.document_code, d.title, d.status, u.name, d.created_at, dep.name, c.name, d.file_type, d.file_size, dc.extracted_text, d.description
                )
                """;
    }

    private ApprovalItemResponse mapItem(ResultSet rs) throws SQLException {
        return new ApprovalItemResponse(
                rs.getLong("id"),
                rs.getString("document_code"),
                rs.getString("title"),
                rs.getString("approval_status"),
                rs.getString("submitter"),
                offsetDateTime(rs, "submitted_at"),
                rs.getString("department"),
                rs.getString("category"),
                rs.getString("file_type"),
                rs.getLong("file_size"),
                split(rs.getString("tags")),
                truncate(rs.getString("summary"))
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
}
