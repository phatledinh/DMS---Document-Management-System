package com.dms.document.repository;

import com.dms.document.dto.DocumentSearchRequest;
import com.dms.document.dto.SearchFacetValueResponse;
import com.dms.document.dto.SearchSuggestionResponse;
import com.dms.identity.entity.Role;
import com.dms.identity.entity.User;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Date;
import java.util.HashMap;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.sql.Types;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;

@Repository
public class DocumentSearchRepository {
    private static final int DEFAULT_PAGE = 0;
    private static final int DEFAULT_SIZE = 20;
    private static final int MAX_SIZE = 100;
    private static final int DEFAULT_SUGGESTION_LIMIT = 10;
    private static final int MAX_SUGGESTION_LIMIT = 20;

    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    public DocumentSearchRepository(NamedParameterJdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
    }

    public List<DocumentSearchRow> search(User user, DocumentSearchRequest request) {
        MapSqlParameterSource parameters = parameters(user, request)
                .addValue("limit", size(request))
                .addValue("offset", page(request) * size(request));
        return jdbcTemplate.query(searchSql(request), parameters, (rs, rowNum) -> searchRow(rs));
    }

    public long count(User user, DocumentSearchRequest request) {
        Long count = jdbcTemplate.queryForObject(baseSql(request) + "SELECT count(*) FROM matched", parameters(user, request), Long.class);
        return count == null ? 0 : count;
    }

    public List<SearchFacetValueResponse> facets(User user, DocumentSearchRequest request, String field) {
        String expression = switch (field) {
            case "categories" -> "category_id::text";
            case "departments" -> "department_id::text";
            case "fileTypes" -> "file_type";
            case "accessLevels" -> "access_level";
            default -> throw new IllegalArgumentException("Unsupported facet field: " + field);
        };
        return jdbcTemplate.query(baseSql(request) + """
                SELECT %s AS value, %s AS label, count(*) AS count
                FROM matched
                WHERE %s IS NOT NULL
                GROUP BY %s
                ORDER BY count DESC, label ASC
                LIMIT 20
                """.formatted(expression, expression, expression, expression), parameters(user, request), (rs, rowNum) -> new SearchFacetValueResponse(
                rs.getString("value"),
                rs.getString("label"),
                rs.getLong("count")
        ));
    }

    public List<SearchFacetValueResponse> tagFacets(User user, DocumentSearchRequest request) {
        return jdbcTemplate.query(baseSql(request) + """
                SELECT t.id::text AS value, t.name AS label, count(*) AS count
                FROM matched m
                JOIN document_tags dt ON dt.document_id = m.id
                JOIN tags t ON t.id = dt.tag_id
                WHERE t.deleted_at IS NULL
                GROUP BY t.id, t.name
                ORDER BY count DESC, t.name ASC
                LIMIT 20
                """, parameters(user, request), (rs, rowNum) -> new SearchFacetValueResponse(
                rs.getString("value"),
                rs.getString("label"),
                rs.getLong("count")
        ));
    }

