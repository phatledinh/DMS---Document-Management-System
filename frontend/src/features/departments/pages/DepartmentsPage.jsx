import {
  AppstoreOutlined,
  BellOutlined,
  DeleteOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  HistoryOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  SearchOutlined,
  SecurityScanOutlined,
  SettingOutlined,
  ShopOutlined,
  TagsOutlined,
  TeamOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import styles from './DepartmentsPage.module.css';

const navItems = [
  { label: 'Dashboard', icon: <AppstoreOutlined /> },
  { label: 'Documents', icon: <FileTextOutlined /> },
  { label: 'Categories', icon: <FolderOpenOutlined /> },
  { label: 'Departments', icon: <ShopOutlined />, active: true },
  { label: 'Tags', icon: <TagsOutlined /> },
  { label: 'Users', icon: <TeamOutlined /> },
  { label: 'Audit Logs', icon: <HistoryOutlined /> },
];

const departments = [
  { id: 1, name: 'Phòng Kỹ thuật', code: 'DEPT-TECH', description: 'Quản lý hạ tầng và phát triển phần mềm' },
  { id: 2, name: 'Phòng Nhân sự', code: 'DEPT-HR', description: 'Quản lý nhân sự và tuyển dụng, đào tạo' },
  { id: 3, name: 'Phòng Kế toán', code: 'DEPT-ACC', description: 'Quản lý tài chính, kế toán và thuế' },
  { id: 4, name: 'Ban Giám đốc', code: 'DEPT-BOD', description: 'Ban lãnh đạo công ty' },
];

export default function DepartmentsPage() {
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brandBlock}>
          <div className={styles.brandMark}><SecurityScanOutlined /></div>
          <div>
            <h1>Deep Trust DMS</h1>
            <p>Enterprise DMS</p>
          </div>
        </div>

        <nav className={styles.navList}>
          {navItems.map((item) => (
            <a key={item.label} className={item.active ? styles.navItemActive : styles.navItem} href="#">
              {item.icon}
              <span>{item.label}</span>
            </a>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <button className={styles.uploadButton} type="button"><UploadOutlined />Upload Document</button>
        </div>
      </aside>

      <main className={styles.mainArea}>
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <strong>DocuTrust Admin</strong>
            <label className={styles.searchBox}>
              <SearchOutlined />
              <input placeholder="Search departments..." type="text" />
            </label>
          </div>
          <div className={styles.topbarActions}>
            <button type="button"><BellOutlined /></button>
            <button type="button"><QuestionCircleOutlined /></button>
            <button type="button"><SettingOutlined /></button>
            <div className={styles.avatar}>A</div>
          </div>
        </header>

        <div className={styles.canvas}>
          <div className={styles.container}>
            <section className={styles.pageHeader}>
              <div>
                <h1>Quản lý phòng ban</h1>
                <p>Quản lý danh sách các phòng ban và bộ phận trong tổ chức.</p>
              </div>
              <button className={styles.primaryButton} type="button"><PlusOutlined />Thêm phòng ban</button>
            </section>

            <section className={styles.tablePanel}>
              <div className={styles.tableScroller}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Tên phòng ban</th>
                      <th>Mã phòng</th>
                      <th>Mô tả</th>
                      <th>Trạng thái</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {departments.map((department) => (
                      <tr key={department.code}>
                        <td>{department.id}</td>
                        <td><strong>{department.name}</strong></td>
                        <td className={styles.codeCell}>{department.code}</td>
                        <td className={styles.descriptionCell}>{department.description}</td>
                        <td><span className={styles.statusBadge}><span />Active</span></td>
                        <td>
                          <div className={styles.rowActions}>
                            <button title="Edit" type="button"><SettingOutlined /></button>
                            <button title="Delete" type="button"><DeleteOutlined /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <footer className={styles.pagination}>
                <span>Showing 1 to 4 of 4 entries</span>
                <div>
                  <button type="button" disabled>‹</button>
                  <button className={styles.currentPage} type="button">1</button>
                  <button type="button" disabled>›</button>
                </div>
              </footer>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
