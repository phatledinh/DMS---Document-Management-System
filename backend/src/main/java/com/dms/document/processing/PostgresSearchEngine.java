package com.dms.document.processing;

import com.dms.document.entity.Document;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class PostgresSearchEngine {
    private final JdbcTemplate jdbcTemplate;

    public PostgresSearchEngine(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public void refreshIndex(Document document, String extractedText) {
        jdbcTemplate.update("""
                WITH source AS (
                    SELECT
                        d.id AS document_id,
                        d.document_code,
                        d.title,
                        d.description,
                        coalesce(?, '') AS content_text,
                        coalesce(string_agg(DISTINCT t.name, ', '), '') AS tag_text,
                        coalesce(c.name, '') AS category_name,
                        coalesce(dep.name, '') AS department_name
                    FROM documents d
                    LEFT JOIN document_tags dt ON dt.document_id = d.id
                    LEFT JOIN tags t ON t.id = dt.tag_id AND t.deleted_at IS NULL
                    LEFT JOIN categories c ON c.id = d.category_id
                    LEFT JOIN departments dep ON dep.id = d.department_id
                    WHERE d.id = ?
                    GROUP BY d.id, c.name, dep.name
                )
                INSERT INTO document_search_index (
                    document_id,
                    search_vector,
                    title_text,
                    description_text,
                    content_text,
                    document_code_text,
                    tag_text,
                    category_name,
                    department_name,
                    refreshed_at
                )
                SELECT
                    document_id,
                    setweight(to_tsvector('simple', unaccent(coalesce(document_code, ''))), 'A') ||
                    setweight(to_tsvector('simple', unaccent(coalesce(title, ''))), 'A') ||
                    setweight(to_tsvector('simple', unaccent(coalesce(tag_text, ''))), 'B') ||
                    setweight(to_tsvector('simple', unaccent(coalesce(description, ''))), 'C') ||
                    setweight(to_tsvector('simple', unaccent(coalesce(content_text, ''))), 'D'),
                    title,
                    description,
                    content_text,
                    document_code,
                    tag_text,
                    category_name,
                    department_name,
                    now()
                FROM source
                ON CONFLICT (document_id) DO UPDATE SET
                    search_vector = EXCLUDED.search_vector,
                    title_text = EXCLUDED.title_text,
                    description_text = EXCLUDED.description_text,
                    content_text = EXCLUDED.content_text,
                    document_code_text = EXCLUDED.document_code_text,
                    tag_text = EXCLUDED.tag_text,
                    category_name = EXCLUDED.category_name,
                    department_name = EXCLUDED.department_name,
                    refreshed_at = now()
                """,
                extractedText,
                document.getId()
        );
    }
}