    public List<SearchSuggestionResponse> suggestions(User user, String prefix, Integer requestedLimit) {
        int limit = requestedLimit == null || requestedLimit < 1 ? DEFAULT_SUGGESTION_LIMIT : Math.min(requestedLimit, MAX_SUGGESTION_LIMIT);
        MapSqlParameterSource parameters = parameters(user, emptyRequest())
                .addValue("prefix", normalize(prefix))
                .addValue("limit", limit);
        return jdbcTemplate.query("""
                WITH visible AS (
                    SELECT d.id, si.title_text, si.document_code_text, si.tag_text
                    FROM documents d
                    JOIN document_search_index si ON si.document_id = d.id
                    WHERE %s
                ), suggestions AS (
                    SELECT title_text AS text, 'TITLE' AS type, id AS document_id, similarity(unaccent(title_text), unaccent(:prefix)) AS score
                    FROM visible
                    WHERE :prefix <> '' AND (unaccent(title_text) ILIKE unaccent(:prefix) || '%%' OR unaccent(title_text) %% unaccent(:prefix))
                    UNION ALL
                    SELECT document_code_text AS text, 'DOCUMENT_CODE' AS type, id AS document_id, similarity(unaccent(document_code_text), unaccent(:prefix)) AS score
                    FROM visible
                    WHERE :prefix <> '' AND document_code_text IS NOT NULL AND (unaccent(document_code_text) ILIKE unaccent(:prefix) || '%%' OR unaccent(document_code_text) %% unaccent(:prefix))
                    UNION ALL
                    SELECT trim(tag) AS text, 'TAG' AS type, NULL::bigint AS document_id, similarity(unaccent(trim(tag)), unaccent(:prefix)) AS score
                    FROM visible, regexp_split_to_table(coalesce(tag_text, ''), ',') AS tag
                    WHERE :prefix <> '' AND trim(tag) <> '' AND (unaccent(trim(tag)) ILIKE unaccent(:prefix) || '%%' OR unaccent(trim(tag)) %% unaccent(:prefix))
                )
                SELECT text, type, min(document_id) AS document_id
                FROM suggestions
                GROUP BY text, type
                ORDER BY max(score) DESC, text ASC
                LIMIT :limit
                """.formatted(visibilityPredicate(user)), parameters, (rs, rowNum) -> new SearchSuggestionResponse(
                rs.getString("text"),
                rs.getString("type"),
                rs.getObject("document_id", Long.class)
        ));
    }

    public void logSearch(User user, DocumentSearchRequest request, long resultCount, long latencyMs) {
        jdbcTemplate.update("""
                INSERT INTO search_logs (user_id, keyword, filters, result_count, latency_ms)
                VALUES (:userId, :keyword, CAST(:filters AS jsonb), :resultCount, :latencyMs)
                """, new MapSqlParameterSource()
                .addValue("userId", user.getId())
                .addValue("keyword", normalize(request.q()))
                .addValue("filters", filtersJson(request))
                .addValue("resultCount", resultCount)
                .addValue("latencyMs", Math.toIntExact(Math.min(latencyMs, Integer.MAX_VALUE))));
    }

    public void logSuggestion(User user, String prefix, int resultCount, long latencyMs) {
        jdbcTemplate.update("""
                INSERT INTO search_logs (user_id, keyword, filters, result_count, latency_ms)
                VALUES (:userId, :keyword, CAST(:filters AS jsonb), :resultCount, :latencyMs)
                """, new MapSqlParameterSource()
                .addValue("userId", user.getId())
                .addValue("keyword", normalize(prefix))
                .addValue("filters", "{\"type\":\"suggestions\"}")
                .addValue("resultCount", resultCount)
                .addValue("latencyMs", Math.toIntExact(Math.min(latencyMs, Integer.MAX_VALUE))));
    }

    private String searchSql(DocumentSearchRequest request) {
        return baseSql(request) + """
                SELECT id, title, document_code, file_type, file_size, status, access_level, version_number,
                       view_count, download_count, category_id, department_id, owner_id, uploaded_by,
                       effective_date, expiry_date, created_at, updated_at, relevance_score,
                       title_highlight, description_highlight, content_highlight
                FROM matched
                ORDER BY %s
                LIMIT :limit OFFSET :offset
                """.formatted(orderBy(request));
    }

