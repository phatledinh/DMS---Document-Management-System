import { useMemo, useState } from 'react';
import {
  AppstoreOutlined,
  BellOutlined,
  CalendarOutlined,
  DeleteOutlined,
  FileExcelOutlined,
  FileImageOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  HistoryOutlined,
  QuestionCircleOutlined,
  SearchOutlined,
  SettingOutlined,
  ShopOutlined,
  TagsOutlined,
  TeamOutlined,
  UndoOutlined,
  UploadOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import styles from './DocumentTrashPage.module.css';

const navItems = [
  { label: 'Dashboard', icon: <AppstoreOutlined /> },
  { label: 'Documents', icon: <FileTextOutlined /> },
  { label: 'Categories', icon: <FolderOpenOutlined /> },
  { label: 'Departments', icon: <ShopOutlined /> },
  { label: 'Tags', icon: <TagsOutlined /> },
  { label: 'Users', icon: <TeamOutlined /> },
  { label: 'Audit Logs', icon: <HistoryOutlined /> },
  { label: 'Trash', icon: <DeleteOutlined />, active: true },
];

const trashDocuments = [
  {
    id: 1,
    title: 'Hop_dong_thue_nha.pdf',
    category: 'Pháp lý',
    deletedBy: 'Nguyen Van A',
    deletedAt: '10/10/2023',
    deadline: 'Còn 15 ngày',
    urgency: 'warning',
    fileType: 'pdf',
  },
  {
    id: 2,
    title: 'Bao_cao_marketing_2022.xlsx',
    category: 'Marketing',
    deletedBy: 'Tran Thi B',
    deletedAt: '12/10/2023',
    deadline: 'Còn 28 ngày',
    urgency: 'safe',
    fileType: 'sheet',
  },
  {
    id: 3,
    title: 'Hinh_anh_su_kien.jpg',
    category: 'Truyền thông',
    deletedBy: 'Le Van C',
    deletedAt: '20/09/2023',
    deadline: 'Còn 2 ngày',
    urgency: 'danger',
    fileType: 'image',
  },
];

function FileIcon({ type }) {
  if (type === 'pdf') return <FilePdfOutlined className={styles.fileIconPdf} />;
  if (type === 'sheet') return <FileExcelOutlined className={styles.fileIconSheet} />;
  if (type === 'image') return <FileImageOutlined className={styles.fileIconImage} />;
  return <FileTextOutlined className={styles.fileIconDoc} />;
}

function DeadlineBadge({ urgency, label }) {
  const className = {
    safe: styles.deadlineSafe,
    warning: styles.deadlineWarning,
    danger: styles.deadlineDanger,
  }[urgency];

  return (
    <span className={className}>
      {urgency === 'danger' ? <WarningOutlined /> : <CalendarOutlined />}
      {label}
    </span>
  );
}

export default function DocumentTrashPage() {
  const [selectedRows, setSelectedRows] = useState([]);

  const allSelected = selectedRows.length === trashDocuments.length;
  const batchClassName = selectedRows.length > 0 ? styles.batchBar : styles.batchBarHidden;

  const rows = useMemo(
    () => trashDocuments.map((doc) => ({ ...doc, selected: selectedRows.includes(doc.id) })),
    [selectedRows]
  );

  function toggleAllRows() {
    setSelectedRows(allSelected ? [] : trashDocuments.map((doc) => doc.id));
  }

  function toggleRow(rowId) {
    setSelectedRows((current) => current.includes(rowId) ? current.filter((id) => id !== rowId) : [...current, rowId]);
  }

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brandBlock}>
          <div className={styles.brandMark}>DT</div>
          <div>
            <h1>Deep Trust Admin</h1>
            <p>Enterprise DMS</p>
          </div>
        </div>

        <button className={styles.primaryButton} type="button"><UploadOutlined />Upload Document</button>

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

      <div className={styles.mainArea}>
        <header className={styles.topbar}>
          <div className={styles.topbarBrand}>DocuTrust DMS</div>
          <div className={styles.topbarActions}>
            <label className={styles.quickSearch}>
              <SearchOutlined />
              <input placeholder="Tìm kiếm nhanh..." type="text" />
            </label>
            <button className={styles.iconButton} type="button"><BellOutlined /><span className={styles.notificationDot} /></button>
            <button className={styles.iconButton} type="button"><QuestionCircleOutlined /></button>
            <button className={styles.iconButton} type="button"><AppstoreOutlined /></button>
            <div className={styles.avatar}>A</div>
          </div>
        </header>

        <main className={styles.content}>
          <div className={styles.container}>
            <section className={styles.pageHeader}>
              <div>
                <h2>THÙNG RÁC TÀI LIỆU</h2>
                <p>Quản lý tài liệu đã xóa tạm thời. Tài liệu sẽ tự động xóa vĩnh viễn sau 30 ngày.</p>
              </div>
            </section>

            <section className={styles.filterPanel}>
              <div className={styles.filterGrid}>
                <label className={styles.searchField}>
                  <SearchOutlined />
                  <input placeholder="Tìm theo tên/mã..." type="text" />
                </label>
                <label className={styles.selectField}>
                  <select defaultValue=""><option value="">Danh mục</option><option>Hợp đồng</option><option>Báo cáo</option><option>Truyền thông</option></select>
                </label>
                <label className={styles.selectField}>
                  <select defaultValue=""><option value="">Loại file</option><option>PDF</option><option>Excel</option><option>Ảnh</option></select>
                </label>
                <label className={styles.dateField}>
                  <CalendarOutlined />
                  <input type="date" />
                </label>
              </div>
            </section>

            <div className={batchClassName}>
              <div className={styles.batchInfo}><span className={styles.batchCount}>{selectedRows.length}</span><span>tài liệu được chọn</span></div>
              <div className={styles.batchActions}>
                <button className={styles.batchAction} type="button"><UndoOutlined />Khôi phục</button>
                <button className={styles.deleteAction} type="button"><DeleteOutlined />Xóa vĩnh viễn</button>
              </div>
            </div>

            <section className={styles.tablePanel}>
              <div className={styles.tableScroller}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th className={styles.centerCell}><input checked={allSelected} onChange={toggleAllRows} type="checkbox" /></th>
                      <th>Tài liệu</th>
                      <th>Danh mục</th>
                      <th>Người xóa</th>
                      <th>Ngày xóa</th>
                      <th>Hạn chót</th>
                      <th className={styles.rightCell}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((doc) => (
                      <tr key={doc.id}>
                        <td className={styles.centerCell}><input checked={doc.selected} onChange={() => toggleRow(doc.id)} type="checkbox" /></td>
                        <td><div className={styles.documentTitle}><FileIcon type={doc.fileType} /><span title={doc.title}>{doc.title}</span></div></td>
                        <td>{doc.category}</td>
                        <td>{doc.deletedBy}</td>
                        <td>{doc.deletedAt}</td>
                        <td><DeadlineBadge urgency={doc.urgency} label={doc.deadline} /></td>
                        <td>
                          <div className={styles.rowActions}>
                            <button title="Khôi phục" type="button"><UndoOutlined /></button>
                            <button className={styles.rowDangerAction} title="Xóa vĩnh viễn" type="button"><DeleteOutlined /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className={styles.pagination}>
                <div className={styles.paginationText}>Hiển thị <strong>1-3</strong> của <strong>24</strong> tài liệu</div>
                <div className={styles.pageControls}>
                  <button className={styles.navPageButton} type="button" disabled>‹</button>
                  <button className={styles.currentPage} type="button">1</button>
                  <button className={styles.pageButton} type="button">2</button>
                  <button className={styles.pageButton} type="button">3</button>
                  <button className={styles.navPageButton} type="button">›</button>
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
