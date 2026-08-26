package com.dms.document.repository;

public final class DocumentAclSqlFragments {
    public static final String USER_VISIBLE_PREDICATE = """
            d.status = 'INDEXED'
            AND d.permanently_deleted_at IS NULL
            AND EXISTS (
                SELECT 1
                FROM category_department_permissions cdp
                WHERE cdp.category_id = {alias}.category_id
                  AND cdp.permission = 'VIEW'
                  AND cdp.department_id IN (
                      SELECT department_id FROM user_departments WHERE user_id = :currentUserId
                      UNION
                      SELECT department_id FROM users WHERE id = :currentUserId AND department_id IS NOT NULL
                  )
            )
            """;

    public static final String ADMIN_VISIBLE_PREDICATE = "d.status <> 'DELETED' AND d.permanently_deleted_at IS NULL";

    public static final String ADMIN_PREVIEW_DOWNLOAD_PREDICATE = "d.status IN ('INDEXED', 'ARCHIVED') AND d.permanently_deleted_at IS NULL";

    public static final String USER_VISIBLE_OWN_PREDICATE = """
            d.permanently_deleted_at IS NULL
            AND d.status NOT IN ('DELETED', 'ARCHIVED')
            AND (
                (d.status = 'INDEXED' AND EXISTS (
                    SELECT 1
                    FROM category_department_permissions cdp
                    WHERE cdp.category_id = {alias}.category_id
                      AND cdp.permission = 'VIEW'
                      AND cdp.department_id IN (
                          SELECT department_id FROM user_departments WHERE user_id = :currentUserId
                          UNION
                          SELECT department_id FROM users WHERE id = :currentUserId AND department_id IS NOT NULL
                      )
                ))
                OR d.uploaded_by = :currentUserId
            )
            """;

    private DocumentAclSqlFragments() {
    }
}
