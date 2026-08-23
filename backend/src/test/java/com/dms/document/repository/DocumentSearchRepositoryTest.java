package com.dms.document.repository;

import com.dms.document.dto.DocumentSearchRequest;
import com.dms.identity.entity.Role;
import com.dms.identity.entity.User;
import com.dms.identity.entity.UserStatus;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DocumentSearchRepositoryTest {
    @Mock
    private NamedParameterJdbcTemplate jdbcTemplate;

    private DocumentSearchRepository repository;

    @BeforeEach
    void setUp() {
        repository = new DocumentSearchRepository(jdbcTemplate, new ObjectMapper());
    }

    @Test
    void search_buildsPostgresFtsSqlWithAclBeforeResults() {
        User user = user(Role.USER);
        DocumentSearchRequest request = new DocumentSearchRequest("quy che", null, null, null, null, null, null, null, null, null, null, null, "relevance", 0, 10);
        when(jdbcTemplate.query(any(String.class), any(MapSqlParameterSource.class), any(RowMapper.class))).thenReturn(java.util.List.of());
        ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);

        repository.search(user, request);

        verify(jdbcTemplate).query(sqlCaptor.capture(), any(MapSqlParameterSource.class), any(RowMapper.class));
        String sql = sqlCaptor.getValue();
        assertThat(sql).contains("websearch_to_tsquery('simple', unaccent(:query)) AS search_value");
        assertThat(sql).contains("websearch_to_tsquery('simple', :query) AS highlight_value");
        assertThat(sql).contains("si.search_vector @@ q.search_value");
        assertThat(sql).contains("d.highlight_query_value");
        assertThat(sql).contains("AS match_count");
        assertThat(sql).contains("to_tsvector('simple', unaccent(coalesce(d.title_text, '')))");
        assertThat(sql).contains("to_tsvector('simple', unaccent(coalesce(d.description_text, '')))");
        assertThat(sql).contains("to_tsvector('simple', unaccent(coalesce(d.content_text, '')))");
        assertThat(sql).contains("d.status = 'INDEXED'");
        assertThat(sql).doesNotContain("category_user_permissions");
        assertThat(sql).contains("category_department_permissions");
        assertThat(sql).contains("user_departments");
        assertThat(sql).contains("cdp.category_id = d.category_id");
        assertThat(sql).contains("cdp.permission = 'VIEW'");
        assertThat(sql).contains("ts_headline");
    }

    @Test
    void search_bindsTagIdsAsCollectionForSqlInClause() {
        User admin = user(Role.ADMIN);
        DocumentSearchRequest request = new DocumentSearchRequest(
                null, null, null, null, null, null, null,
                List.of(3L, 7L), null, null, null, null,
                "createdAt,desc", 0, 5
        );
        when(jdbcTemplate.query(any(String.class), any(MapSqlParameterSource.class), any(RowMapper.class)))
                .thenReturn(List.of());
        ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<MapSqlParameterSource> parametersCaptor = ArgumentCaptor.forClass(MapSqlParameterSource.class);

        repository.search(admin, request);

        verify(jdbcTemplate).query(sqlCaptor.capture(), parametersCaptor.capture(), any(RowMapper.class));
        assertThat(sqlCaptor.getValue()).contains("dt.tag_id IN (:tagIds)");
        assertThat(parametersCaptor.getValue().getValue("tagIds")).isEqualTo(List.of(3L, 7L));
    }

    @Test
    void logSearch_serializesNullFilters() {
        User user = user(Role.USER);
        DocumentSearchRequest request = new DocumentSearchRequest("doc", null, null, null, null, null, null, null, null, null, null, null, null, null, null);
        ArgumentCaptor<MapSqlParameterSource> parametersCaptor = ArgumentCaptor.forClass(MapSqlParameterSource.class);

        repository.logSearch(user, request, 0, 12);

        verify(jdbcTemplate).update(eq("""
                INSERT INTO search_logs (user_id, keyword, filters, result_count, latency_ms)
                VALUES (:userId, :keyword, CAST(:filters AS jsonb), :resultCount, :latencyMs)
                """), parametersCaptor.capture());
        assertThat(parametersCaptor.getValue().getValue("filters").toString()).contains("categoryId");
        assertThat(parametersCaptor.getValue().getValue("keyword")).isEqualTo("doc");
    }

    private User user(Role role) {
        User user = new User();
        user.setId(10L);
        user.setEmail("user@example.com");
        user.setName("User");
        user.setPassword("hash");
        user.setRole(role);
        user.setDepartmentId(20L);
        user.setStatus(UserStatus.ACTIVE);
        return user;
    }
}
