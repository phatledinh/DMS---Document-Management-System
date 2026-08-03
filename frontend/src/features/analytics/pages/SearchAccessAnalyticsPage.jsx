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
import { Card, Col, Row, Select, Space, Table, Tabs, Typography } from 'antd';
import styles from './SearchAccessAnalyticsPage.module.css';

const trendData = [
  { label: '1', searches: 300, accesses: 200 },
  { label: '4', searches: 450, accesses: 350 },
  { label: '7', searches: 400, accesses: 300 },
  { label: '10', searches: 600, accesses: 500 },
  { label: '13', searches: 550, accesses: 450 },
  { label: '16', searches: 800, accesses: 700 },
  { label: '19', searches: 700, accesses: 600 },
  { label: '22', searches: 900, accesses: 800 },
  { label: '25', searches: 850, accesses: 750 },
  { label: '28', searches: 1100, accesses: 900 },
  { label: '30', searches: 1050, accesses: 850 },
];

const keywordData = [
  { keyword: 'Q3 Report', value: 1245 },
  { keyword: 'Handbook', value: 982 },
  { keyword: 'Marketing', value: 876 },
  { keyword: 'Contracts', value: 654 },
  { keyword: 'Security', value: 432 },
];

const metrics = [
  {
    title: 'Total Searches',
    value: '12,450',
    change: '+8.2% vs last month',
    tone: 'success',
    icon: <SearchOutlined />,
  },
  {
    title: 'Avg. Search Time',
    value: '1.2s',
    change: '-0.3s vs last month',
    tone: 'success',
    icon: <ClockCircleOutlined />,
  },
  {
    title: 'Total Previews',
    value: '45,892',
    change: '0% vs last month',
    tone: 'warning',
    icon: <EyeOutlined />,
  },
  {
    title: 'Total Downloads',
    value: '8,304',
    change: '+12.5% vs last month',
    tone: 'success',
    icon: <DownloadOutlined />,
  },
];

const keywords = [
  { keyword: 'Q3 Financial Report', count: '1,245', avgResults: '4.2', avgTime: '0.8s' },
  { keyword: 'Employee Handbook', count: '982', avgResults: '1.0', avgTime: '0.5s' },
  { keyword: 'Marketing Assets 2024', count: '876', avgResults: '12.5', avgTime: '1.2s' },
  { keyword: 'Vendor Contracts', count: '654', avgResults: '8.1', avgTime: '1.5s' },
  { keyword: 'Security Policy', count: '432', avgResults: '2.4', avgTime: '0.6s' },
];

const documents = [
  {
    title: 'Q3_2024_Financial_Summary.pdf',
    previews: '3,450',
    downloads: '1,205',
    lastAccess: '2 mins ago',
    type: 'pdf',
  },
  {
    title: 'Employee_Handbook_v2.docx',
    previews: '2,890',
    downloads: '450',
    lastAccess: '15 mins ago',
    type: 'doc',
  },
  {
    title: 'Marketing_Budget_2025.xlsx',
    previews: '1,750',
    downloads: '890',
    lastAccess: '1 hour ago',
    type: 'sheet',
  },
  {
    title: 'Acme_Corp_MSA_Signed.pdf',
    previews: '1,200',
    downloads: '1,150',
    lastAccess: '3 hours ago',
    type: 'pdf',
  },
  {
    title: 'IT_Security_Guidelines.docx',
    previews: '980',
    downloads: '210',
    lastAccess: 'Yesterday',
    type: 'doc',
  },
];

function createLinePath(points, key, width, height, padding, maxValue) {
  return points
    .map((point, index) => {
      const x = padding + (index * (width - padding * 2)) / (points.length - 1);
      const y = height - padding - (point[key] / maxValue) * (height - padding * 2);
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
}

function TrendChart() {
  const width = 720;
  const height = 300;
  const padding = 36;
  const maxValue = 1200;
  const searchesPath = createLinePath(trendData, 'searches', width, height, padding, maxValue);
  const accessesPath = createLinePath(trendData, 'accesses', width, height, padding, maxValue);
  const areaPath = `${searchesPath} L ${width - padding} ${height - padding} L ${padding} ${height - padding} Z`;

  return (
    <div className={styles.chartFrame}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Xu hướng tìm kiếm và truy cập trong 30 ngày">
        <defs>
          <linearGradient id="searchArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#005bbf" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#005bbf" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0, 300, 600, 900, 1200].map((tick) => {
          const y = height - padding - (tick / maxValue) * (height - padding * 2);
          return <line key={tick} x1={padding} x2={width - padding} y1={y} y2={y} className={styles.gridLine} />;
        })}
        <path d={areaPath} fill="url(#searchArea)" />
        <path d={searchesPath} className={styles.searchLine} />
        <path d={accessesPath} className={styles.accessLine} />
        {trendData.map((point, index) => {
          const x = padding + (index * (width - padding * 2)) / (trendData.length - 1);
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

function KeywordChart() {
  const maxValue = Math.max(...keywordData.map((item) => item.value));

  return (
    <div className={styles.barChart} role="img" aria-label="Top từ khóa tìm kiếm phổ biến">
      {keywordData.map((item) => (
        <div className={styles.barItem} key={item.keyword}>
          <div className={styles.barTrack}>
            <div className={styles.bar} style={{ height: `${(item.value / maxValue) * 100}%` }}>
              <span>{item.value}</span>
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
            defaultValue="all"
            options={[
              { value: 'all', label: 'All Departments' },
              { value: 'finance', label: 'Finance' },
              { value: 'hr', label: 'HR' },
              { value: 'engineering', label: 'Engineering' },
            ]}
          />
          <Tabs
            className={styles.rangeTabs}
            defaultActiveKey="30d"
            items={[
              { key: 'today', label: 'Today' },
              { key: '7d', label: '7D' },
              { key: '30d', label: '30D' },
              { key: 'custom', label: 'Custom' },
            ]}
          />
        </Space>
      </section>

      <Tabs
        className={styles.sectionTabs}
        defaultActiveKey="overview"
        items={[
          { key: 'overview', label: 'Tổng quan' },
          { key: 'search', label: 'Phân tích Tìm kiếm' },
          { key: 'access', label: 'Truy cập tài liệu' },
        ]}
      />

      <Row gutter={[16, 16]} className={styles.metricsGrid}>
        {metrics.map((metric) => (
          <Col xs={24} sm={12} lg={6} key={metric.title}>
            <Card className={styles.metricCard}>
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
          <Card className={styles.panel} title="Xu hướng tìm kiếm & truy cập">
            <TrendChart />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card className={styles.panel} title="Top từ khóa tìm kiếm phổ biến">
            <KeywordChart />
          </Card>
        </Col>
      </Row>

      <Row gutter={[24, 24]}>
        <Col xs={24} xl={12}>
          <Card className={styles.panel} title="Từ khóa tìm kiếm hàng đầu" extra={<a>View All</a>}>
            <Table
              rowKey="keyword"
              columns={keywordColumns}
              dataSource={keywords}
              pagination={false}
              size="middle"
              scroll={{ x: true }}
            />
          </Card>
        </Col>
        <Col xs={24} xl={12}>
          <Card className={styles.panel} title="Tài liệu được truy cập nhiều nhất" extra={<a>View All</a>}>
            <Table
              rowKey="title"
              columns={documentColumns}
              dataSource={documents}
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