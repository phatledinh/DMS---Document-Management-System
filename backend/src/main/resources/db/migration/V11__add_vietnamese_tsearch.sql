-- Create a new text search dictionary using the 'simple' template but with our vietnamese stop words
CREATE TEXT SEARCH DICTIONARY vietnamese_simple (
    TEMPLATE = pg_catalog.simple,
    STOPWORDS = vietnamese
);

-- Create a new text search configuration based on 'simple'
CREATE TEXT SEARCH CONFIGURATION vietnamese (COPY = simple);

-- Change the mapping to pass text through 'unaccent' first, then 'vietnamese_simple' dictionary
ALTER TEXT SEARCH CONFIGURATION vietnamese
    ALTER MAPPING FOR asciiword, word, hword, hword_part
    WITH unaccent, vietnamese_simple;

-- Backfill existing index to use vietnamese configuration
WITH source AS (
    SELECT
        d.id AS document_id,
        d.document_code,
        d.title,
        d.description,
        si.content_text,
        coalesce(string_agg(DISTINCT t.name, ', '), '') AS tag_text
    FROM documents d
    JOIN document_search_index si ON si.document_id = d.id
    LEFT JOIN document_tags dt ON dt.document_id = d.id
    LEFT JOIN tags t ON t.id = dt.tag_id AND t.deleted_at IS NULL
    GROUP BY d.id, d.document_code, d.title, d.description, si.content_text
)
UPDATE document_search_index idx
SET search_vector = (
    setweight(to_tsvector('vietnamese', coalesce(s.document_code, '')), 'A') ||
    setweight(to_tsvector('vietnamese', coalesce(s.title, '')), 'A') ||
    setweight(to_tsvector('vietnamese', coalesce(s.tag_text, '')), 'B') ||
    setweight(to_tsvector('vietnamese', coalesce(s.description, '')), 'C') ||
    setweight(to_tsvector('vietnamese', coalesce(s.content_text, '')), 'D')
)
FROM source s
WHERE idx.document_id = s.document_id;
