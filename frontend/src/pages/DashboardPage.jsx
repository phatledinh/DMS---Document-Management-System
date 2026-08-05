import {
  BarChartOutlined,
  DatabaseOutlined,
  DownloadOutlined,
  EyeOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  FileWordOutlined,
  FolderOpenOutlined,
  ReloadOutlined,
  SearchOutlined,
  TeamOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { Alert, Button, Select, Skeleton } from 'antd';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDashboardData } from '../features/dashboard/hooks/useDashboardData.js';
import styles from './DashboardPage.module.css';

const fileIcons = {
  PDF: { className: styles.pdfBadge, icon: <FilePdfOutlined /> },
  DOC: { className: styles.docBadge, icon: <FileWordOutlined /> },
  DOCX: { className: styles.docBadge, icon: <FileWordOutlined /> },
  XLS: { className: styles.sheetBadge, icon: <FileExcelOutlined /> },
  XLSX: { className: styles.sheetBadge, icon: <FileExcelOutlined /> },
};

function FileBadge({ type }) {
  const config = fileIcons[type?.toUpperCase()] || { className: styles.docBadge, icon: <FileTextOutlined /> };
  return <span className={`${styles.fileBadge} ${config.className}`}>{config.icon}</span>;
}

function formatNumber(value) {
  return new Intl.NumberFormat('vi-VN').format(value || 0);
}

function formatMb(value) {
  return `${formatNumber(Number(value || 0).toFixed(2))} MB`;
}

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function BarBreakdown({ data }) {
  const entries = Object.entries(data || {}).filter(([, count]) => count > 0);
  const total = entries.reduce((sum, [, count]) => sum + count, 0);

  if (!entries.length) {
    return <div className={styles.emptyState}>Chưa có dữ liệu</div>;
  }

  return (
    <div className={styles.breakdownList}>
      {entries.map(([label, count]) => {
        const percent = total ? Math.round((count / total) * 100) : 0;
        return (
          <div className={styles.breakdownItem} key={label}>
            <div className={styles.breakdownMeta}>
              <span>{label}</span>
              <strong>{formatNumber(count)} ({percent}%)</strong>
            </div>
            <div className={styles.breakdownTrack}><span style={{ width: `${percent}%` }} /></div>
          </div>
        );
      })}
    </div>
  );
}

