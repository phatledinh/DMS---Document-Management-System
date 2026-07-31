import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AppstoreOutlined,
  BellOutlined,
  CalendarOutlined,
  DeleteOutlined,
  DownOutlined,
  DownloadOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  FileImageOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  HistoryOutlined,
  MenuOutlined,
  MoreOutlined,
  QuestionCircleOutlined,
  ReloadOutlined,
  SearchOutlined,
  SettingOutlined,
  ShopOutlined,
  SyncOutlined,
  TagsOutlined,
  TeamOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import styles from './DocumentsPage.module.css';

const navItems = [
  { label: 'Dashboard', icon: <AppstoreOutlined /> },
  { label: 'Documents', icon: <FileTextOutlined />, active: true },
  { label: 'Categories', icon: <FolderOpenOutlined /> },
  { label: 'Departments', icon: <ShopOutlined /> },
  { label: 'Tags', icon: <TagsOutlined /> },
  { label: 'Users', icon: <TeamOutlined /> },
  { label: 'Audit Logs', icon: <HistoryOutlined /> },
];

const documents = [
  {
    id: 1,
    title: 'Hợp đồng dịch vụ bảo trì phần mềm 2023.pdf',
    code: 'HD-2023-089',
    category: 'Hợp đồng KH',
    status: 'INDEXED',
    size: '2.4 MB',
    createdAt: '12/10/2023 14:30',
    fileType: 'pdf',
  },
  {
    id: 2,
    title: 'Báo cáo tài chính quý 3_2023.docx',
    code: 'BC-TC-Q3',
    category: 'Báo cáo nội bộ',
    status: 'PROCESSING',
    size: '15.1 MB',
    createdAt: '15/10/2023 09:15',
    fileType: 'doc',
  },
  {
    id: 3,
    title: 'Scan_CMND_NguyenVanA.jpg',
    code: 'HS-NS-0012',
    category: 'Hồ sơ nhân sự',
    status: 'EXTRACTION_FAILED',
    size: '850 KB',
    createdAt: '16/10/2023 11:05',
    fileType: 'image',
  },
];

function FileIcon({ type }) {
  if (type === 'pdf') return <FilePdfOutlined className={styles.fileIconPdf} />;
  if (type === 'image') return <FileImageOutlined className={styles.fileIconImage} />;
  return <FileTextOutlined className={styles.fileIconDoc} />;
}

function StatusBadge({ status }) {
  if (status === 'INDEXED') {
    return <span className={styles.statusIndexed}><span className={styles.statusDot} />INDEXED</span>;
  }

  if (status === 'PROCESSING') {
    return <span className={styles.statusProcessing}><SyncOutlined />PROCESSING</span>;
  }

  return <span className={styles.statusError}><ExclamationCircleOutlined />EXTRACTION_FAILED</span>;
}

function RowActions({ rowId, openMenu, onToggle, onEdit, onHistory }) {
  const isFailed = rowId === 3;

  return (
    <div className={styles.actionCell}>
      <button className={styles.moreButton} type="button" onClick={() => onToggle(rowId)}>
        <MoreOutlined />
      </button>
      <div className={openMenu === rowId ? styles.dropdownOpen : styles.dropdown}>
        {isFailed ? (
          <>
            <a href="#"><ReloadOutlined />Thử lại trích xuất</a>
            <a href="#"><EyeOutlined />Xem chi tiết</a>
          </>
        ) : (
          <>
            <a href="#"><EyeOutlined />Xem chi tiết</a>
            <a href="#" onClick={(event) => { event.preventDefault(); onEdit(rowId); }}><EditOutlined />Sửa metadata</a>
            <a href="#" onClick={(event) => { event.preventDefault(); onHistory(rowId); }}><HistoryOutlined />Lịch sử phiên bản</a>
            <div className={styles.dropdownDivider} />
            <a className={styles.archiveAction} href="#"><FolderOpenOutlined />Lưu trữ (Archive)</a>
            <a className={styles.dangerAction} href="#"><DeleteOutlined />Xóa mềm</a>
          </>
        )}
      </div>
    </div>
  );
}

