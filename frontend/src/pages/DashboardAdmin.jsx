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
  UploadOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { Alert, Button, Empty, Input, Select, Skeleton } from 'antd';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDashboardData } from '../features/dashboard/hooks/useDashboardData.js';
import styles from './DashboardAdmin.module.css';

const fileIcons = {
  PDF: { className: styles.pdfBadge, icon: <FilePdfOutlined /> },
  DOC: { className: styles.docBadge, icon: <FileWordOutlined /> },
  DOCX: { className: styles.docBadge, icon: <FileWordOutlined /> },
  XLS: { className: styles.sheetBadge, icon: <FileExcelOutlined /> },
  XLSX: { className: styles.sheetBadge, icon: <FileExcelOutlined /> },
};

const statusTone = {
  READY: 'success',
  COMPLETED: 'success',
  ACTIVE: 'success',
  PROCESSING: 'info',
  ERROR: 'danger',
  FAILED: 'danger',
};

function FileBadge({ type }) {
  const config = fileIcons[type?.toUpperCase()] || { className: styles.docBadge, icon: <FileTextOutlined /> };
  return <span className={`${styles.fileBadge} ${config.className}`}>{config.icon}</span>;
}

function formatNumber(value) {
  return new Intl.NumberFormat('vi-VN').format(value || 0);
}

function formatMb(value) {
  const numericValue = Number(value || 0);
  if (numericValue >= 1024) {
    return `${formatNumber((numericValue / 1024).toFixed(2))} GB`;
  }
  return `${formatNumber(numericValue.toFixed(2))} MB`;
}

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function MetricCard({ label, value, detail, icon, tone = 'primary', loading }) {
  return (
    <article className={styles.metricCard}>
      <Skeleton loading={loading} active paragraph={false}>
        <div className={styles.metricContent}>
          <div>
            <p>{label}</p>
            <h2>{value}</h2>
            <span>{detail}</span>
          </div>
          <span className={`${styles.metricIcon} ${styles[tone]}`}>{icon}</span>
        </div>
      </Skeleton>
    </article>
  );
}

function StatusPill({ status }) {
  if (!status) return null;
  const tone = statusTone[String(status).toUpperCase()] || 'info';
  return (
    <span className={`${styles.statusPill} ${styles[tone]}`}>
      <i />
      {status}
    </span>
  );
}

function SectionCard({ title, action, children, className = '' }) {
  return (
    <article className={`${styles.sectionCard} ${className}`}>
      <div className={styles.sectionHeader}>
        <h3>{title}</h3>
        {action}
      </div>
      {children}
    </article>
  );
}

function AccessTrendChart({ points }) {
  const data = points || [];
  const maxValue = Math.max(1, ...data.flatMap((point) => [point.previews || 0, point.downloads || 0]));
  const width = 720;
  const height = 260;
  const paddingX = 48;
  const paddingTop = 18;
  const paddingBottom = 36;
  const chartHeight = height - paddingTop - paddingBottom;
  const step = data.length > 1 ? (width - paddingX * 2) / (data.length - 1) : 0;
  const gridValues = [maxValue, maxValue * 0.75, maxValue * 0.5, maxValue * 0.25, 0];

  const pointFor = (point, index, key) => {
    const x = paddingX + index * step;
    const y = paddingTop + chartHeight - ((point[key] || 0) / maxValue) * chartHeight;
    return { x, y };
  };

  const pathFor = (key) => data.map((point, index) => {
    const { x, y } = pointFor(point, index, key);
    return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  if (!data.length) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có dữ liệu truy cập trong khoảng đã chọn" />;
  }

  return (
    <div className={styles.chartWrap}>
      <svg className={styles.lineChart} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Lượt xem và tải xuống theo thời gian">
        {gridValues.map((value, index) => {
          const y = paddingTop + (chartHeight / (gridValues.length - 1)) * index;
          return (
            <g key={value}>
              <line className={styles.gridLine} x1={paddingX} y1={y} x2={width - paddingX} y2={y} />
              <text x={paddingX - 12} y={y + 4} textAnchor="end">{formatNumber(Math.round(value))}</text>
            </g>
          );
        })}
        <path d={pathFor('previews')} className={styles.previewArea} />
        <path d={pathFor('previews')} className={styles.previewLine} />
        <path d={pathFor('downloads')} className={styles.downloadLine} />
        {data.map((point, index) => {
          const preview = pointFor(point, index, 'previews');
          const download = pointFor(point, index, 'downloads');
          return (
            <g key={point.date || index}>
              <circle className={styles.previewDot} cx={preview.x} cy={preview.y} r="4" />
              <circle className={styles.downloadDot} cx={download.x} cy={download.y} r="4" />
              <text className={styles.axisLabel} x={preview.x} y={height - 10} textAnchor="middle">
                {point.date || index + 1}
              </text>
              <title>{`${point.date || ''}: xem ${formatNumber(point.previews)}, tải ${formatNumber(point.downloads)}`}</title>
            </g>
          );
        })}
      </svg>
      <div className={styles.chartLegend}>
        <span><i className={styles.previewLegend} />Lượt xem</span>
        <span><i className={styles.downloadLegend} />Lượt tải</span>
      </div>
    </div>
  );
}

function BreakdownBars({ data }) {
  const entries = Object.entries(data || {}).filter(([, count]) => count > 0);
  const total = entries.reduce((sum, [, count]) => sum + count, 0);

  if (!entries.length) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có dữ liệu thống kê" />;
  }

  return (
    <div className={styles.horizontalBars}>
      {entries.map(([label, count]) => {
        const percent = total ? Math.round((count / total) * 100) : 0;
        return (
          <div className={styles.horizontalBar} key={label}>
            <span className={styles.barLabel}>{label}</span>
            <div className={styles.barTrack}><span style={{ width: `${percent}%` }} /></div>
            <strong>{formatNumber(count)}</strong>
          </div>
        );
      })}
    </div>
  );
}

