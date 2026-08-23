import {
  DownloadOutlined,
  EyeOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  FileExcelOutlined,
  SearchOutlined,
  RiseOutlined,
  SwapOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { Alert, Card, Col, Row, Select, Space, Table, Tabs, Typography } from 'antd';
import { useMemo, useState } from 'react';
import { getApiErrorMessage } from '../../../utils/response.js';
import { useSearchAccessAnalytics } from '../hooks/useSearchAccessAnalytics.js';
import styles from './SearchAccessAnalyticsPage.module.css';

const rangeOptions = {
  today: 1,
  '7d': 7,
  '30d': 30,
};

function getDateRange(range) {
  const days = rangeOptions[range];
  if (!days) return {};
  const dateTo = new Date();
  const dateFrom = new Date(dateTo);
  dateFrom.setDate(dateFrom.getDate() - (days - 1));
  dateFrom.setHours(0, 0, 0, 0);
  return {
    dateFrom: dateFrom.toISOString(),
    dateTo: dateTo.toISOString(),
  };
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(value || 0);
}

function formatDuration(milliseconds) {
  if (!milliseconds) return '0s';
  if (milliseconds < 1000) return `${Math.round(milliseconds)}ms`;
  return `${(milliseconds / 1000).toFixed(1)}s`;
}

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function getDocumentType(title) {
  const extension = title?.split('.').pop()?.toLowerCase();
  if (extension === 'pdf') return 'pdf';
  if (['xls', 'xlsx', 'csv'].includes(extension)) return 'sheet';
  return 'doc';
}

function createLinePath(points, key, width, height, padding, maxValue) {
  if (points.length === 1) {
    const x = width / 2;
    const y = height - padding - (points[0][key] / maxValue) * (height - padding * 2);
    return `M ${x.toFixed(1)} ${y.toFixed(1)}`;
  }

  return points
    .map((point, index) => {
      const x = padding + (index * (width - padding * 2)) / (points.length - 1);
      const y = height - padding - (point[key] / maxValue) * (height - padding * 2);
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
}

function TrendChart({ data }) {
  const width = 720;
  const height = 300;
  const padding = 36;
  const maxValue = Math.max(1, ...data.flatMap((point) => [point.searches, point.accesses]));
  const searchesPath = createLinePath(data, 'searches', width, height, padding, maxValue);
  const accessesPath = createLinePath(data, 'accesses', width, height, padding, maxValue);
  const areaPath = data.length > 1 ? `${searchesPath} L ${width - padding} ${height - padding} L ${padding} ${height - padding} Z` : '';

  if (!data.length) {
    return <div className={styles.emptyState}>Chưa có dữ liệu xu hướng trong khoảng thời gian này.</div>;
  }

  return (
    <div className={styles.chartFrame}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Xu hướng tìm kiếm và truy cập trong khoảng thời gian đã chọn">
        <defs>
          <linearGradient id="searchArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#005bbf" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#005bbf" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = height - padding - ratio * (height - padding * 2);
          return <line key={ratio} x1={padding} x2={width - padding} y1={y} y2={y} className={styles.gridLine} />;
        })}
        {areaPath && <path d={areaPath} fill="url(#searchArea)" />}
        <path d={searchesPath} className={styles.searchLine} />
        <path d={accessesPath} className={styles.accessLine} />
        {data.map((point, index) => {
          const x = data.length === 1 ? width / 2 : padding + (index * (width - padding * 2)) / (data.length - 1);
          return (
            <text key={point.label} x={x} y={height - 8} textAnchor="middle" className={styles.axisText}>
              {point.label}
            </text>
          );
        })}
      </svg>
      <div className={styles.legend}>
        <span><i className={styles.searchSwatch} />Searches</span>
        <span><i className={styles.accessSwatch} />Accesses</span>
      </div>
    </div>
  );
}

