DO $$
DECLARE
    admin_user_id BIGINT;
BEGIN
    SELECT id INTO admin_user_id
    FROM users
    WHERE role = 'ADMIN' AND deleted_at IS NULL
    ORDER BY id
    LIMIT 1;

    IF admin_user_id IS NULL THEN
        RETURN;
    END IF;

    INSERT INTO category_department_permissions (category_id, department_id, permission, granted_by)
    SELECT c.id, d.id, permission.value, admin_user_id
    FROM categories c
    JOIN departments d ON d.deleted_at IS NULL AND d.is_active = true
    CROSS JOIN (VALUES ('VIEW'), ('DOWNLOAD')) AS permission(value)
    WHERE c.deleted_at IS NULL
      AND c.is_active = true
    ON CONFLICT (category_id, department_id, permission) DO NOTHING;

    INSERT INTO category_department_permissions (category_id, department_id, permission, granted_by)
    SELECT c.id, d.id, permission.value, admin_user_id
    FROM categories c
    JOIN departments d ON d.deleted_at IS NULL AND d.is_active = true
    CROSS JOIN (VALUES ('UPLOAD'), ('EDIT'), ('DELETE')) AS permission(value)
    WHERE c.deleted_at IS NULL
      AND c.is_active = true
      AND (
          (d.code = 'NS' AND c.slug IN ('nhan-su', 'chinh-sach-nhan-su', 'ho-so-nhan-vien', 'tuyen-dung', 'bieu-mau'))
          OR (d.code = 'TCKT' AND c.slug IN ('tai-chinh-ke-toan', 'hoa-don', 'chung-tu-thue', 'bao-cao-tai-chinh', 'bao-cao-quan-tri'))
          OR (d.code = 'PC' AND c.slug IN ('phap-che', 'hop-dong', 'giay-phep'))
          OR (d.code = 'CNTT' AND c.slug IN ('cong-nghe-thong-tin', 'tai-lieu-he-thong', 'chinh-sach-bao-mat'))
          OR (d.code IN ('KD', 'MKT') AND c.slug IN ('kinh-doanh-tiep-thi', 'ho-so-nang-luc', 'hop-dong-khach-hang'))
          OR (d.code = 'HC' AND c.slug IN ('hanh-chinh', 'cong-van-den', 'cong-van-di', 'thong-bao'))
          OR (d.code IN ('VH', 'QLCL') AND c.slug IN ('quy-trinh', 'bieu-mau'))
          OR (d.code = 'BGD' AND c.slug IN ('bao-cao-quan-tri', 'du-an'))
      )
    ON CONFLICT (category_id, department_id, permission) DO NOTHING;
END $$;
