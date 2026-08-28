ALTER TABLE access_logs ADD COLUMN IF NOT EXISTS version_id BIGINT REFERENCES document_versions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_access_logs_version_date ON access_logs(version_id, created_at);
