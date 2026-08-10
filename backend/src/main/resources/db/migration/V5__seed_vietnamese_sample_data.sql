DO $$
DECLARE
    admin_user_id BIGINT;
BEGIN
    IF EXISTS (SELECT 1 FROM documents WHERE document_code LIKE 'VN-DMS-%') THEN
        RETURN;
    END IF;

    INSERT INTO departments (name, code, description)
    VALUES
        ('Ban Giám đốc', 'BGD', 'Điều hành chiến lược, phê duyệt chủ trương và quản trị doanh nghiệp'),
        ('Nhân sự', 'NS', 'Quản lý tuyển dụng, hồ sơ nhân viên, chế độ và chính sách lao động'),
        ('Tài chính Kế toán', 'TCKT', 'Quản lý ngân sách, kế toán, hóa đơn, thuế và báo cáo tài chính'),
        ('Pháp chế', 'PC', 'Quản lý hợp đồng, hồ sơ pháp lý, tuân thủ và tư vấn pháp luật'),
        ('Công nghệ thông tin', 'CNTT', 'Quản trị hệ thống, bảo mật thông tin và hỗ trợ kỹ thuật'),
        ('Kinh doanh', 'KD', 'Quản lý khách hàng, cơ hội bán hàng, hợp đồng và doanh thu'),
        ('Marketing', 'MKT', 'Quản lý truyền thông, thương hiệu, chiến dịch và tài liệu quảng bá'),
        ('Hành chính', 'HC', 'Quản lý công văn, văn phòng phẩm, tài sản và điều phối nội bộ'),
        ('Vận hành', 'VH', 'Quản lý quy trình vận hành, kế hoạch triển khai và chất lượng dịch vụ'),
        ('Mua hàng', 'MH', 'Quản lý yêu cầu mua sắm, nhà cung cấp, báo giá và đơn hàng'),
        ('Kho vận', 'KV', 'Quản lý tồn kho, giao nhận, vận chuyển và chứng từ kho'),
        ('Chăm sóc khách hàng', 'CSKH', 'Quản lý yêu cầu hỗ trợ, phản hồi và hồ sơ khách hàng'),
        ('Kiểm soát nội bộ', 'KSNB', 'Kiểm tra tuân thủ, đánh giá rủi ro và kiểm soát quy trình'),
        ('Quản lý chất lượng', 'QLCL', 'Quản lý tiêu chuẩn, biểu mẫu, đánh giá và cải tiến chất lượng'),
        ('Nghiên cứu phát triển', 'RND', 'Quản lý ý tưởng, nghiên cứu sản phẩm và tài liệu thử nghiệm')
    ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        is_active = true,
        updated_at = CURRENT_TIMESTAMP;

    INSERT INTO categories (name, slug, description, icon, sort_order)
    VALUES
        ('Quy trình', 'quy-trinh', 'Quy trình làm việc, hướng dẫn vận hành và biểu mẫu thực hiện', 'Workflow', 70),
        ('Biểu mẫu', 'bieu-mau', 'Các biểu mẫu nội bộ dùng trong vận hành và quản trị', 'ClipboardList', 80),
        ('Dự án', 'du-an', 'Hồ sơ dự án, kế hoạch triển khai và biên bản nghiệm thu', 'FolderKanban', 90),
        ('Báo cáo quản trị', 'bao-cao-quan-tri', 'Báo cáo điều hành, báo cáo quản trị và phân tích nội bộ', 'BarChart', 100)
    ON CONFLICT (slug) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        icon = EXCLUDED.icon,
        sort_order = EXCLUDED.sort_order,
        is_active = true,
        updated_at = CURRENT_TIMESTAMP;

    INSERT INTO tags (name, slug)
    VALUES
        ('Nội bộ', 'noi-bo'),
        ('Bảo mật', 'bao-mat'),
        ('Công khai', 'cong-khai'),
        ('Hợp đồng', 'hop-dong'),
        ('Hóa đơn', 'hoa-don'),
        ('Báo cáo', 'bao-cao'),
        ('Quy trình', 'quy-trinh'),
        ('Biểu mẫu', 'bieu-mau'),
        ('Nhân sự', 'nhan-su'),
        ('Tài chính', 'tai-chinh'),
        ('Pháp lý', 'phap-ly'),
        ('Công nghệ', 'cong-nghe'),
        ('Khách hàng', 'khach-hang'),
        ('Nhà cung cấp', 'nha-cung-cap'),
        ('Dự án', 'du-an'),
        ('Kiểm toán', 'kiem-toan'),
        ('Thuế', 'thue'),
        ('Lương thưởng', 'luong-thuong'),
        ('Tuyển dụng', 'tuyen-dung'),
        ('Đào tạo', 'dao-tao'),
        ('Chiến dịch', 'chien-dich'),
        ('Marketing', 'marketing'),
        ('Bán hàng', 'ban-hang'),
        ('Chăm sóc khách hàng', 'cham-soc-khach-hang'),
        ('Mua sắm', 'mua-sam'),
        ('Kho vận', 'kho-van'),
        ('Vận hành', 'van-hanh'),
        ('Chất lượng', 'chat-luong'),
        ('Rủi ro', 'rui-ro'),
        ('Tuân thủ', 'tuan-thu'),
        ('Phê duyệt', 'phe-duyet'),
        ('Khẩn cấp', 'khan-cap'),
        ('Lưu trữ', 'luu-tru'),
        ('Phiên bản mới', 'phien-ban-moi'),
        ('Đã ký', 'da-ky'),
        ('Dự thảo', 'du-thao'),
        ('Quan trọng', 'quan-trong'),
        ('Theo dõi', 'theo-doi'),
        ('Quý 1', 'quy-1'),
        ('Quý 2', 'quy-2')
    ON CONFLICT (slug) DO UPDATE SET
        name = EXCLUDED.name,
        updated_at = CURRENT_TIMESTAMP;

    SELECT id INTO admin_user_id FROM users WHERE email = 'admin@dms.com' LIMIT 1;

    UPDATE users
    SET department_id = (SELECT id FROM departments WHERE code = 'BGD'), updated_at = CURRENT_TIMESTAMP
    WHERE email = 'admin@dms.com' AND department_id IS NULL;

    INSERT INTO users (name, email, password, phone, avatar, role, department_id, status, last_login)
    SELECT user_data.name,
           user_data.email,
           '$2a$10$5OjzLbScdSUHVRtoDBaXduV9BNJGHLIerPPkjED0sMFvn7V7WEHk.',
           user_data.phone,
           user_data.avatar,
           user_data.role,
           departments.id,
           'ACTIVE',
           CURRENT_TIMESTAMP - ((user_data.ordinal % 12) || ' days')::INTERVAL
    FROM (VALUES
        (1, 'Nguyễn Minh Anh', 'nguyen.minh.anh@dms.local', '0901000001', 'USER', 'NS', 'avatars/nguyen-minh-anh.png'),
        (2, 'Trần Quốc Bảo', 'tran.quoc.bao@dms.local', '0901000002', 'USER', 'TCKT', 'avatars/tran-quoc-bao.png'),
        (3, 'Lê Hoàng Chi', 'le.hoang.chi@dms.local', '0901000003', 'USER', 'PC', 'avatars/le-hoang-chi.png'),
        (4, 'Phạm Gia Huy', 'pham.gia.huy@dms.local', '0901000004', 'USER', 'CNTT', 'avatars/pham-gia-huy.png'),
        (5, 'Võ Thanh Hà', 'vo.thanh.ha@dms.local', '0901000005', 'USER', 'KD', 'avatars/vo-thanh-ha.png'),
        (6, 'Đặng Ngọc Linh', 'dang.ngoc.linh@dms.local', '0901000006', 'USER', 'MKT', 'avatars/dang-ngoc-linh.png'),
        (7, 'Bùi Đức Long', 'bui.duc.long@dms.local', '0901000007', 'USER', 'HC', 'avatars/bui-duc-long.png'),
        (8, 'Hoàng Mai Phương', 'hoang.mai.phuong@dms.local', '0901000008', 'USER', 'VH', 'avatars/hoang-mai-phuong.png'),
        (9, 'Đỗ Hải Nam', 'do.hai.nam@dms.local', '0901000009', 'USER', 'MH', 'avatars/do-hai-nam.png'),
        (10, 'Ngô Thu Trang', 'ngo.thu.trang@dms.local', '0901000010', 'USER', 'KV', 'avatars/ngo-thu-trang.png'),
        (11, 'Dương Khánh Vy', 'duong.khanh.vy@dms.local', '0901000011', 'USER', 'CSKH', 'avatars/duong-khanh-vy.png'),
        (12, 'Hồ Việt Dũng', 'ho.viet.dung@dms.local', '0901000012', 'USER', 'KSNB', 'avatars/ho-viet-dung.png'),
        (13, 'Lý Thanh Tâm', 'ly.thanh.tam@dms.local', '0901000013', 'USER', 'QLCL', 'avatars/ly-thanh-tam.png'),
        (14, 'Mai Anh Tuấn', 'mai.anh.tuan@dms.local', '0901000014', 'USER', 'RND', 'avatars/mai-anh-tuan.png'),
        (15, 'Phan Ngọc Ánh', 'phan.ngoc.anh@dms.local', '0901000015', 'USER', 'BGD', 'avatars/phan-ngoc-anh.png'),
        (16, 'Vũ Thành Công', 'vu.thanh.cong@dms.local', '0901000016', 'USER', 'NS', 'avatars/vu-thanh-cong.png'),
        (17, 'Nguyễn Thảo My', 'nguyen.thao.my@dms.local', '0901000017', 'USER', 'TCKT', 'avatars/nguyen-thao-my.png'),
        (18, 'Trần Nhật Minh', 'tran.nhat.minh@dms.local', '0901000018', 'USER', 'PC', 'avatars/tran-nhat-minh.png'),
        (19, 'Lê Bảo Ngọc', 'le.bao.ngoc@dms.local', '0901000019', 'USER', 'CNTT', 'avatars/le-bao-ngoc.png'),
        (20, 'Phạm Hải Yến', 'pham.hai.yen@dms.local', '0901000020', 'USER', 'KD', 'avatars/pham-hai-yen.png'),
        (21, 'Võ Minh Khang', 'vo.minh.khang@dms.local', '0901000021', 'USER', 'MKT', 'avatars/vo-minh-khang.png'),
        (22, 'Đặng Thu Hà', 'dang.thu.ha@dms.local', '0901000022', 'USER', 'HC', 'avatars/dang-thu-ha.png'),
        (23, 'Bùi Quang Hưng', 'bui.quang.hung@dms.local', '0901000023', 'USER', 'VH', 'avatars/bui-quang-hung.png'),
        (24, 'Hoàng Ngọc Mai', 'hoang.ngoc.mai@dms.local', '0901000024', 'USER', 'MH', 'avatars/hoang-ngoc-mai.png'),
        (25, 'Đỗ Minh Châu', 'do.minh.chau@dms.local', '0901000025', 'USER', 'KV', 'avatars/do-minh-chau.png'),
        (26, 'Ngô Đức Anh', 'ngo.duc.anh@dms.local', '0901000026', 'USER', 'CSKH', 'avatars/ngo-duc-anh.png'),
        (27, 'Dương Bích Ngọc', 'duong.bich.ngoc@dms.local', '0901000027', 'USER', 'KSNB', 'avatars/duong-bich-ngoc.png'),
        (28, 'Hồ Minh Quân', 'ho.minh.quan@dms.local', '0901000028', 'USER', 'QLCL', 'avatars/ho-minh-quan.png'),
        (29, 'Lý Gia Bảo', 'ly.gia.bao@dms.local', '0901000029', 'USER', 'RND', 'avatars/ly-gia-bao.png')
    ) AS user_data(ordinal, name, email, phone, role, department_code, avatar)
    JOIN departments ON departments.code = user_data.department_code
    ON CONFLICT (email) DO UPDATE SET
        name = EXCLUDED.name,
        phone = EXCLUDED.phone,
        avatar = EXCLUDED.avatar,
        role = EXCLUDED.role,
        department_id = EXCLUDED.department_id,
        status = 'ACTIVE',
        updated_at = CURRENT_TIMESTAMP;

    WITH category_pool AS (
        SELECT id, row_number() OVER (ORDER BY sort_order, id) AS rn, count(*) OVER () AS cnt
        FROM categories
        WHERE deleted_at IS NULL AND is_active = true
    ),
    department_pool AS (
        SELECT id, row_number() OVER (ORDER BY code) AS rn, count(*) OVER () AS cnt
        FROM departments
        WHERE deleted_at IS NULL AND is_active = true
    ),
    user_pool AS (
        SELECT id, row_number() OVER (ORDER BY id) AS rn, count(*) OVER () AS cnt
        FROM users
        WHERE deleted_at IS NULL AND status = 'ACTIVE'
    ),
    source AS (
        SELECT gs AS n,
               format('VN-DMS-%s', lpad(gs::TEXT, 4, '0')) AS document_code,
               CASE (gs - 1) % 20
                   WHEN 0 THEN 'Quy trình phê duyệt hợp đồng dịch vụ'
                   WHEN 1 THEN 'Báo cáo tài chính nội bộ tháng'
                   WHEN 2 THEN 'Biên bản họp giao ban điều hành'
                   WHEN 3 THEN 'Hồ sơ năng lực nhà cung cấp'
                   WHEN 4 THEN 'Kế hoạch tuyển dụng nhân sự'
                   WHEN 5 THEN 'Chính sách bảo mật thông tin'
                   WHEN 6 THEN 'Hướng dẫn sử dụng hệ thống DMS'
                   WHEN 7 THEN 'Phiếu đề nghị mua sắm thiết bị'
                   WHEN 8 THEN 'Báo cáo kết quả chiến dịch marketing'
                   WHEN 9 THEN 'Hợp đồng nguyên tắc với khách hàng'
                   WHEN 10 THEN 'Quy định quản lý tài sản văn phòng'
                   WHEN 11 THEN 'Kế hoạch triển khai dự án chuyển đổi số'
                   WHEN 12 THEN 'Bảng tổng hợp phản hồi khách hàng'
                   WHEN 13 THEN 'Hồ sơ đánh giá rủi ro vận hành'
                   WHEN 14 THEN 'Tài liệu đào tạo nhân viên mới'
                   WHEN 15 THEN 'Quy trình kiểm soát chất lượng dịch vụ'
                   WHEN 16 THEN 'Báo cáo tồn kho và giao nhận'
                   WHEN 17 THEN 'Công văn thông báo chính sách mới'
                   WHEN 18 THEN 'Đề xuất cải tiến sản phẩm'
                   ELSE 'Kế hoạch ngân sách phòng ban'
               END AS base_title,
               CASE (gs - 1) % 5
                   WHEN 0 THEN 'pdf'
                   WHEN 1 THEN 'docx'
                   WHEN 2 THEN 'xlsx'
                   WHEN 3 THEN 'pptx'
                   ELSE 'pdf'
               END AS file_ext
        FROM generate_series(1, 250) AS gs
    ),
    prepared AS (
        SELECT source.n,
               source.document_code,
               format('%s %s', source.base_title, lpad(source.n::TEXT, 3, '0')) AS title,
               format('tai-lieu-mau-%s', lpad(source.n::TEXT, 4, '0')) AS slug,
               format('Tài liệu mẫu số %s phục vụ kiểm thử chức năng quản lý, tìm kiếm, phân quyền và lưu trữ hồ sơ trong hệ thống DMS.', source.n) AS description,
               source.file_ext,
               CASE source.file_ext
                   WHEN 'pdf' THEN 'application/pdf'
                   WHEN 'docx' THEN 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                   WHEN 'xlsx' THEN 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                   WHEN 'pptx' THEN 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
               END AS mime_type,
               CASE source.file_ext
                   WHEN 'pdf' THEN 'PDF'
                   WHEN 'docx' THEN 'DOCX'
                   WHEN 'xlsx' THEN 'XLSX'
                   WHEN 'pptx' THEN 'PPTX'
               END AS file_type,
               120000 + (source.n * 17321) % 4500000 AS file_size,
               1 + (source.n % 80) AS page_count,
               CASE WHEN source.n % 17 = 0 THEN 'ARCHIVED' WHEN source.n % 13 = 0 THEN 'PROCESSING' ELSE 'INDEXED' END AS status,
               CASE WHEN source.n % 4 = 0 THEN 'RESTRICTED' ELSE 'PUBLIC' END AS access_level,
               CURRENT_DATE - ((source.n % 540) || ' days')::INTERVAL AS effective_date,
               CASE WHEN source.n % 11 = 0 THEN CURRENT_DATE + ((180 + source.n % 365) || ' days')::INTERVAL ELSE NULL END AS expiry_date,
               source.base_title
        FROM source
    )
    INSERT INTO documents (
        title, slug, description, category_id, department_id, uploaded_by, owner_id,
        file_name, file_type, mime_type, file_size, storage_path, thumbnail_path,
        preview_object_key, page_count, document_code, version_number, status,
        access_level, view_count, download_count, effective_date, expiry_date, archived_at, updated_at
    )
    SELECT prepared.title,
           prepared.slug,
           prepared.description,
           category_pool.id,
           department_pool.id,
           uploader.id,
           owner_user.id,
           format('%s.%s', prepared.slug, prepared.file_ext),
           prepared.file_type,
           prepared.mime_type,
           prepared.file_size,
           format('seed/documents/%s.%s', prepared.document_code, prepared.file_ext),
           CASE WHEN prepared.file_ext = 'pdf' THEN format('seed/thumbnails/%s.png', prepared.document_code) ELSE NULL END,
           format('seed/previews/%s.pdf', prepared.document_code),
           prepared.page_count,
           prepared.document_code,
           '1.0',
           prepared.status,
           prepared.access_level,
           (prepared.n * 7) % 950,
           (prepared.n * 3) % 260,
           prepared.effective_date::DATE,
           prepared.expiry_date::DATE,
           CASE WHEN prepared.status = 'ARCHIVED' THEN CURRENT_TIMESTAMP - ((prepared.n % 90) || ' days')::INTERVAL ELSE NULL END,
           CURRENT_TIMESTAMP
    FROM prepared
    JOIN category_pool ON category_pool.rn = ((prepared.n - 1) % category_pool.cnt) + 1
    JOIN department_pool ON department_pool.rn = ((prepared.n - 1) % department_pool.cnt) + 1
    JOIN user_pool uploader ON uploader.rn = ((prepared.n - 1) % uploader.cnt) + 1
    JOIN user_pool owner_user ON owner_user.rn = ((prepared.n + 7) % owner_user.cnt) + 1
    ON CONFLICT (slug) DO NOTHING;

    INSERT INTO document_versions (document_id, version_number, file_name, file_size, mime_type, storage_path, status, preview_object_key, changelog, uploaded_by)
    SELECT documents.id,
           documents.version_number,
           documents.file_name,
           documents.file_size,
           documents.mime_type,
           documents.storage_path,
           documents.status,
           documents.preview_object_key,
           'Phiên bản khởi tạo từ dữ liệu mẫu',
           documents.uploaded_by
    FROM documents
    WHERE documents.document_code LIKE 'VN-DMS-%'
    ON CONFLICT (document_id, version_number) DO NOTHING;

    INSERT INTO document_contents (document_id, extracted_text, extraction_method, language, extraction_status, retry_count, extracted_at)
    SELECT documents.id,
           format('%s. %s Nội dung được trích xuất phục vụ kiểm thử tìm kiếm toàn văn, lọc theo phòng ban, danh mục, thẻ và phân quyền truy cập. Mã tài liệu: %s.', documents.title, documents.description, documents.document_code),
           'SEEDED',
           'vi',
           'SUCCESS',
           0,
           CURRENT_TIMESTAMP
    FROM documents
    WHERE documents.document_code LIKE 'VN-DMS-%'
    ON CONFLICT (document_id) DO NOTHING;

    WITH seeded_documents AS (
        SELECT id, row_number() OVER (ORDER BY document_code) AS rn
        FROM documents
        WHERE document_code LIKE 'VN-DMS-%'
    ),
    tag_pool AS (
        SELECT id, row_number() OVER (ORDER BY slug) AS rn, count(*) OVER () AS cnt
        FROM tags
        WHERE deleted_at IS NULL
    ),
    assignments AS (
        SELECT seeded_documents.id AS document_id,
               tag_pool.id AS tag_id
        FROM seeded_documents
        JOIN generate_series(0, 4) AS offsets(offset_value) ON offsets.offset_value < 2 + (seeded_documents.rn % 4)
        JOIN tag_pool ON tag_pool.rn = ((seeded_documents.rn + offsets.offset_value * 7 - 1) % tag_pool.cnt) + 1
    )
    INSERT INTO document_tags (document_id, tag_id)
    SELECT DISTINCT document_id, tag_id
    FROM assignments
    ON CONFLICT (document_id, tag_id) DO NOTHING;

    INSERT INTO document_search_index (
        document_id, search_vector, title_text, description_text, content_text,
        document_code_text, tag_text, category_name, department_name, refreshed_at
    )
    SELECT documents.id,
           to_tsvector('simple', concat_ws(' ', documents.title, documents.description, document_contents.extracted_text, documents.document_code, string_agg(tags.name, ' '), categories.name, departments.name)),
           documents.title,
           documents.description,
           document_contents.extracted_text,
           documents.document_code,
           string_agg(tags.name, ', ' ORDER BY tags.name),
           categories.name,
           departments.name,
           CURRENT_TIMESTAMP
    FROM documents
    JOIN categories ON categories.id = documents.category_id
    LEFT JOIN departments ON departments.id = documents.department_id
    LEFT JOIN document_contents ON document_contents.document_id = documents.id
    LEFT JOIN document_tags ON document_tags.document_id = documents.id
    LEFT JOIN tags ON tags.id = document_tags.tag_id
    WHERE documents.document_code LIKE 'VN-DMS-%'
    GROUP BY documents.id, document_contents.extracted_text, categories.name, departments.name
    ON CONFLICT (document_id) DO UPDATE SET
        search_vector = EXCLUDED.search_vector,
        title_text = EXCLUDED.title_text,
        description_text = EXCLUDED.description_text,
        content_text = EXCLUDED.content_text,
        document_code_text = EXCLUDED.document_code_text,
        tag_text = EXCLUDED.tag_text,
        category_name = EXCLUDED.category_name,
        department_name = EXCLUDED.department_name,
        refreshed_at = CURRENT_TIMESTAMP;

    IF admin_user_id IS NOT NULL THEN
        INSERT INTO audit_logs (actor_id, action, target_type, target_id, new_value, ip_address, user_agent)
        SELECT admin_user_id,
               'SEED_SAMPLE_DATA',
               'DOCUMENT',
               documents.id,
               jsonb_build_object('documentCode', documents.document_code, 'title', documents.title),
               '127.0.0.1',
               'Flyway Seed Migration'
        FROM documents
        WHERE documents.document_code LIKE 'VN-DMS-%' AND (documents.id % 25 = 0);
    END IF;
END $$;