    private String baseSql(DocumentSearchRequest request) {
        boolean hasQuery = hasQuery(request);
        String queryCte = hasQuery ? "query AS (SELECT websearch_to_tsquery('simple', unaccent(:query)) AS search_value, websearch_to_tsquery('simple', :query) AS highlight_value)," : "";
        String queryJoin = hasQuery ? "CROSS JOIN query q" : "";
        String textPredicate = hasQuery ? "AND si.search_vector @@ q.search_value" : "";
        String queryValueSelect = hasQuery ? ", q.search_value AS query_value, q.highlight_value AS highlight_query_value" : "";
        String rankExpression = hasQuery
                ? "ts_rank_cd(d.search_vector, d.query_value) + CASE WHEN lower(coalesce(d.document_code, '')) = lower(:query) THEN 2.0 ELSE 0 END"
                : "0.0";
        String titleHighlight = hasQuery ? "ts_headline('simple', coalesce(d.title_text, ''), d.highlight_query_value, 'StartSel=<em>, StopSel=</em>, MaxWords=20, MinWords=5, HighlightAll=true')" : "NULL";
        String descriptionHighlight = hasQuery ? "ts_headline('simple', coalesce(d.description_text, ''), d.highlight_query_value, 'StartSel=<em>, StopSel=</em>, MaxWords=30, MinWords=8, HighlightAll=true')" : "NULL";
        String contentHighlight = hasQuery ? "ts_headline('simple', coalesce(d.content_text, ''), d.highlight_query_value, 'StartSel=<em>, StopSel=</em>, MaxWords=35, MinWords=10, MaxFragments=2')" : "NULL";
        return """
                WITH %s visible AS (
                    SELECT d.*, si.search_vector, si.title_text, si.description_text, si.content_text%s
                    FROM documents d
                    JOIN document_search_index si ON si.document_id = d.id
                    %s
                    WHERE %s
                      %s
                      %s
                ), matched AS (
                    SELECT id, title, document_code, file_type, file_size, status, access_level, version_number,
                           view_count, download_count, category_id, department_id, owner_id, uploaded_by,
                           effective_date, expiry_date, created_at, updated_at,
                           %s AS relevance_score,
                           %s AS title_highlight,
                           %s AS description_highlight,
                           %s AS content_highlight
                    FROM visible d
                )
                """.formatted(queryCte, queryValueSelect, queryJoin, "(:admin OR (" + DocumentAclSqlFragments.USER_VISIBLE_PREDICATE + "))", textPredicate, filterPredicate(request), rankExpression, titleHighlight, descriptionHighlight, contentHighlight);
    }

    private String filterPredicate(DocumentSearchRequest request) {
        StringBuilder filters = new StringBuilder();
        if (request.categoryId() != null) {
            filters.append(" AND d.category_id = :categoryId");
        }
        if (request.departmentId() != null) {
            filters.append(" AND d.department_id = :departmentId");
        }
        if (request.fileType() != null && !request.fileType().isBlank()) {
            filters.append(" AND upper(d.file_type) = upper(:fileType)");
        }
        if (request.resolvedAccessLevel() != null) {
            filters.append(" AND d.access_level = :accessLevel");
        }
        if (request.ownerId() != null) {
            filters.append(" AND d.owner_id = :ownerId");
        }
        if (request.uploadedBy() != null) {
            filters.append(" AND d.uploaded_by = :uploadedBy");
        }
        if (request.status() != null) {
            filters.append(" AND (:admin AND d.status = :status)");
        }
        if (request.resolvedDateFrom() != null) {
            filters.append(" AND d.effective_date >= :dateFrom");
        }
        if (request.resolvedDateTo() != null) {
            filters.append(" AND d.effective_date <= :dateTo");
        }
        if (request.tagIds() != null && !request.tagIds().isEmpty()) {
            filters.append(" AND EXISTS (SELECT 1 FROM document_tags dt WHERE dt.document_id = d.id AND dt.tag_id IN (:tagIds))");
        }
        return filters.toString();
    }

    private String visibilityPredicate(User user) {
        return user.getRole() == Role.ADMIN ? DocumentAclSqlFragments.ADMIN_VISIBLE_PREDICATE : DocumentAclSqlFragments.USER_VISIBLE_PREDICATE;
    }

    private MapSqlParameterSource parameters(User user, DocumentSearchRequest request) {
        MapSqlParameterSource parameters = new MapSqlParameterSource()
                .addValue("admin", user.getRole() == Role.ADMIN, Types.BOOLEAN)
                .addValue("currentUserId", user.getId(), Types.BIGINT)
                .addValue("userDepartmentId", user.getDepartmentId(), Types.BIGINT)
                .addValue("query", normalize(request.q()), Types.VARCHAR)
                .addValue("categoryId", request.categoryId(), Types.BIGINT)
                .addValue("departmentId", request.departmentId(), Types.BIGINT)
                .addValue("fileType", normalize(request.fileType()), Types.VARCHAR)
                .addValue("accessLevel", enumName(request.resolvedAccessLevel()), Types.VARCHAR)
                .addValue("ownerId", request.ownerId(), Types.BIGINT)
                .addValue("uploadedBy", request.uploadedBy(), Types.BIGINT)
                .addValue("status", enumName(request.status()), Types.VARCHAR)
                .addValue("dateFrom", request.resolvedDateFrom(), Types.TIMESTAMP_WITH_TIMEZONE)
                .addValue("dateTo", request.resolvedDateTo(), Types.TIMESTAMP_WITH_TIMEZONE);
        if (request.tagIds() != null && !request.tagIds().isEmpty()) {
            parameters.addValue("tagIds", request.tagIds().toArray(Long[]::new));
        }
        return parameters;
    }