function KeywordChart({ data }) {
  if (!data.length) {
    return <div className={styles.emptyState}>Chưa có dữ liệu từ khóa.</div>;
  }

  const maxValue = Math.max(...data.map((item) => item.value));

  return (
    <div className={styles.barChart} role="img" aria-label="Top từ khóa tìm kiếm phổ biến">
      {data.map((item) => (
        <div className={styles.barItem} key={item.keyword} title={`${item.keyword}: ${formatNumber(item.value)} lượt tìm kiếm`}>
          <div className={styles.barTrack}>
            <div className={styles.bar} style={{ height: `${(item.value / maxValue) * 100}%` }}>
              <span>{formatNumber(item.value)}</span>
            </div>
          </div>
          <span className={styles.barLabel}>{item.keyword}</span>
        </div>
      ))}
    </div>
  );
}

function DocumentIcon({ type }) {
  if (type === 'pdf') return <FilePdfOutlined className={styles.pdfIcon} />;
  if (type === 'sheet') return <FileExcelOutlined className={styles.sheetIcon} />;
  return <FileTextOutlined className={styles.docIcon} />;
}

const keywordColumns = [
  { title: 'Keyword', dataIndex: 'keyword', key: 'keyword' },
  { title: 'Count', dataIndex: 'count', key: 'count', align: 'right' },
  { title: 'Avg Results', dataIndex: 'avgResults', key: 'avgResults', align: 'right' },
  { title: 'Avg Time', dataIndex: 'avgTime', key: 'avgTime', align: 'right' },
];

const documentColumns = [
  {
    title: 'Title',
    dataIndex: 'title',
    key: 'title',
    render: (title, record) => (
      <Space size={8}>
        <DocumentIcon type={record.type} />
        <span className={styles.documentTitle}>{title}</span>
      </Space>
    ),
  },
  { title: 'Previews', dataIndex: 'previews', key: 'previews', align: 'right' },
  { title: 'Downloads', dataIndex: 'downloads', key: 'downloads', align: 'right' },
  { title: 'Last Access', dataIndex: 'lastAccess', key: 'lastAccess', align: 'right' },
];

