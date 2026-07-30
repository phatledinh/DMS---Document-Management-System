package com.dms.document.repository;

public final class DocumentAclSqlFragments {
    public static final String USER_VISIBLE_PREDICATE = """
            d.status = 'INDEXED'
            AND (
                d.access_level = 'PUBLIC'
                OR d.owner_id = :currentUserId
                OR EXISTS (
                    SELECT 1
                    FROM document_department_accesses dda
                    WHERE dda.document_id = d.id
                      AND dda.department_id = :userDepartmentId
                )
                OR EXISTS (
                    SELECT 1
                    FROM document_user_accesses dua
                    WHERE dua.document_id = d.id
                      AND dua.user_id = :currentUserId
                )
            )
            """;

    public static final String ADMIN_VISIBLE_PREDICATE = "d.status = 'INDEXED'";

    public static final String ADMIN_PREVIEW_DOWNLOAD_PREDICATE = "d.status IN ('INDEXED', 'ARCHIVED')";

    private DocumentAclSqlFragments() {
    }
}