function AccessTrendChart({ points }) {
  const data = points || [];
  const maxValue = Math.max(1, ...data.flatMap((point) => [point.previews || 0, point.downloads || 0]));
  const width = 560;
  const height = 220;
  const padding = 28;
  const step = data.length > 1 ? (width - padding * 2) / (data.length - 1) : 0;

  const pathFor = (key) => data.map((point, index) => {
    const x = padding + index * step;
    const y = height - padding - ((point[key] || 0) / maxValue) * (height - padding * 2);
    return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  if (!data.length) {
    return <div className={styles.placeholder}>Chưa có dữ liệu preview/download trong khoảng đã chọn</div>;
  }

  return (
    <div>
      <svg className={styles.lineChart} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Lượt preview và download theo thời gian">
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} />
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} />
        <path d={pathFor('previews')} className={styles.previewLine} />
        <path d={pathFor('downloads')} className={styles.downloadLine} />
        {data.map((point, index) => {
          const x = padding + index * step;
          const previewY = height - padding - ((point.previews || 0) / maxValue) * (height - padding * 2);
          const downloadY = height - padding - ((point.downloads || 0) / maxValue) * (height - padding * 2);
          return (
            <g key={point.date}>
              <circle className={styles.previewDot} cx={x} cy={previewY} r="4" />
              <circle className={styles.downloadDot} cx={x} cy={downloadY} r="4" />
              <title>{`${point.date}: preview ${formatNumber(point.previews)}, download ${formatNumber(point.downloads)}`}</title>
            </g>
          );
        })}
      </svg>
      <div className={styles.chartLegend}>
        <span><i className={styles.previewLegend} />Preview</span>
        <span><i className={styles.downloadLegend} />Download</span>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [granularity, setGranularity] = useState('day');
  const dashboard = useDashboardData({ granularity });
  const summary = dashboard.summaryQuery.data;
  const storage = dashboard.storageQuery.data;
  const accessStats = dashboard.accessStatsQuery.data;
  const topDocuments = dashboard.topDocumentsQuery.data || [];
  const recentUploads = dashboard.recentUploadsQuery.data?.content || [];
  const topKeywords = dashboard.topSearchKeywordsQuery.data || [];

  const metricCards = useMemo(() => [
    { label: 'Tổng tài liệu', value: formatNumber(summary?.totalDocuments), icon: <FileTextOutlined />, tone: 'primary', detail: 'Tất cả tài liệu trong DB' },
    { label: 'Người dùng', value: formatNumber(summary?.totalUsers), icon: <TeamOutlined />, tone: 'secondary', detail: `${formatNumber(summary?.activeUserCount)} user hoạt động` },
    { label: 'Danh mục', value: formatNumber(summary?.totalCategories), icon: <FolderOpenOutlined />, tone: 'tertiary', detail: `${formatNumber(summary?.totalDepartments)} phòng ban` },
    { label: 'Lỗi xử lý', value: formatNumber(summary?.processingErrorCount), icon: <WarningOutlined />, tone: 'primaryDim', detail: 'Extraction/indexing cần xử lý' },
  ], [summary]);

  const storageTotal = Math.max(storage?.totalStorageBytes || 0, 1);
  const activePercent = ((storage?.activeStorageBytes || 0) / storageTotal) * 100;
  const versionPercent = ((storage?.versionStorageBytes || 0) / storageTotal) * 100;
  const trashPercent = ((storage?.trashStorageBytes || 0) / storageTotal) * 100;

  return (
    <div className={styles.page}>
      <div className={styles.pageBody}>
        <main className={styles.content}>
          <div className={styles.pageHeader}>
            <div>
              <h1>Dashboard Admin</h1>
              <p>Theo dõi tài liệu, dung lượng và hoạt động truy cập hệ thống.</p>
            </div>
            <Button icon={<ReloadOutlined />} onClick={dashboard.refetch}>Làm mới</Button>
          </div>

          {dashboard.isError && <Alert className={styles.alert} message="Không tải được dữ liệu dashboard" type="error" showIcon />}

          <section className={styles.metricsGrid}>
            {metricCards.map((card) => (
              <article className={styles.metricCard} key={card.label}>
                <Skeleton loading={dashboard.summaryQuery.isLoading} active paragraph={false}>
                  <div className={styles.metricTop}>
                    <div>
                      <p>{card.label}</p>
                      <h2>{card.value}</h2>
                    </div>
                    <span className={`${styles.metricIcon} ${styles[card.tone]}`}>{card.icon}</span>
                  </div>
                  <div className={styles.trendNeutral}><span>{card.detail}</span></div>
                </Skeleton>
              </article>
            ))}
          </section>

          <section className={styles.twoColumnGrid}>
            <article className={styles.panel}>
              <h3><DatabaseOutlined />Dung lượng lưu trữ</h3>
              <Skeleton loading={dashboard.storageQuery.isLoading} active paragraph={{ rows: 3 }}>
                <div className={styles.storageValue}>{formatMb(storage?.totalStorageMb)} <small>tổng</small></div>
                <div className={styles.progressStack}>
                  <span className={styles.activeStorage} style={{ width: `${activePercent}%` }} />
                  <span className={styles.versionStorage} style={{ width: `${versionPercent}%` }} />
                  <span className={styles.trashStorage} style={{ width: `${trashPercent}%` }} />
                </div>
                <div className={styles.storageLegend}>
                  <div><span className={styles.primaryDot} />Active<strong>{formatMb(storage?.activeStorageMb)}</strong></div>
                  <div><span className={styles.warningDot} />Version<strong>{formatMb(storage?.versionStorageMb)}</strong></div>
                  <div><span className={styles.neutralDot} />Trash<strong>{formatMb(storage?.trashStorageMb)}</strong></div>
                </div>
              </Skeleton>
            </article>

            <article className={styles.panel}>
              <div className={styles.panelHeader}>
                <h3><BarChartOutlined />Preview / download</h3>
                <Select
                  size="small"
                  value={granularity}
                  onChange={setGranularity}
                  options={[{ value: 'day', label: 'Ngày' }, { value: 'week', label: 'Tuần' }, { value: 'month', label: 'Tháng' }]}
                />
              </div>
              <Skeleton loading={dashboard.accessStatsQuery.isLoading} active paragraph={{ rows: 4 }}>
                <AccessTrendChart points={accessStats?.trend} />
              </Skeleton>
            </article>
          </section>

          <section className={styles.twoColumnGrid}>
            <article className={styles.chartPanel}>
              <h3>Trạng thái tài liệu</h3>
              <BarBreakdown data={summary?.documentsByStatus} />
            </article>
            <article className={styles.chartPanel}>
              <h3>Tỷ lệ loại file</h3>
              <BarBreakdown data={summary?.documentsByFileType} />
            </article>
          </section>

          <section className={styles.twoColumnGrid}>
            <article className={styles.tablePanel}>
              <div className={styles.tableHeader}><h3>Top xem nhiều</h3><Link to="/analytics">Xem analytics</Link></div>
              <table>
                <thead><tr><th>Tên tài liệu</th><th>Preview</th><th>Download</th></tr></thead>
                <tbody>
                  {topDocuments.map((doc) => (
                    <tr key={doc.id}>
                      <td><FileBadge type="PDF" /> <span>{doc.title}</span></td>
                      <td>{formatNumber(doc.viewCount)}</td>
                      <td>{formatNumber(doc.downloadCount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!topDocuments.length && <div className={styles.emptyState}>Chưa có dữ liệu truy cập</div>}
            </article>

            <article className={styles.tablePanel}>
              <div className={styles.tableHeader}><h3>Upload gần đây</h3><Link to="/admin/documents">Xem tất cả</Link></div>
              <table>
                <thead><tr><th>Tài liệu</th><th>Người upload</th><th>Thời gian</th></tr></thead>
                <tbody>
                  {recentUploads.map((doc) => (
                    <tr key={doc.id}>
                      <td><FileBadge type={doc.fileType} /> <span>{doc.title}</span></td>
                      <td>{doc.uploaderName || doc.uploadedBy || '—'}</td>
                      <td>{formatDate(doc.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!recentUploads.length && <div className={styles.emptyState}>Chưa có upload gần đây</div>}
            </article>
          </section>

          <section className={styles.tablePanel}>
            <div className={styles.tableHeader}><h3>Top từ khóa tìm kiếm</h3><Link to="/audit-logs">Xem search logs</Link></div>
            <table>
              <thead><tr><th>Từ khóa</th><th>Lượt tìm</th><th>Avg result</th><th>Avg latency</th></tr></thead>
              <tbody>
                {topKeywords.map((keyword) => (
                  <tr key={keyword.keyword}>
                    <td><SearchOutlined /> <span>{keyword.keyword}</span></td>
                    <td>{formatNumber(keyword.searchCount)}</td>
                    <td>{formatNumber(Math.round(keyword.averageResultCount || 0))}</td>
                    <td>{formatNumber(Math.round(keyword.averageLatencyMs || 0))} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!topKeywords.length && <div className={styles.emptyState}>Chưa có dữ liệu tìm kiếm</div>}
          </section>
        </main>
      </div>
    </div>
  );
}