export default function DocumentsPage() {
  const navigate = useNavigate();
  const [selectedRows, setSelectedRows] = useState([]);
  const [openMenu, setOpenMenu] = useState(null);

  const allSelected = selectedRows.length === documents.length;
  const batchClassName = selectedRows.length > 0 ? styles.batchBar : styles.batchBarHidden;

  const rows = useMemo(
    () => documents.map((doc) => ({ ...doc, selected: selectedRows.includes(doc.id) })),
    [selectedRows]
  );

  function toggleAllRows() {
    setSelectedRows(allSelected ? [] : documents.map((doc) => doc.id));
  }

  function toggleRow(rowId) {
    setSelectedRows((current) => current.includes(rowId) ? current.filter((id) => id !== rowId) : [...current, rowId]);
  }

  return (
    <div className={styles.shell} onClick={() => setOpenMenu(null)}>
      <aside className={styles.sidebar}>
        <div className={styles.brandBlock}>
          <div className={styles.brandMark}>DT</div>
          <div>
            <h1>Deep Trust Admin</h1>
            <p>Enterprise DMS</p>
          </div>
        </div>

        <div className={styles.ctaWrap}>
          <button className={styles.primaryButton} type="button" onClick={() => navigate('/documents/upload')}><UploadOutlined />Upload Document</button>
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
          <a className={styles.navItem} href="#"><SettingOutlined /><span>Settings</span></a>
          <a className={styles.navItem} href="#"><QuestionCircleOutlined /><span>Help Center</span></a>
        </div>
      </aside>

      <div className={styles.mainArea}>
        <header className={styles.topbar}>
          <div className={styles.topbarBrand}>
            <span className={styles.mobileMark}>DT</span>
            DocuTrust DMS
          </div>
          <div className={styles.topbarActions}>
            <label className={styles.quickSearch}>
              <SearchOutlined />
              <input placeholder="Tìm kiếm nhanh..." type="text" />
            </label>
            <button className={styles.iconButton} type="button"><BellOutlined /><span className={styles.notificationDot} /></button>
            <button className={styles.iconButton} type="button"><QuestionCircleOutlined /></button>
            <button className={styles.iconButton} type="button"><AppstoreOutlined /></button>
            <button className={styles.profileButton} type="button"><span className={styles.avatar}>A</span><DownOutlined /></button>
          </div>
        </header>

        <main className={styles.content}>
          <div className={styles.container}>
            <div className={styles.pageHeader}>
              <div>
                <h2>Quản lý tài liệu</h2>
                <p>Quản lý, tìm kiếm và phân loại hồ sơ trên toàn hệ thống.</p>
              </div>
              <button className={styles.primaryButton} type="button" onClick={() => navigate('/documents/upload')}><UploadOutlined />Upload tài liệu mới</button>
            </div>

            <div className={styles.tabs}>
              <button className={styles.tabActive} type="button">Tất cả (1,250)</button>
              <button className={styles.tab} type="button">Đang xử lý (12)</button>
              <button className={styles.tab} type="button">Lỗi xử lý <span className={styles.errorPill}>3</span></button>
              <button className={styles.tab} type="button">Lưu trữ (Archived)</button>
              <button className={styles.tab} type="button">Đã xóa</button>
            </div>

            <section className={styles.filterPanel}>
              <div className={styles.filterGrid}>
                <label className={styles.searchField}>
                  <SearchOutlined />
                  <input placeholder="Tìm theo tiêu đề, mã tài liệu, từ khóa..." type="text" />
                </label>
                <label className={styles.dateField}>
                  <CalendarOutlined />
                  <input readOnly value="01/10/2023 - 31/10/2023" />
                </label>
                <label className={styles.selectField}>
                  <select defaultValue=""><option value="">Tất cả danh mục</option><option>Hợp đồng</option><option>Hồ sơ nhân sự</option><option>Chứng từ kế toán</option></select>
                  <DownOutlined className={styles.selectArrow} />
                </label>
              </div>
              <div className={styles.filterBottom}>
                <div className={styles.compactFilters}>
                  <label className={styles.compactSelect}><select defaultValue=""><option value="">Phòng ban</option><option>Nhân sự</option><option>CNTT</option></select><DownOutlined className={styles.selectArrow} /></label>
                  <label className={styles.compactSelect}><select defaultValue=""><option value="">Loại file</option><option>PDF</option><option>Word</option></select><DownOutlined className={styles.selectArrow} /></label>
                  <label className={styles.compactSelect}><select defaultValue=""><option value="">Trạng thái</option><option>Đã lập chỉ mục</option><option>Đang xử lý</option></select><DownOutlined className={styles.selectArrow} /></label>
                </div>
                <div className={styles.filterActions}>
                  <button className={styles.ghostButton} type="button">Xóa bộ lọc</button>
                  <button className={styles.softButton} type="button"><MenuOutlined />Lọc</button>
                </div>
              </div>
            </section>

            <div className={batchClassName}>
              <div className={styles.batchInfo}><span className={styles.batchCount}>{selectedRows.length}</span><span>tài liệu được chọn</span></div>
              <div className={styles.batchActions}>
                <button className={styles.batchAction} type="button"><FolderOpenOutlined />Di chuyển</button>
                <button className={styles.batchAction} type="button"><DownloadOutlined />Tải xuống</button>
                <button className={styles.deleteAction} type="button"><DeleteOutlined />Xóa đã chọn</button>
              </div>
            </div>

            <section className={styles.tablePanel}>
              <div className={styles.tableScroller}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th className={styles.centerCell}><input checked={allSelected} onChange={toggleAllRows} type="checkbox" /></th>
                      <th>#</th>
                      <th>Tiêu đề</th>
                      <th>Mã tài liệu</th>
                      <th>Danh mục</th>
                      <th>Trạng thái</th>
                      <th>Dung lượng</th>
                      <th>Ngày tạo</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((doc) => (
                      <tr key={doc.id} className={doc.status === 'PROCESSING' ? styles.processingRow : doc.status === 'EXTRACTION_FAILED' ? styles.errorRow : undefined}>
                        <td className={styles.centerCell}><input checked={doc.selected} onChange={() => toggleRow(doc.id)} type="checkbox" /></td>
                        <td>{doc.id}</td>
                        <td><div className={styles.documentTitle}><FileIcon type={doc.fileType} /><span title={doc.title}>{doc.title}</span></div></td>
                        <td className={styles.codeCell}>{doc.code}</td>
                        <td>{doc.category}</td>
                        <td><StatusBadge status={doc.status} /></td>
                        <td>{doc.size}</td>
                        <td>{doc.createdAt}</td>
                        <td onClick={(event) => event.stopPropagation()}><RowActions rowId={doc.id} openMenu={openMenu} onToggle={(rowId) => setOpenMenu((current) => current === rowId ? null : rowId)} onEdit={(rowId) => navigate(`/documents/${rowId}/edit`)} onHistory={(rowId) => navigate(`/documents/${rowId}/history`)} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className={styles.pagination}>
                <div className={styles.paginationText}>Hiển thị <strong>1-20</strong> / <strong>1,250</strong> tài liệu</div>
                <div className={styles.pageControls}>
                  <button className={styles.navPageButton} type="button" disabled>‹</button>
                  <button className={styles.currentPage} type="button">1</button>
                  <button className={styles.pageButton} type="button">2</button>
                  <button className={styles.pageButton} type="button">3</button>
                  <span>...</span>
                  <button className={styles.pageButton} type="button">63</button>
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
