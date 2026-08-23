package com.dms.document.repository;

public final class DocumentAclSqlFragments {
    public static final String USER_VISIBLE_PREDICATE = """
            d.status = 'INDEXED'
            AND d.permanently_deleted_at IS NULL
            AND EXISTS (
                SELECT 1
                FROM user_departments ud
                JOIN category_department_permissions cdp ON cdp.department_id = ud.department_id
                WHERE ud.user_id = :currentUserId
                  AND cdp.category_id = d.category_id
                  AND cdp.permission = 'VIEW'
            )
            """;

    public static final String ADMIN_VISIBLE_PREDICATE = "d.status <> 'DELETED' AND d.permanently_deleted_at IS NULL";

    public static final String ADMIN_PREVIEW_DOWNLOAD_PREDICATE = "d.status IN ('INDEXED', 'ARCHIVED') AND d.permanently_deleted_at IS NULL";

    private DocumentAclSqlFragments() {
    }
}
