import {
  AppstoreOutlined,
  BellOutlined,
  EyeOutlined,
  FileImageOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  FilterOutlined,
  FolderOpenOutlined,
  HistoryOutlined,
  QuestionCircleOutlined,
  SearchOutlined,
  SecurityScanOutlined,
  SettingOutlined,
  ShopOutlined,
  SyncOutlined,
  TagsOutlined,
  TeamOutlined,
  UploadOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { Link } from 'react-router-dom';
import styles from './ProcessingErrorsPage.module.css';


const summaryCards = [
  { label: 'Tổng số lỗi', value: '124', helper: '12%', tone: 'error', icon: <WarningOutlined /> },
  { label: 'Quá thời gian (Timeout)', value: '42', helper: 'tài liệu', tone: 'warning', icon: <HistoryOutlined /> },
  { label: 'Lỗi trích xuất (Extraction)', value: '82', helper: 'tài liệu', tone: 'tertiary', icon: <FileTextOutlined /> },
];

const rows = [
  { id: 1, title: 'Bao_cao_tai_chinh_Q3_2023_Final_Draft_v2.pdf', type: 'PDF', status: 'EXTRACTION_FAILED', retry: '2/3', failedAt: '10:45 12/10/2023', file: 'pdf' },
  { id: 2, title: 'Hop_dong_lao_dong_Nguyen_Van_A_signed.docx', type: 'DOCX', status: 'TIMEOUT', retry: '1/3', failedAt: '09:15 12/10/2023', file: 'doc' },
  { id: 3, title: 'Scan_CCCD_Mat_Truoc_HQ.png', type: 'PNG', status: 'CORRUPTED_FILE', retry: '3/3', failedAt: '16:30 11/10/2023', file: 'image', retryDisabled: true },
  { id: 4, title: 'Quy_trinh_van_hanh_kho_v3.pdf', type: 'PDF', status: 'EXTRACTION_FAILED', retry: '0/3', failedAt: '14:20 11/10/2023', file: 'pdf' },
];

function FileIcon({ type }) {
  if (type === 'pdf') return <span className={styles.pdfIcon}><FilePdfOutlined /></span>;
  if (type === 'image') return <span className={styles.imageIcon}><FileImageOutlined /></span>;
  return <span className={styles.docIcon}><FileTextOutlined /></span>;
}

export default function ProcessingErrorsPage() {
  return (
    <div className={styles.page}>

      <main className={styles.pageBody}>

        <div className={styles.canvas}>
          <div className={styles.container}>
            <section className={styles.pageHeader}>
              <div>
                <div className={styles.breadcrumbs}><Link to="/audit-logs">Audit Logs</Link><span>›</span><strong>Processing Errors</strong></div>
                <h2>TÀI LIỆU LỖI XỬ LÝ</h2>
              </div>
              <button className={styles.retryAllButton} type="button"><SyncOutlined />Retry tất cả</button>
            </section>

            <section className={styles.summaryGrid}>
              {summaryCards.map((card) => (
                <article className={`${styles.summaryCard} ${styles[card.tone]}`} key={card.label}>
                  <div>
                    <span>{card.label}</span>
                    <div className={styles.summaryValue}><strong>{card.value}</strong><small>{card.helper}</small></div>
                  </div>
                  <div className={styles.summaryIcon}>{card.icon}</div>
                </article>
              ))}
            </section>

            <section className={styles.tablePanel}>
              <div className={styles.toolbar}>
                <label className={styles.selectBox}>
                  <FilterOutlined />
                  <select defaultValue="all"><option value="all">Tất cả loại lỗi</option><option>TIMEOUT</option><option>EXTRACTION_FAILED</option><option>CORRUPTED_FILE</option></select>
                </label>
                <div className={styles.tableMeta}><span>Hiển thị 1-10 của 124</span><button type="button">‹</button><button type="button">›</button></div>
              </div>

              <div className={styles.tableScroller}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Tiêu đề tài liệu</th>
                      <th>Loại</th>
                      <th>Trạng thái lỗi</th>
                      <th>Retry</th>
                      <th>Thời gian lỗi</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id}>
                        <td>{row.id}</td>
                        <td><div className={styles.titleCell}><FileIcon type={row.file} /><strong>{row.title}</strong></div></td>
                        <td className={styles.monoCell}>{row.type}</td>
                        <td><span className={row.status === 'TIMEOUT' ? styles.timeoutBadge : styles.errorBadge}><span />{row.status}</span></td>
                        <td className={row.retryDisabled ? styles.retryError : styles.monoCell}>{row.retry}</td>
                        <td className={styles.dateCell}>{row.failedAt}</td>
                        <td><div className={styles.rowActions}><button disabled={row.retryDisabled} type="button"><SyncOutlined /></button><button type="button"><EyeOutlined /></button></div></td>
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
