import {
  AppstoreOutlined,
  BellOutlined,
  DownOutlined,
  FileTextOutlined,
  FolderAddOutlined,
  FolderOpenFilled,
  HistoryOutlined,
  MoreOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  SearchOutlined,
  SettingOutlined,
  ShopOutlined,
  TagsOutlined,
  TeamOutlined,
  UpOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import styles from './CategoriesPage.module.css';

const navItems = [
  { label: 'Dashboard', icon: <AppstoreOutlined /> },
  { label: 'Documents', icon: <FileTextOutlined /> },
  { label: 'Categories', icon: <FolderOpenFilled />, active: true },
  { label: 'Departments', icon: <ShopOutlined /> },
  { label: 'Tags', icon: <TagsOutlined /> },
  { label: 'Users', icon: <TeamOutlined /> },
  { label: 'Audit Logs', icon: <HistoryOutlined /> },
];

const categoryTree = [
  {
    name: 'Quy trình ISO',
    count: '25 tài liệu',
    expanded: true,
    children: [
      { name: 'ISO 9001 - Chất lượng', count: '10' },
      { name: 'ISO 14001 - Môi trường', count: '8', selected: true },
      { name: 'ISO 45001 - An toàn', count: '7' },
    ],
  },
  {
    name: 'Biểu mẫu',
    count: '50 tài liệu',
    expanded: true,
    children: [
      { name: 'Biểu mẫu nhân sự', count: '20' },
      { name: 'Biểu mẫu kế toán', count: '15' },
      { name: 'Biểu mẫu kỹ thuật', count: '15' },
    ],
  },
  { name: 'SOP', count: '30 tài liệu' },
  { name: 'Hướng dẫn', count: '20 tài liệu' },
];

function TreeNode({ item, isLast }) {
  return (
    <div className={`${styles.treeNode} ${isLast ? styles.lastNode : ''}`}>
      <div className={styles.nodeRow}>
        <div className={styles.nodeMain}>
          {item.expanded ? <DownOutlined className={styles.chevron} /> : <span className={styles.chevronPlaceholder}>›</span>}
          <FolderOpenFilled className={item.selected ? styles.folderPrimary : styles.folderIcon} />
          <strong>{item.name}</strong>
          <span>({item.count})</span>
        </div>
        <div className={styles.nodeActions}>
          <button type="button"><PlusOutlined /></button>
          <button type="button"><MoreOutlined /></button>
        </div>
      </div>
      {item.children && (
        <div className={styles.children}>
          {item.children.map((child, index) => (
            <div key={child.name} className={`${styles.childRow} ${child.selected ? styles.childSelected : ''}`}>
              <div className={styles.childConnector} />
              <span className={styles.childChevron}>›</span>
              <FolderOpenFilled className={child.selected ? styles.folderPrimary : styles.folderMuted} />
              <span className={child.selected ? styles.childSelectedText : undefined}>{child.name}</span>
              <small>({child.count})</small>
              <button type="button"><MoreOutlined /></button>
              {index === item.children.length - 1 && <div className={styles.lastChildMask} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CategoriesPage() {
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brandBlock}>
          <div className={styles.brandMark}>D</div>
          <div>
            <h1>DocuTrust Admin</h1>
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
          <strong>DocuTrust DMS</strong>
          <div className={styles.topbarActions}>
            <label className={styles.searchBox}>
              <SearchOutlined />
              <input placeholder="Search..." type="text" />
            </label>
            <button type="button"><BellOutlined /><span className={styles.notificationDot} /></button>
            <button type="button"><QuestionCircleOutlined /></button>
            <button type="button"><AppstoreOutlined /></button>
            <div className={styles.avatar}>A</div>
          </div>
        </header>

        <div className={styles.canvas}>
          <div className={styles.container}>
            <section className={styles.pageHeader}>
              <div>
                <h2>QUẢN LÝ DANH MỤC</h2>
                <p>Quản lý cấu trúc và phân loại tài liệu trong hệ thống.</p>
              </div>
              <button className={styles.primaryButton} type="button"><PlusOutlined />Thêm mới</button>
            </section>

            <section className={styles.treePanel}>
              <div className={styles.treeHeader}>
                <h3>Cấu trúc danh mục</h3>
                <div>
                  <button title="Mở rộng tất cả" type="button"><DownOutlined /></button>
                  <button title="Thu gọn tất cả" type="button"><UpOutlined /></button>
                </div>
              </div>
              <div className={styles.treeContent}>
                {categoryTree.map((item, index) => (
                  <TreeNode key={item.name} item={item} isLast={index === categoryTree.length - 1} />
                ))}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
