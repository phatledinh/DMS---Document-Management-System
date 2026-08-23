CREATE TABLE IF NOT EXISTS user_departments (
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    department_id BIGINT NOT NULL REFERENCES departments(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, department_id)
);

CREATE INDEX IF NOT EXISTS idx_user_departments_department_user
    ON user_departments (department_id, user_id);

INSERT INTO user_departments (user_id, department_id)
SELECT id, department_id
FROM users
WHERE department_id IS NOT NULL
ON CONFLICT (user_id, department_id) DO NOTHING;
