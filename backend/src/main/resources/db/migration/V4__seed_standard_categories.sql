DO $$ 
DECLARE 
    hr_id BIGINT;
    fin_id BIGINT;
    leg_id BIGINT;
    it_id BIGINT;
    sal_id BIGINT;
    adm_id BIGINT;
BEGIN
    -- Chỉ insert dữ liệu mẫu nếu bảng categories đang trống
    IF NOT EXISTS (SELECT 1 FROM categories LIMIT 1) THEN

        -- 1. Human Resources (Nhân sự)
        INSERT INTO categories (name, slug, description, icon, sort_order)
        VALUES ('Nhân sự', 'nhan-su', 'Tài liệu liên quan đến tuyển dụng, chính sách nhân sự và hồ sơ nhân viên', 'Users', 10)
        RETURNING id INTO hr_id;
        
        INSERT INTO categories (parent_id, name, slug, description, icon, sort_order) VALUES 
        (hr_id, 'Chính sách', 'chinh-sach-nhan-su', 'Các quy định và chính sách nhân sự', 'Book', 1),
        (hr_id, 'Hồ sơ nhân viên', 'ho-so-nhan-vien', 'Hồ sơ và thông tin cá nhân', 'Folder', 2),
        (hr_id, 'Tuyển dụng', 'tuyen-dung', 'Tài liệu và hồ sơ ứng viên', 'Briefcase', 3);

        -- 2. Finance (Tài chính Kế toán)
        INSERT INTO categories (name, slug, description, icon, sort_order)
        VALUES ('Tài chính Kế toán', 'tai-chinh-ke-toan', 'Tài liệu tài chính, kế toán và thuế', 'DollarSign', 20)
        RETURNING id INTO fin_id;

        INSERT INTO categories (parent_id, name, slug, description, icon, sort_order) VALUES 
        (fin_id, 'Hóa đơn', 'hoa-don', 'Hóa đơn mua vào bán ra', 'FileText', 1),
        (fin_id, 'Chứng từ thuế', 'chung-tu-thue', 'Hồ sơ và báo cáo thuế', 'FileArchive', 2),
        (fin_id, 'Báo cáo tài chính', 'bao-cao-tai-chinh', 'Báo cáo tài chính nội bộ và kiểm toán', 'PieChart', 3);

        -- 3. Legal (Pháp chế)
        INSERT INTO categories (name, slug, description, icon, sort_order)
        VALUES ('Pháp chế', 'phap-che', 'Hồ sơ pháp lý và hợp đồng doanh nghiệp', 'Scale', 30)
        RETURNING id INTO leg_id;

        INSERT INTO categories (parent_id, name, slug, description, icon, sort_order) VALUES 
        (leg_id, 'Hợp đồng', 'hop-dong', 'Hợp đồng kinh tế và dịch vụ', 'PenTool', 1),
        (leg_id, 'Giấy phép', 'giay-phep', 'Giấy phép kinh doanh, đầu tư', 'Award', 2);

        -- 4. IT (Công nghệ thông tin)
        INSERT INTO categories (name, slug, description, icon, sort_order)
        VALUES ('Công nghệ thông tin', 'cong-nghe-thong-tin', 'Tài liệu hệ thống và hạ tầng IT', 'Monitor', 40)
        RETURNING id INTO it_id;

        INSERT INTO categories (parent_id, name, slug, description, icon, sort_order) VALUES 
        (it_id, 'Tài liệu hệ thống', 'tai-lieu-he-thong', 'Hướng dẫn kỹ thuật và kiến trúc', 'Server', 1),
        (it_id, 'Chính sách bảo mật', 'chinh-sach-bao-mat', 'Quy định an toàn thông tin', 'Shield', 2);

        -- 5. Sales & Marketing (Kinh doanh & Tiếp thị)
        INSERT INTO categories (name, slug, description, icon, sort_order)
        VALUES ('Kinh doanh & Tiếp thị', 'kinh-doanh-tiep-thi', 'Tài liệu bán hàng, truyền thông và marketing', 'TrendingUp', 50)
        RETURNING id INTO sal_id;

        INSERT INTO categories (parent_id, name, slug, description, icon, sort_order) VALUES 
        (sal_id, 'Hồ sơ năng lực', 'ho-so-nang-luc', 'Company profile, brochure giới thiệu', 'Star', 1),
        (sal_id, 'Hợp đồng khách hàng', 'hop-dong-khach-hang', 'Các hợp đồng ký với đối tác, khách hàng', 'FileText', 2);

        -- 6. Administration (Hành chính)
        INSERT INTO categories (name, slug, description, icon, sort_order)
        VALUES ('Hành chính', 'hanh-chinh', 'Công văn, thông báo và giấy tờ nội bộ', 'Inbox', 60)
        RETURNING id INTO adm_id;

        INSERT INTO categories (parent_id, name, slug, description, icon, sort_order) VALUES 
        (adm_id, 'Công văn đến', 'cong-van-den', 'Các công văn từ đối tác/cơ quan', 'ArrowDownCircle', 1),
        (adm_id, 'Công văn đi', 'cong-van-di', 'Công văn phát hành nội bộ ra ngoài', 'ArrowUpCircle', 2),
        (adm_id, 'Thông báo', 'thong-bao', 'Thông báo, quyết định nội bộ', 'Bell', 3);

    END IF;
END $$;
