CREATE TABLE category_user_permissions (
    category_id BIGINT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission VARCHAR(30) NOT NULL,
    granted_by BIGINT NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (category_id, user_id, permission),
    CONSTRAINT chk_category_user_permission CHECK (permission IN ('VIEW', 'UPLOAD', 'DOWNLOAD', 'EDIT', 'DELETE'))
);

CREATE INDEX idx_cat_user_perm_user ON category_user_permissions(user_id, category_id, permission);
CREATE INDEX idx_cat_user_perm_category ON category_user_permissions(category_id, user_id);
