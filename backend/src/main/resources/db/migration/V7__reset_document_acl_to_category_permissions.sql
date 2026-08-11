DROP TABLE IF EXISTS document_department_accesses;
DROP TABLE IF EXISTS document_user_accesses;

DROP INDEX IF EXISTS idx_documents_access_level;

ALTER TABLE documents DROP COLUMN IF EXISTS access_level;

CREATE TABLE category_department_permissions (
    category_id BIGINT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    department_id BIGINT NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    permission VARCHAR(30) NOT NULL,
    granted_by BIGINT NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (category_id, department_id, permission),
    CONSTRAINT chk_category_department_permission CHECK (permission IN ('VIEW', 'UPLOAD', 'DOWNLOAD', 'EDIT', 'DELETE'))
);

CREATE INDEX idx_cat_dept_perm_department ON category_department_permissions(department_id, category_id, permission);
CREATE INDEX idx_cat_dept_perm_category ON category_department_permissions(category_id, department_id);
