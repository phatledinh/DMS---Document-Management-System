ALTER TABLE documents
ADD COLUMN current_version_id BIGINT REFERENCES document_versions(id),
ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