export default function SearchAccessAnalyticsPage() {
  const [range, setRange] = useState('30d');
  const dateRange = useMemo(() => getDateRange(range), [range]);
  const analytics = useSearchAccessAnalytics({ ...dateRange, granularity: 'day', limit: 5 });
  const systemAccess = analytics.systemAccessQuery.data;
  const topKeywords = useMemo(() => analytics.topSearchKeywordsQuery.data || [], [analytics.topSearchKeywordsQuery.data]);
  const topDocuments = useMemo(() => analytics.topDocumentsQuery.data || [], [analytics.topDocumentsQuery.data]);

  const trendData = useMemo(() => (systemAccess?.accessTrend || []).map((point) => ({
    label: point.date?.slice(5) || point.date,
    searches: point.searches || 0,
    accesses: (point.views || 0) + (point.previews || 0) + (point.downloads || 0),
  })), [systemAccess?.accessTrend]);

  const keywordData = useMemo(() => topKeywords.map((item) => ({
    keyword: item.keyword,
    value: item.searchCount || 0,
  })), [topKeywords]);

  const metrics = useMemo(() => [
    {
      title: 'Total Searches',
      value: formatNumber(systemAccess?.searchCount),
      change: 'Trong khoảng đã chọn',
      tone: 'success',
      icon: <SearchOutlined />,
    },
    {
      title: 'Avg. Search Time',
      value: formatDuration(topKeywords.reduce((sum, item) => sum + (item.averageLatencyMs || 0), 0) / (topKeywords.length || 1)),
      change: 'Trung bình top keywords',
      tone: 'success',
      icon: <ClockCircleOutlined />,
    },
    {
      title: 'Total Previews',
      value: formatNumber(systemAccess?.previewCount),
      change: 'Trong khoảng đã chọn',
      tone: 'warning',
      icon: <EyeOutlined />,
    },
    {
      title: 'Total Downloads',
      value: formatNumber(systemAccess?.downloadCount),
      change: 'Trong khoảng đã chọn',
      tone: 'success',
      icon: <DownloadOutlined />,
    },
  ], [systemAccess, topKeywords]);

  const keywords = useMemo(() => topKeywords.map((item) => ({
    keyword: item.keyword,
    count: formatNumber(item.searchCount),
    avgResults: (item.averageResultCount || 0).toFixed(1),
    avgTime: formatDuration(item.averageLatencyMs),
  })), [topKeywords]);

  const documents = useMemo(() => topDocuments.map((item) => ({
    id: item.id,
    title: item.title,
    previews: formatNumber(item.viewCount),
    downloads: formatNumber(item.downloadCount),
    lastAccess: formatDate(item.lastAccessedAt),
    type: getDocumentType(item.title),
  })), [topDocuments]);

  return (
    <main className={styles.page}>
      <section className={styles.headerRow}>
        <div>
          <Typography.Title level={1} className={styles.pageTitle}>
            SEARCH & ACCESS ANALYTICS
          </Typography.Title>
          <Typography.Text className={styles.pageSubtitle}>
            Monitor search behavior and document usage patterns.
          </Typography.Text>
        </div>
        <Space wrap>
          <Select
            value="all"
            disabled
            options={[{ value: 'all', label: 'All Departments' }]}
          />
          <Tabs
            className={styles.rangeTabs}
            activeKey={range}
            onChange={(key) => setRange(key)}
            items={[
              { key: 'today', label: 'Today' },
              { key: '7d', label: '7D' },
              { key: '30d', label: '30D' },
            ]}
          />
        </Space>
      </section>

      {analytics.isError && <Alert type="error" showIcon message={getApiErrorMessage(analytics.error)} />}

      <Row gutter={[16, 16]} className={styles.metricsGrid}>
        {metrics.map((metric) => (
          <Col xs={24} sm={12} lg={6} key={metric.title}>
            <Card className={styles.metricCard} loading={analytics.systemAccessQuery.isLoading}>
              <Space className={styles.metricLabel}>{metric.icon}<span>{metric.title}</span></Space>
              <div className={styles.metricValue}>{metric.value}</div>
              <Space className={metric.tone === 'success' ? styles.successText : styles.warningText}>
                {metric.tone === 'success' ? <RiseOutlined /> : <SwapOutlined />}
                <span>{metric.change}</span>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[24, 24]} className={styles.chartsGrid}>
        <Col xs={24} lg={16}>
          <Card className={styles.panel} title="Xu hướng tìm kiếm & truy cập" loading={analytics.systemAccessQuery.isLoading}>
            <TrendChart data={trendData} />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card className={styles.panel} title="Top từ khóa tìm kiếm phổ biến" loading={analytics.topSearchKeywordsQuery.isLoading}>
            <KeywordChart data={keywordData} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[24, 24]}>
        <Col xs={24} xl={12}>
          <Card className={styles.panel} title="Từ khóa tìm kiếm hàng đầu" extra={<span>Top 5</span>}>
            <Table
              rowKey="keyword"
              columns={keywordColumns}
              dataSource={keywords}
              loading={analytics.topSearchKeywordsQuery.isLoading || analytics.topSearchKeywordsQuery.isFetching}
              pagination={false}
              size="middle"
              scroll={{ x: true }}
            />
          </Card>
        </Col>
        <Col xs={24} xl={12}>
          <Card className={styles.panel} title="Tài liệu được truy cập nhiều nhất" extra={<span>Top 5</span>}>
            <Table
              rowKey="id"
              columns={documentColumns}
              dataSource={documents}
              loading={analytics.topDocumentsQuery.isLoading || analytics.topDocumentsQuery.isFetching}
              pagination={false}
              size="middle"
              scroll={{ x: true }}
            />
          </Card>
        </Col>
      </Row>
    </main>
  );
}
