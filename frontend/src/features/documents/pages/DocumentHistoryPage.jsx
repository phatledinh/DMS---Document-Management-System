import {
  AppstoreOutlined,
  BellOutlined,
  CheckCircleOutlined,
  DownloadOutlined,
  EyeOutlined,
  FileTextOutlined,
  FilterOutlined,
  FolderOpenOutlined,
  HistoryOutlined,
  QuestionCircleOutlined,
  ReloadOutlined,
  SearchOutlined,
  SecurityScanOutlined,
  SettingOutlined,
  ShopOutlined,
  StarFilled,
  TagsOutlined,
  TeamOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import styles from './DocumentHistoryPage.module.css';

const navItems = [
  { label: 'Dashboard', icon: <AppstoreOutlined /> },
  { label: 'Documents', icon: <FileTextOutlined />, active: true },
  { label: 'Categories', icon: <FolderOpenOutlined /> },
  { label: 'Departments', icon: <ShopOutlined /> },
  { label: 'Tags', icon: <TagsOutlined /> },
  { label: 'Users', icon: <TeamOutlined /> },
  { label: 'Audit Logs', icon: <HistoryOutlined /> },
];

const versions = [
  {
    version: 'v1.2',
    current: true,
    uploader: 'Admin User',
    initials: 'AD',
    avatarTone: 'tertiary',
    uploadedAt: '24 Oct 2023, 14:30',
    note: 'Updated section 4.2 compliance standards based on Q3 review.',
  },
  {
    version: 'v1.1',
    uploader: 'John Smith',
    initials: 'JS',
    avatarTone: 'secondary',
    uploadedAt: '15 Sep 2023, 09:15',
    note: 'Minor typo fixes in appendix.',
  },
  {
    version: 'v1.0',
    uploader: 'Admin User',
    initials: 'AD',
    avatarTone: 'tertiary',
    uploadedAt: '01 Jan 2023, 10:00',
    note: 'Initial document creation and upload.',
  },
];

export default function DocumentHistoryPage() {
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brandBlock}>
          <div className={styles.brandMark}><SecurityScanOutlined /></div>
          <div>
            <h1>Deep Trust Admin</h1>
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
          <a className={styles.navItem} href="#"><QuestionCircleOutlined /><span>Help Center</span></a>
        </div>
      </aside>

      <main className={styles.mainArea}>
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <strong>Deep Trust</strong>
            <label className={styles.searchBox}>
              <SearchOutlined />
              <input placeholder="Search documents..." type="text" />
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
            <nav className={styles.breadcrumbs}>
              <a href="#">Home</a><span>›</span><a href="#">Admin</a><span>›</span><a href="#">Documents</a><span>›</span><strong>Lịch sử phiên bản</strong>
            </nav>

            <section className={styles.documentHeader}>
              <div>
                <div className={styles.badgeRow}>
                  <span className={styles.codeBadge}>SOP-QA-001</span>
                  <span className={styles.activeBadge}><CheckCircleOutlined />Active</span>
                </div>
                <h2>ISO 9001 - QA Process</h2>
                <p>Lịch sử phiên bản</p>
              </div>
              <button className={styles.primaryButton} type="button"><UploadOutlined />Tải lên phiên bản mới</button>
            </section>

            <section className={styles.filterBar}>
              <label className={styles.versionSearch}>
                <SearchOutlined />
                <input placeholder="Tìm kiếm phiên bản hoặc người tải lên..." type="text" />
              </label>
              <button className={styles.filterButton} type="button"><FilterOutlined />Lọc</button>
            </section>

            <section className={styles.tablePanel}>
              <div className={styles.tableScroller}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Phiên bản</th>
                      <th>Người tải lên</th>
                      <th>Ngày tải lên</th>
                      <th>Ghi chú thay đổi</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {versions.map((item) => (
                      <tr key={item.version} className={item.current ? styles.currentRow : undefined}>
                        <td>
                          <div className={styles.versionCell}>
                            <strong>{item.version}</strong>
                            {item.current && <span><StarFilled />Hiện tại</span>}
                          </div>
                        </td>
                        <td>
                          <div className={styles.userCell}>
                            <span className={item.avatarTone === 'secondary' ? styles.secondaryAvatar : styles.tertiaryAvatar}>{item.initials}</span>
                            <span>{item.uploader}</span>
                          </div>
                        </td>
                        <td className={styles.mutedCell}>{item.uploadedAt}</td>
                        <td className={styles.noteCell}>{item.note}</td>
                        <td>
                          <div className={styles.actionsCell}>
                            <button title="Download" type="button"><DownloadOutlined /></button>
                            {!item.current && <button className={styles.restoreButton} title="Khôi phục" type="button"><ReloadOutlined /></button>}
                            <button title="View Details" type="button"><EyeOutlined /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