    private String orderBy(DocumentSearchRequest request) {
        String sort = normalize(request.sort());
        if (hasQuery(request) && (sort == null || sort.isBlank() || "relevance".equals(sort))) {
            return "relevance_score DESC, created_at DESC";
        }
        return switch (sort == null ? "created_at_desc" : sort) {
            case "created_at_asc", "oldest" -> "created_at ASC";
            case "updated_at_desc" -> "updated_at DESC NULLS LAST";
            case "updated_at_asc" -> "updated_at ASC NULLS LAST";
            case "title", "title_asc" -> "title ASC";
            case "view_count_desc" -> "view_count DESC, created_at DESC";
            case "download_count_desc" -> "download_count DESC, created_at DESC";
            case "relevance" -> "relevance_score DESC, created_at DESC";
            default -> "created_at DESC";
        };
    }

    private DocumentSearchRow searchRow(ResultSet rs) throws SQLException {
        return new DocumentSearchRow(
                rs.getLong("id"),
                rs.getString("title"),
                rs.getString("document_code"),
                rs.getString("file_type"),
                rs.getLong("file_size"),
                rs.getString("status"),
                rs.getString("access_level"),
                rs.getString("version_number"),
                rs.getInt("view_count"),
                rs.getInt("download_count"),
                rs.getLong("category_id"),
                rs.getObject("department_id", Long.class),
                rs.getLong("owner_id"),
                rs.getLong("uploaded_by"),
                localDate(rs, "effective_date"),
                localDate(rs, "expiry_date"),
                offsetDateTime(rs, "created_at"),
                offsetDateTime(rs, "updated_at"),
                rs.getDouble("relevance_score"),
                rs.getString("title_highlight"),
                rs.getString("description_highlight"),
                rs.getString("content_highlight")
        );
    }

    private String filtersJson(DocumentSearchRequest request) {
        Map<String, Object> filters = new HashMap<>();
        filters.put("categoryId", request.categoryId());
        filters.put("departmentId", request.departmentId());
        filters.put("fileType", request.fileType());
        filters.put("status", request.status());
        filters.put("accessLevel", request.resolvedAccessLevel());
        filters.put("ownerId", request.ownerId());
        filters.put("uploadedBy", request.uploadedBy());
        filters.put("tagIds", request.tagIds());
        filters.put("dateFrom", request.resolvedDateFrom());
        filters.put("dateTo", request.resolvedDateTo());
        filters.put("sort", request.sort());
        filters.put("page", page(request));
        filters.put("size", size(request));
        try {
            return objectMapper.writeValueAsString(filters);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Cannot serialize search filters", exception);
        }
    }

    private DocumentSearchRequest emptyRequest() {
        return new DocumentSearchRequest(null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null);
    }

    private boolean hasQuery(DocumentSearchRequest request) {
        String query = normalize(request.q());
        return query != null && !query.isBlank();
    }

    private int page(DocumentSearchRequest request) {
        return request.page() == null || request.page() < 0 ? DEFAULT_PAGE : request.page();
    }

    private int size(DocumentSearchRequest request) {
        return request.size() == null || request.size() < 1 ? DEFAULT_SIZE : Math.min(request.size(), MAX_SIZE);
    }

    private String normalize(String value) {
        return value == null ? null : value.trim();
    }

    private String enumName(Enum<?> value) {
        return value == null ? null : value.name();
    }

    private LocalDate localDate(ResultSet rs, String column) throws SQLException {
        Date date = rs.getDate(column);
        return date == null ? null : date.toLocalDate();
    }

    private OffsetDateTime offsetDateTime(ResultSet rs, String column) throws SQLException {
        Timestamp timestamp = rs.getTimestamp(column);
        return timestamp == null ? null : timestamp.toInstant().atOffset(ZoneOffset.UTC);
    }
}
