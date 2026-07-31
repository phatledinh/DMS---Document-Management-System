import {
  AppstoreOutlined,
  BellOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  HistoryOutlined,
  LockOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  SearchOutlined,
  SettingOutlined,
  ShopOutlined,
  TagsOutlined,
  TeamOutlined,
  UnlockOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import styles from './UsersPage.module.css';

const navItems = [
  { label: 'Dashboard', icon: <AppstoreOutlined /> },
  { label: 'Documents', icon: <FileTextOutlined /> },
  { label: 'Categories', icon: <FolderOpenOutlined /> },
  { label: 'Departments', icon: <ShopOutlined /> },
  { label: 'Tags', icon: <TagsOutlined /> },
  { label: 'Users', icon: <TeamOutlined />, active: true },
  { label: 'Audit Logs', icon: <HistoryOutlined /> },
];

const users = [
  {
    id: 1,
    initials: 'NA',
    name: 'Nguyễn Văn A',
    email: 'a@co.com',
    phone: '0901234567',
    department: 'Kỹ thuật',
    role: 'ADMIN',
    active: true,
    cccd: '012345678901',
    address: 'Hà Nội, Việt Nam',
    nationality: 'Việt Nam',
    ethnicity: 'Kinh',
    religion: 'Không',
    bank: 'Vietcombank',
    account: '123456789',
    tone: 'primary',
  },
  {
    id: 2,
    initials: 'TB',
    name: 'Trần Thị B',
    email: 'b@co.com',
    phone: '0912345678',
    department: 'Nhân sự',
    role: 'USER',
    active: true,
    cccd: '034567890123',
    address: 'TP. HCM, Việt Nam',
    nationality: 'Việt Nam',
    ethnicity: 'Kinh',
    religion: 'Không',
    bank: 'TPBank',
    account: '987654321',
    tone: 'tertiary',
  },
  {
    id: 3,
    initials: 'LC',
    name: 'Lê Văn C',
    email: 'c@co.com',
    phone: '0923456789',
    department: 'Kế toán',
    role: 'USER',
    active: false,
    cccd: '056789012345',
    address: 'Đà Nẵng, Việt Nam',
    nationality: 'Việt Nam',
    ethnicity: 'Kinh',
    religion: 'Phật giáo',
    bank: 'BIDV',
    account: '456789123',
    tone: 'secondary',
  },
];

export default function UsersPage() {
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brandBlock}>
          <TeamOutlined className={styles.brandIcon} />
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
      </aside>

      <main className={styles.mainArea}>
        <header className={styles.topbar}>
          <label className={styles.searchBox}>
            <SearchOutlined />
            <input placeholder="Search system..." type="text" />
          </label>
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
                <h2>QUẢN LÝ USERS</h2>
                <p>Quản lý danh sách người dùng và phân quyền truy cập trong hệ thống.</p>
              </div>
              <button className={styles.primaryButton} type="button"><PlusOutlined />Thêm người dùng</button>
            </section>

            <section className={styles.filterPanel}>
              <label className={styles.filterSearch}>
                <SearchOutlined />
                <input placeholder="Tìm kiếm theo tên, email, sđt..." type="text" />
              </label>
              <div className={styles.filtersGrid}>
                <select defaultValue=""><option value="">Tất cả Vai trò</option><option>Admin</option><option>User</option></select>
                <select defaultValue=""><option value="">Tất cả Phòng ban</option><option>IT</option><option>Nhân sự</option><option>Kế toán</option><option>Kỹ thuật</option></select>
                <select defaultValue=""><option value="">Tất cả Trạng thái</option><option>Hoạt động</option><option>Bị khóa</option></select>
              </div>
            </section>

            <section className={styles.tablePanel}>
              <div className={styles.tableScroller}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Họ tên</th>
                      <th>Email</th>
                      <th>Số điện thoại</th>
                      <th>Phòng ban</th>
                      <th>Vai trò</th>
                      <th>Trạng thái</th>
                      <th>CCCD</th>
                      <th>Địa chỉ</th>
                      <th>Quốc tịch</th>
                      <th>Dân tộc</th>
                      <th>Tôn giáo</th>
                      <th>Ngân hàng</th>
                      <th>Số tài khoản</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.email}>
                        <td>{user.id}</td>
                        <td>
                          <div className={styles.userCell}>
                            <span className={`${styles.userAvatar} ${styles[user.tone]}`}>{user.initials}</span>
                            <strong>{user.name}</strong>
                          </div>
                        </td>
                        <td>{user.email}</td>
                        <td className={styles.monoCell}>{user.phone}</td>
                        <td>{user.department}</td>
                        <td><span className={user.role === 'ADMIN' ? styles.adminRole : styles.userRole}>{user.role}</span></td>
                        <td><span className={user.active ? styles.activeStatus : styles.inactiveStatus}>{user.active ? <CheckCircleOutlined /> : '×'}{user.active ? 'Active' : 'Inactive'}</span></td>
                        <td>{user.cccd}</td>
                        <td>{user.address}</td>
                        <td>{user.nationality}</td>
                        <td>{user.ethnicity}</td>
                        <td>{user.religion}</td>
                        <td>{user.bank}</td>
                        <td className={styles.monoCell}>{user.account}</td>
                        <td>
                          <div className={styles.rowActions}>
                            <button title="Sửa" type="button"><EditOutlined /></button>
                            <button title={user.active ? 'Khóa' : 'Mở khóa'} type="button">{user.active ? <LockOutlined /> : <UnlockOutlined />}</button>
                            <button title="Xóa" type="button"><DeleteOutlined /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <footer className={styles.pagination}>
                <span>Hiển thị <strong>1</strong> đến <strong>3</strong> trong <strong>24</strong> người dùng</span>
                <div>
                  <button type="button">‹</button>
                  <button className={styles.currentPage} type="button">1</button>
                  <button type="button">2</button>
                  <button type="button">3</button>
                  <span>...</span>
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
