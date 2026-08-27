package com.dms.document.processing;

import com.dms.document.entity.Document;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.images.builder.ImageFromDockerfile;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.nio.file.Paths;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Testcontainers
class VietnameseFtsIntegrationTest {

    @Container
    static GenericContainer<?> postgres = new GenericContainer<>(
            new ImageFromDockerfile("dms-postgres-test", false)
                    .withFileFromPath(".", Paths.get("../database"))
    )
    .withEnv("POSTGRES_DB", "dms")
    .withEnv("POSTGRES_USER", "postgres")
    .withEnv("POSTGRES_PASSWORD", "123456")
    .withExposedPorts(5432);

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> String.format("jdbc:postgresql://%s:%d/dms", postgres.getHost(), postgres.getFirstMappedPort()));
        registry.add("spring.datasource.username", () -> "postgres");
        registry.add("spring.datasource.password", () -> "123456");
    }

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private PostgresSearchEngine searchEngine;

    @Test
    void testVietnameseDictionaryIsConfigured() {
        // Verify catalog exists
        Integer count = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM pg_ts_config WHERE cfgname = 'vietnamese'", Integer.class);
        assertThat(count).isEqualTo(1);
    }

    @Test
    void testToTsvectorIgnoresStopWords() {
        // Query unaccented text to see if 'va', 'cua' are removed. We use unaccent function here because the unaccent mapping happens inside the vietnamese configuration, but we pass raw text to it.
        String vector = jdbcTemplate.queryForObject(
                "SELECT to_tsvector('vietnamese', 'Quy chế và quy định của công ty')::text", String.class);
        
        assertThat(vector).doesNotContain("'va'");
        assertThat(vector).doesNotContain("'cua'");
        assertThat(vector).contains("'cong'");
        assertThat(vector).contains("'ty'");
    }

    @Test
    void testWebsearchToTsqueryIgnoresStopWords() {
        String tsquery = jdbcTemplate.queryForObject(
                "SELECT websearch_to_tsquery('vietnamese', 'quy chế và')::text", String.class);
        
        assertThat(tsquery).doesNotContain("'va'");
        assertThat(tsquery).contains("'quy'");
        assertThat(tsquery).contains("'che'");
    }

    @Test
    void testRefreshIndexDoesNotContainStopWords() {
        // Create a dummy document
        jdbcTemplate.update("INSERT INTO documents (id, title, document_code, status, slug) VALUES (9999, 'Tài liệu và báo cáo của tôi', 'DOC-9999', 'INDEXED', 'doc-9999')");
        // Refresh index
        Document doc = new Document();
        doc.setId(9999L);
        searchEngine.refreshIndex(doc, "Nội dung và phân tích của báo cáo");

        // Fetch the vector
        String vector = jdbcTemplate.queryForObject(
                "SELECT search_vector::text FROM document_search_index WHERE document_id = 9999", String.class);

        assertThat(vector).doesNotContain("'va'");
        assertThat(vector).doesNotContain("'cua'");
        assertThat(vector).contains("'tai'");
        assertThat(vector).contains("'lieu'");

        // Cleanup
        jdbcTemplate.update("DELETE FROM document_search_index WHERE document_id = 9999");
        jdbcTemplate.update("DELETE FROM documents WHERE id = 9999");
    }
}
