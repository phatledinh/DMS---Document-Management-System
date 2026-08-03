import {
  AppstoreOutlined,
  BellOutlined,
  DatabaseOutlined,
  DownloadOutlined,
  EyeOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  FileWordOutlined,
  FolderOpenOutlined,
  QuestionCircleOutlined,
  HistoryOutlined,
  HomeOutlined,
  MinusOutlined,
  SearchOutlined,
  SettingOutlined,
  ShopOutlined,
  TagsOutlined,
  TeamOutlined,
  UploadOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import styles from './DashboardPage.module.css';

const metricCards = [
  { label: 'Tổng tài liệu', value: '1,250', icon: <FileTextOutlined />, tone: 'primary', trend: '+12% so với tháng trước', trendType: 'up' },
  { label: 'Người dùng', value: '85', icon: <TeamOutlined />, tone: 'secondary', trend: '+3 user mới', trendType: 'up' },
  { label: 'Danh mục', value: '15', icon: <FolderOpenOutlined />, tone: 'tertiary', trend: 'Không đổi', trendType: 'neutral' },
  { label: 'Phòng ban', value: '8', icon: <ShopOutlined />, tone: 'primaryDim', trend: 'Không đổi', trendType: 'neutral' },
];


const topViewed = [
  { name: 'Quy_trinh_nhan_su_2023.pdf', views: '1,245', type: 'pdf' },
  { name: 'Bao_cao_tai_chinh_Q3.docx', views: '980', type: 'docx' },
  { name: 'Danh_sach_khach_hang.xlsx', views: '756', type: 'xlsx' },
  { name: 'Chinh_sach_bao_mat.pdf', views: '512', type: 'pdf' },
];

const recentUploads = [
  { name: 'Hop_dong_A12.docx', uploader: 'Nguyen Van A', time: '10 p trước', type: 'docx' },
  { name: 'Ban_ve_ky_thuat.pdf', uploader: 'Tran Thi B', time: '1 giờ trước', type: 'pdf' },
  { name: 'KPI_Thang_10.xlsx', uploader: 'Le Van C', time: '3 giờ trước', type: 'xlsx' },
  { name: 'Thong_bao_nghi_le.docx', uploader: 'Admin', time: 'Hôm qua', type: 'docx' },
];

function FileBadge({ type }) {
  const config = {
    pdf: { className: styles.pdfBadge, icon: <FilePdfOutlined /> },
    docx: { className: styles.docBadge, icon: <FileWordOutlined /> },
    xlsx: { className: styles.sheetBadge, icon: <FileExcelOutlined /> },
  }[type] || { className: styles.docBadge, icon: <FileTextOutlined /> };

  return <span className={`${styles.fileBadge} ${config.className}`}>{config.icon}</span>;
}

export default function DashboardPage() {
  return (
    <div className={styles.page}>

      <div className={styles.pageBody}>

        <main className={styles.content}>
          <section className={styles.metricsGrid}>
            {metricCards.map((card) => (
              <article className={styles.metricCard} key={card.label}>
                <div className={styles.metricTop}>
                  <div>
                    <p>{card.label}</p>
                    <h2>{card.value}</h2>
                  </div>
                  <span className={`${styles.metricIcon} ${styles[card.tone]}`}>{card.icon}</span>
                </div>
                <div className={card.trendType === 'up' ? styles.trendUp : styles.trendNeutral}>
                  {card.trendType === 'up' ? '↗' : <MinusOutlined />}
                  <span>{card.trend}</span>
                </div>
              </article>
            ))}
          </section>

          <section className={styles.twoColumnGrid}>
            <article className={styles.panel}>
              <h3><DatabaseOutlined />Dung lượng lưu trữ</h3>
              <div className={styles.storageValue}>800<span>MB</span> <small>/ 5GB</small></div>
              <div className={styles.progressStack}>
                <span className={styles.activeStorage} />
                <span className={styles.versionStorage} />
                <span className={styles.trashStorage} />
              </div>
              <div className={styles.storageLegend}>
                <div><span className={styles.primaryDot} />Active<strong>650MB</strong></div>
                <div><span className={styles.warningDot} />Version<strong>100MB</strong></div>
                <div><span className={styles.neutralDot} />Trash<strong>50MB</strong></div>
              </div>
            </article>

            <article className={styles.panel}>
              <h3><BarChartOutlined />Thống kê truy cập (Tháng này)</h3>
              <div className={styles.accessList}>
                <div><span className={`${styles.smallIcon} ${styles.primary}`}><EyeOutlined /></span><span>Preview</span><strong>12,340</strong></div>
                <div><span className={`${styles.smallIcon} ${styles.secondary}`}><DownloadOutlined /></span><span>Download</span><strong>4,210</strong></div>
                <div><span className={`${styles.smallIcon} ${styles.tertiary}`}><SearchOutlined /></span><span>Search</span><strong>8,900</strong></div>
              </div>
            </article>
          </section>

          <section className={styles.twoColumnGrid}>
            <article className={styles.chartPanel}>
              <h3>Tỷ lệ loại file</h3>
              <div className={styles.placeholder}>[Biểu đồ tròn: PDF (45%), DOCX (30%), XLSX (15%), Khác (10%)]</div>
            </article>
            <article className={styles.chartPanel}>
              <h3>Trạng thái xử lý</h3>
              <div className={styles.placeholder}>[Biểu đồ cột: INDEXED (1200), PROCESSING (10), FAILED (40)]</div>
            </article>
          </section>

          <section className={styles.twoColumnGrid}>
            <article className={styles.tablePanel}>
              <div className={styles.tableHeader}><h3>Top xem nhiều</h3></div>
              <table>
                <thead><tr><th>Tên tài liệu</th><th>Lượt xem</th></tr></thead>
                <tbody>
                  {topViewed.map((doc) => (
                    <tr key={doc.name}><td><FileBadge type={doc.type} /> <span>{doc.name}</span></td><td>{doc.views}</td></tr>
                  ))}
                </tbody>
              </table>
            </article>

            <article className={styles.tablePanel}>
              <div className={styles.tableHeader}><h3>Upload gần đây</h3><a href="#">Xem tất cả</a></div>
              <table>
                <thead><tr><th>Tài liệu</th><th>Người upload</th><th>Thời gian</th></tr></thead>
                <tbody>
                  {recentUploads.map((doc) => (
                    <tr key={doc.name}><td><FileBadge type={doc.type} /> <span>{doc.name}</span></td><td>{doc.uploader}</td><td>{doc.time}</td></tr>
                  ))}
                </tbody>
              </table>
            </article>
          </section>
        </main>
      </div>
    </div>
  );
}
