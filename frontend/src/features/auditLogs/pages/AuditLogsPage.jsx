import {
  AppstoreOutlined,
  BellOutlined,
  CalendarOutlined,
  DeleteOutlined,
  EditOutlined,
  FileTextOutlined,
  FilterOutlined,
  FolderOpenOutlined,
  HistoryOutlined,
  LoginOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  SearchOutlined,
  SettingOutlined,
  ShopOutlined,
  TagsOutlined,
  TeamOutlined,
  UploadOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import styles from './AuditLogsPage.module.css';

const navItems = [
  { label: 'Dashboard', icon: <AppstoreOutlined /> },
  { label: 'Documents', icon: <FileTextOutlined /> },
  { label: 'Categories', icon: <FolderOpenOutlined /> },
  { label: 'Departments', icon: <ShopOutlined /> },
  { label: 'Tags', icon: <TagsOutlined /> },
  { label: 'Users', icon: <TeamOutlined /> },
  { label: 'Audit Logs', icon: <HistoryOutlined />, active: true },
];

const logs = [
  { id: 1, time: '21/10/2023 10:12:45', user: 'Nguyen Van A', initials: 'NA', action: 'Upload', target: 'Tài liệu:', detail: 'Quy trình ISO 9001.pdf', ip: '192.168.1.45', tone: 'upload', icon: <UploadOutlined /> },
  { id: 2, time: '21/10/2023 09:45:12', user: 'System Admin', initials: 'SA', action: 'Update', target: 'Cấu hình:', detail: 'SMTP Settings', ip: '10.0.0.12', tone: 'update', icon: <EditOutlined /> },
  { id: 3, time: '20/10/2023 16:30:00', user: 'Tran Thi B', initials: 'TB', action: 'Delete', target: 'Tài liệu:', detail: 'Báo cáo Q2_old.docx', ip: '192.168.1.102', tone: 'delete', icon: <DeleteOutlined /> },
  { id: 4, time: '20/10/2023 08:15:22', user: 'Nguyen Van A', initials: 'NA', action: 'Login', target: 'Hệ thống:', detail: 'Thành công', ip: '192.168.1.45', tone: 'login', icon: <LoginOutlined /> },
  { id: 5, time: '19/10/2023 14:20:05', user: 'System Admin', initials: 'SA', action: 'Create', target: 'User:', detail: 'Le Van C', ip: '10.0.0.12', tone: 'create', icon: <UserAddOutlined /> },
];

export default function AuditLogsPage() {
  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <div className={styles.topbarLeft}>
          <strong>Deep Trust</strong>
          <label className={styles.globalSearch}>
            <SearchOutlined />
            <input placeholder="Global search..." type="text" />
          </label>
        </div>
        <div className={styles.topbarActions}>
          <button type="button"><BellOutlined /><span className={styles.notificationDot} /></button>
          <button type="button"><QuestionCircleOutlined /></button>
          <button type="button"><SettingOutlined /></button>
          <div className={styles.avatar}>A</div>
        </div>
      </header>

      <aside className={styles.sidebar}>
        <button className={styles.uploadButton} type="button"><PlusOutlined />Upload Document</button>
        <nav className={styles.navList}>
          {navItems.map((item) => (
            <a key={item.label} className={item.active ? styles.navItemActive : styles.navItem} href="#">
              {item.icon}
              <span>{item.label}</span>
            </a>
          ))}
        </nav>
      </aside>

      <main className={styles.mainArea}>
        <div className={styles.container}>
          <section className={styles.pageHeader}>
            <h1>NHẬT KÝ HỆ THỐNG</h1>
            <p>AUDIT & ACCESS LOG</p>
          </section>

          <div className={styles.tabs}>
            <button className={styles.tabActive} type="button">Nhật ký hệ thống</button>
            <button className={styles.tab} type="button">Truy cập tài liệu</button>
            <button className={styles.tab} type="button">Lịch sử tìm kiếm</button>
          </div>

          <section className={styles.filters}>
            <div className={styles.dateGroup}>
              <CalendarOutlined />
              <input type="date" />
              <span>-</span>
              <input type="date" />
            </div>
            <select defaultValue=""><option value="">Người thực hiện</option><option>System Admin</option><option>Nguyen Van A</option></select>
            <select defaultValue=""><option value="">Hành động</option><option>Upload</option><option>Update</option><option>Delete</option><option>Login</option></select>
            <label className={styles.detailSearch}>
              <SearchOutlined />
              <input placeholder="Tìm kiếm chi tiết..." type="text" />
            </label>
            <button className={styles.filterButton} type="button"><FilterOutlined />Lọc</button>
          </section>

          <section className={styles.tablePanel}>
            <div className={styles.tableScroller}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Thời gian</th>
                    <th>Người thực hiện</th>
                    <th>Hành động</th>
                    <th>Đối tượng/Chi tiết</th>
                    <th>IP Address</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td>{log.id}</td>
                      <td className={styles.timeCell}>{log.time}</td>
                      <td><div className={styles.userCell}><span>{log.initials}</span><strong>{log.user}</strong></div></td>
                      <td><span className={`${styles.actionBadge} ${styles[log.tone]}`}>{log.icon}{log.action}</span></td>
                      <td className={styles.detailCell}>{log.target} <strong>{log.detail}</strong></td>
                      <td className={styles.timeCell}>{log.ip}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <footer className={styles.pagination}>
              <span>Showing 1 to 5 of 124 entries</span>
              <div>
                <button type="button" disabled>‹</button>
                <button className={styles.currentPage} type="button">1</button>
                <button type="button">2</button>
                <button type="button">3</button>
                <span>...</span>
                <button type="button">25</button>
                <button type="button">›</button>
              </div>
            </footer>
          </section>
        </div>
      </main>
    </div>
  );
}