function LatestDocumentsList({ documents }) {
  if (!documents.length) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có upload gần đây" />;
  }

  return (
    <div className={styles.documentList}>
      {documents.map((doc) => (
        <div className={styles.documentItem} key={doc.id}>
          <FileBadge type={doc.fileType} />
          <div className={styles.itemMain}>
            <strong>{doc.title}</strong>
            <span>{doc.code || doc.documentCode || doc.uploaderName || doc.uploadedBy || '—'} · {formatDate(doc.createdAt)}</span>
          </div>
          <StatusPill status={doc.status} />
        </div>
      ))}
    </div>
  );
}

function SearchKeywordsList({ keywords }) {
  if (!keywords.length) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có dữ liệu tìm kiếm" />;
  }

  return (
    <div className={styles.activityList}>
      {keywords.map((keyword) => (
        <div className={styles.activityItem} key={keyword.keyword}>
          <span className={styles.activityIcon}><SearchOutlined /></span>
          <div className={styles.itemMain}>
            <strong>{keyword.keyword}</strong>
            <span>{formatNumber(keyword.searchCount)} lượt tìm · {formatNumber(Math.round(keyword.averageLatencyMs || 0))} ms</span>
          </div>
          <span className={styles.compactBadge}>{formatNumber(Math.round(keyword.averageResultCount || 0))} kết quả</span>
        </div>
      ))}
    </div>
  );
}

