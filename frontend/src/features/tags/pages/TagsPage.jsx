import {
  AppstoreOutlined,
  BellOutlined,
  DeleteOutlined,
  EditOutlined,
  FileTextOutlined,
  FilterOutlined,
  FolderOpenOutlined,
  HistoryOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  SearchOutlined,
  SettingOutlined,
  ShopOutlined,
  TagsOutlined,
  TeamOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import styles from './TagsPage.module.css';

const navItems = [
  { label: 'Dashboard', icon: <AppstoreOutlined /> },
  { label: 'Documents', icon: <FileTextOutlined /> },
  { label: 'Categories', icon: <FolderOpenOutlined /> },
  { label: 'Departments', icon: <ShopOutlined /> },
  { label: 'Tags', icon: <TagsOutlined />, active: true },
  { label: 'Users', icon: <TeamOutlined /> },
  { label: 'Audit Logs', icon: <HistoryOutlined /> },
];

const tags = [
  { id: 1, name: 'ISO 9001', slug: 'iso-9001', count: 142, createdAt: '12/10/2023', tone: 'primary', icon: <TagsOutlined /> },
  { id: 2, name: 'Quy Trình', slug: 'quy-trinh', count: 85, createdAt: '15/10/2023', tone: 'success', icon: <AppstoreOutlined /> },
  { id: 3, name: 'Kỹ Thuật', slug: 'ky-thuat', count: 210, createdAt: '18/10/2023', tone: 'tertiary', icon: <SettingOutlined /> },
  { id: 4, name: 'Nhân Sự', slug: 'nhan-su', count: 56, createdAt: '20/10/2023', tone: 'warning', icon: <TeamOutlined /> },
  { id: 5, name: 'Quan Trọng', slug: 'quan-trong', count: 24, createdAt: '22/10/2023', tone: 'danger', icon: <PlusOutlined /> },
];

export default function TagsPage() {
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brandBlock}>
          <div className={styles.brandMark}>DT</div>
          <div>
            <h1>Deep Trust</h1>
            <p>Enterprise DMS</p>
          </div>
        </div>

        <button className={styles.uploadButton} type="button"><UploadOutlined />Upload Document</button>

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
          <a className={styles.navItem} href="#"><QuestionCircleOutlined /><span>Support</span></a>
        </div>
      </aside>

      <main className={styles.mainArea}>
        <header className={styles.topbar}>
          <label className={styles.searchBox}>
            <SearchOutlined />
            <input placeholder="Search documents, tags..." type="text" />
          </label>
          <div className={styles.topbarActions}>
            <button type="button"><BellOutlined /><span className={styles.notificationDot} /></button>
            <button type="button"><QuestionCircleOutlined /></button>
            <button type="button"><SettingOutlined /></button>
            <div className={styles.avatar}>A</div>
          </div>
        </header>

        <div className={styles.canvas}>
          <div className={styles.container}>
            <section className={styles.pageHeader}>
              <div>
                <h2>QUẢN LÝ TAGS</h2>
                <p>Quản lý danh sách các thẻ phân loại tài liệu trong hệ thống.</p>
              </div>
              <button className={styles.primaryButton} type="button"><PlusOutlined />Thêm tag mới</button>
            </section>

            <section className={styles.tablePanel}>
              <div className={styles.toolbar}>
                <label className={styles.filterBox}>
                  <FilterOutlined />
                  <input placeholder="Lọc theo tên hoặc slug..." type="text" />
                </label>
                <div className={styles.pageSize}>Hiển thị:<select defaultValue="10"><option>10</option><option>20</option><option>50</option></select><span>/ trang</span></div>
              </div>

              <div className={styles.tableScroller}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Tên Tag</th>
                      <th>Slug</th>
                      <th>Số Tài Liệu</th>
                      <th>Ngày Tạo</th>
                      <th>Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tags.map((tag) => (
                      <tr key={tag.slug}>
                        <td>{tag.id}</td>
                        <td><span className={`${styles.tagPill} ${styles[tag.tone]}`}>{tag.icon}{tag.name}</span></td>
                        <td className={styles.slugCell}>{tag.slug}</td>
                        <td className={styles.countCell}><span>{tag.count}</span></td>
                        <td className={styles.dateCell}>{tag.createdAt}</td>
                        <td>
                          <div className={styles.rowActions}>
                            <button title="Chỉnh sửa" type="button"><EditOutlined /></button>
                            <button title="Xóa" type="button"><DeleteOutlined /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <footer className={styles.pagination}>
                <span>Hiển thị 1-5 trong số 24 tags</span>
                <div>
                  <button type="button" disabled>‹</button>
                  <button className={styles.currentPage} type="button">1</button>
                  <button type="button">2</button>
                  <button type="button">3</button>
                  <span>...</span>
                  <button type="button">5</button>
                  <button type="button">›</button>
                </div>
              </footer>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
