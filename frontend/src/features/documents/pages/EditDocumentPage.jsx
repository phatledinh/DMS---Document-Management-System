import {
  AppstoreOutlined,
  BellOutlined,
  CalendarOutlined,
  CloseOutlined,
  DownOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  GlobalOutlined,
  HistoryOutlined,
  LockOutlined,
  QuestionCircleOutlined,
  SaveOutlined,
  SecurityScanOutlined,
  SettingOutlined,
  ShopOutlined,
  TagsOutlined,
  TeamOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import styles from './EditDocumentPage.module.css';

const navItems = [
  { label: 'Dashboard', icon: <AppstoreOutlined /> },
  { label: 'Documents', icon: <FileTextOutlined />, active: true },
  { label: 'Categories', icon: <FolderOpenOutlined /> },
  { label: 'Departments', icon: <ShopOutlined /> },
  { label: 'Tags', icon: <TagsOutlined /> },
  { label: 'Users', icon: <TeamOutlined /> },
  { label: 'Audit Logs', icon: <HistoryOutlined /> },
];

export default function EditDocumentPage() {
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brandBlock}>
          <div className={styles.brandMark}>D</div>
          <div>
            <h1>Deep Trust Admin</h1>
            <p>Enterprise DMS</p>
          </div>
        </div>

        <button className={styles.sidebarUploadButton} type="button"><UploadOutlined />Upload Document</button>

        <nav className={styles.navList}>
          {navItems.map((item) => (
            <a key={item.label} className={item.active ? styles.navItemActive : styles.navItem} href="#">
              {item.icon}
              <span>{item.label}</span>
            </a>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <a className={styles.navItem} href="#"><SettingOutlined /><span>Settings</span></a>
          <a className={styles.navItem} href="#"><QuestionCircleOutlined /><span>Help Center</span></a>
        </div>
      </aside>

      <main className={styles.mainArea}>
        <header className={styles.topbar}>
          <nav className={styles.breadcrumbs}>
            <a href="#">Home</a><span>›</span><a href="#">Admin</a><span>›</span><a href="#">Documents</a><span>›</span><strong>Edit Document</strong>
          </nav>
          <div className={styles.topbarActions}>
            <button className={styles.iconButton} type="button"><BellOutlined /></button>
            <button className={styles.iconButton} type="button"><QuestionCircleOutlined /></button>
            <div className={styles.profileButton}><span className={styles.avatar}>A</span><span>Admin</span><DownOutlined /></div>
          </div>
        </header>

        <div className={styles.canvas}>
          <div className={styles.container}>
            <div className={styles.pageHeader}>
              <h2>Chỉnh sửa tài liệu</h2>
              <p><FileTextOutlined />Hợp đồng dịch vụ bảo trì phần mềm 2023</p>
            </div>

            <form className={styles.formCard}>
              <section className={styles.section}>
                <h3>Thông tin cơ bản</h3>
                <div className={styles.formGrid}>
                  <label className={styles.fullField}>
                    <span>Tên tài liệu <strong>*</strong></span>
                    <input defaultValue="Hợp đồng dịch vụ bảo trì phần mềm 2023" type="text" />
                  </label>
                  <label>
                    <span>Mã tài liệu</span>
                    <input readOnly defaultValue="HD-2023-889" />
                  </label>
                  <label>
                    <span>Danh mục <strong>*</strong></span>
                    <div className={styles.selectWrap}>
                      <select defaultValue="hop-dong-kh">
                        <option value="hop-dong-kh">Hợp đồng KH</option>
                        <option value="tai-lieu-noi-bo">Tài liệu nội bộ</option>
                        <option value="bao-cao-tai-chinh">Báo cáo tài chính</option>
                      </select>
                      <DownOutlined />
                    </div>
                  </label>
                  <label className={styles.fullField}>
                    <span>Thẻ tag (Tags)</span>
                    <div className={styles.tagsInput}>
                      {['Maintenance', 'Software', '2023'].map((tag) => (
                        <span key={tag}>{tag}<button type="button"><CloseOutlined /></button></span>
                      ))}
                      <input placeholder="Thêm tag..." type="text" />
                    </div>
                  </label>
                  <label>
                    <span>Ngày hiệu lực</span>
                    <div className={styles.iconInput}><CalendarOutlined /><input defaultValue="2023-01-01" type="date" /></div>
                  </label>
                  <label>
                    <span>Ngày hết hạn</span>
                    <div className={styles.iconInput}><CalendarOutlined /><input defaultValue="2024-01-01" type="date" /></div>
                  </label>
                  <label className={styles.fullField}>
                    <span>Mô tả chi tiết</span>
                    <textarea rows={4} defaultValue="Hợp đồng dịch vụ bảo trì và nâng cấp phần mềm quản lý nội bộ năm 2023 ký với công ty đối tác." />
                  </label>
                </div>
              </section>

              <section className={`${styles.section} ${styles.aclSection}`}>
                <div className={styles.aclTitle}>
                  <SecurityScanOutlined />
                  <h3>Quyền truy cập (ACL)</h3>
                </div>

                <div className={styles.aclList}>
                  <label className={styles.aclOption}>
                    <input name="acl_level" type="radio" value="public" />
                    <div>
                      <div><strong>Công khai (PUBLIC)</strong><GlobalOutlined /></div>
                      <p>Tất cả người dùng trong hệ thống đều có thể xem tài liệu này.</p>
                    </div>
                  </label>

                  <label className={`${styles.aclOption} ${styles.aclOptionActive}`}>
                    <input defaultChecked name="acl_level" type="radio" value="department" />
                    <div>
                      <div><strong>Phòng ban (DEPARTMENT)</strong><ShopOutlined /></div>
                      <p>Chỉ những phòng ban được chọn mới có quyền truy cập.</p>
                      <div className={styles.departmentTags}>
                        <small>Chọn phòng ban được phép:</small>
                        <div>
                          <span>Phòng Pháp chế <button type="button"><CloseOutlined /></button></span>
                          <span>Ban Giám đốc <button type="button"><CloseOutlined /></button></span>
                          <input placeholder="Thêm phòng ban..." type="text" />
                        </div>
                      </div>
                    </div>
                  </label>

                  <label className={styles.aclOption}>
                    <input name="acl_level" type="radio" value="restricted" />
                    <div>
                      <div><strong>Hạn chế (RESTRICTED)</strong><LockOutlined /></div>
                      <p>Chỉ chủ sở hữu và những người dùng được chỉ định đích danh mới có quyền.</p>
                    </div>
                  </label>
                </div>
              </section>

              <footer className={styles.formFooter}>
                <button className={styles.cancelButton} type="button">Hủy</button>
                <button className={styles.saveButton} type="submit"><SaveOutlined />Lưu thay đổi</button>
              </footer>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