export default function DashboardAdmin() {
  const [granularity, setGranularity] = useState('day');
  const dashboard = useDashboardData({ granularity });
  const summary = dashboard.summaryQuery.data;
  const storage = dashboard.storageQuery.data;
  const accessStats = dashboard.accessStatsQuery.data;
  const topDocuments = dashboard.topDocumentsQuery.data || [];
  const recentUploads = dashboard.recentUploadsQuery.data?.content || [];
  const topKeywords = dashboard.topSearchKeywordsQuery.data || [];

  const totalDownloads = useMemo(
    () => (accessStats?.trend || []).reduce((sum, point) => sum + (point.downloads || 0), 0),
    [accessStats],
  );
  const totalSearches = useMemo(
    () => topKeywords.reduce((sum, keyword) => sum + (keyword.searchCount || 0), 0),
    [topKeywords],
  );

  const metricCards = useMemo(() => [
    {
      label: 'Tổng tài liệu',
      value: formatNumber(summary?.totalDocuments),
      icon: <FileTextOutlined />,
      tone: 'primary',
      detail: 'Tất cả tài liệu trong hệ thống',
    },
    {
      label: 'Lượt tìm kiếm',
      value: formatNumber(totalSearches),
      icon: <SearchOutlined />,
      tone: 'cyan',
      detail: 'Theo top từ khóa hiện có',
    },
    {
      label: 'Lượt tải',
      value: formatNumber(totalDownloads),
      icon: <DownloadOutlined />,
      tone: 'green',
      detail: 'Theo biểu đồ truy cập',
    },
    {
      label: 'Tài liệu lỗi',
      value: formatNumber(summary?.processingErrorCount),
      icon: <WarningOutlined />,
      tone: 'orange',
      detail: 'Cần xử lý extraction/indexing',
    },
  ], [summary, totalDownloads, totalSearches]);

  const bottomMetrics = useMemo(() => [
    {
      label: 'Người dùng',
      value: formatNumber(summary?.totalUsers),
      detail: `${formatNumber(summary?.activeUserCount)} đang hoạt động`,
      icon: <TeamOutlined />,
      tone: 'cyan',
    },
    {
      label: 'Danh mục',
      value: formatNumber(summary?.totalCategories),
      detail: `${formatNumber(summary?.totalDepartments)} phòng ban`,
      icon: <FolderOpenOutlined />,
      tone: 'primary',
    },
    {
      label: 'Dung lượng',
      value: formatMb(storage?.totalStorageMb),
      detail: `${formatMb(storage?.activeStorageMb)} đang dùng`,
      icon: <DatabaseOutlined />,
      tone: 'green',
    },
  ], [storage, summary]);

  return (
    <main className={styles.page}>
      <div className={styles.topStrip}>
        <Input
          className={styles.searchInput}
          prefix={<SearchOutlined />}
          placeholder="Tìm nhanh tài liệu, mã tài liệu, tag…"
          allowClear
        />
        <Button icon={<ReloadOutlined />} onClick={dashboard.refetch}>Làm mới</Button>
      </div>

      <header className={styles.heroHeader}>
        <div>
          <h1>Dashboard Admin</h1>
          <p>Bức tranh tổng thể về kho tài liệu và hoạt động người dùng.</p>
        </div>
        <Button className={styles.uploadButton} type="primary" icon={<UploadOutlined />}>
          Upload tài liệu
        </Button>
      </header>

      {dashboard.isError && <Alert className={styles.alert} message="Không tải được dữ liệu dashboard" type="error" showIcon />}

      <section className={styles.metricsGrid}>
        {metricCards.map((card) => (
          <MetricCard key={card.label} {...card} loading={dashboard.summaryQuery.isLoading || dashboard.accessStatsQuery.isLoading || dashboard.topSearchKeywordsQuery.isLoading} />
        ))}
      </section>

      <section className={styles.analyticsGrid}>
        <SectionCard
          title="Lượt xem & tải xuống theo ngày"
          className={styles.trendPanel}
          action={(
            <Select
              size="small"
              value={granularity}
              onChange={setGranularity}
              options={[{ value: 'day', label: 'Ngày' }, { value: 'week', label: 'Tuần' }, { value: 'month', label: 'Tháng' }]}
            />
          )}
        >
          <Skeleton loading={dashboard.accessStatsQuery.isLoading} active paragraph={{ rows: 6 }}>
            <AccessTrendChart points={accessStats?.trend} />
          </Skeleton>
        </SectionCard>

        <SectionCard title="Tài liệu theo loại file">
          <Skeleton loading={dashboard.summaryQuery.isLoading} active paragraph={{ rows: 6 }}>
            <BreakdownBars data={summary?.documentsByFileType} />
          </Skeleton>
        </SectionCard>
      </section>

      <section className={styles.listsGrid}>
        <SectionCard title="Tài liệu mới nhất" action={<Link to="/admin/documents-admin">Quản lý</Link>}>
          <Skeleton loading={dashboard.recentUploadsQuery.isLoading} active paragraph={{ rows: 5 }}>
            <LatestDocumentsList documents={recentUploads} />
          </Skeleton>
        </SectionCard>

        <SectionCard title="Từ khóa tìm kiếm nổi bật" action={<Link to="/audit-logs">Xem log</Link>}>
          <Skeleton loading={dashboard.topSearchKeywordsQuery.isLoading} active paragraph={{ rows: 5 }}>
            <SearchKeywordsList keywords={topKeywords} />
          </Skeleton>
        </SectionCard>
      </section>

      <section className={styles.metricsGridThree}>
        {bottomMetrics.map((card) => (
          <MetricCard key={card.label} {...card} loading={dashboard.summaryQuery.isLoading || dashboard.storageQuery.isLoading} />
        ))}
      </section>

      <section className={styles.listsGrid}>
        <SectionCard title="Top xem nhiều" action={<Link to="/analytics">Xem analytics</Link>}>
          <Skeleton loading={dashboard.topDocumentsQuery.isLoading} active paragraph={{ rows: 5 }}>
            <div className={styles.documentList}>
              {topDocuments.map((doc) => (
                <div className={styles.documentItem} key={doc.id}>
                  <span className={styles.activityIcon}><EyeOutlined /></span>
                  <div className={styles.itemMain}>
                    <strong>{doc.title}</strong>
                    <span>{formatNumber(doc.viewCount)} lượt xem · {formatNumber(doc.downloadCount)} lượt tải</span>
                  </div>
                </div>
              ))}
              {!topDocuments.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có dữ liệu truy cập" />}
            </div>
          </Skeleton>
        </SectionCard>

        <SectionCard title="Trạng thái tài liệu">
          <Skeleton loading={dashboard.summaryQuery.isLoading} active paragraph={{ rows: 5 }}>
            <BreakdownBars data={summary?.documentsByStatus} />
          </Skeleton>
        </SectionCard>
      </section>
    </main>
  );
}
