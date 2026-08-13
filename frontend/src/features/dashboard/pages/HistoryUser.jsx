import {
  CheckCircleOutlined,
  DownloadOutlined,
  EyeOutlined,
  HistoryOutlined,
  ReloadOutlined,
  SearchOutlined,
  UploadOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { Alert, Button, Empty, Pagination, Select, Skeleton } from 'antd';
import { useMemo, useState } from 'react';
import { getApiErrorMessage } from '../../../utils/response.js';
import { useUserActivityHistory } from '../hooks/useUserActivityHistory.js';
import styles from './HistoryUser.module.css';

const actionIcons = {
  DOWNLOAD: <DownloadOutlined />,
  VERSION_DOWNLOAD: <DownloadOutlined />,
  PREVIEW: <EyeOutlined />,
  VIEW: <EyeOutlined />,
  SEARCH: <SearchOutlined />,
  UPLOAD: <UploadOutlined />,
};

const initialFilters = {
  action: 'all',
  category: 'all',
  permission: 'all',
  result: 'all',
  date: 'all',
};

const actionOptions = [
  { value: 'all', label: 'Tất cả hành động' },
  { value: 'DOWNLOAD', label: 'DOWNLOAD' },
  { value: 'VERSION_DOWNLOAD', label: 'VERSION_DOWNLOAD' },
  { value: 'PREVIEW', label: 'PREVIEW' },
  { value: 'VIEW', label: 'VIEW' },
  { value: 'SEARCH', label: 'SEARCH' },
  { value: 'UPLOAD', label: 'UPLOAD' },
];

const permissionOptions = [
  { value: 'all', label: 'Tất cả quyền' },
  { value: 'VIEW', label: 'VIEW' },
  { value: 'DOWNLOAD', label: 'DOWNLOAD' },
  { value: 'SEARCH', label: 'SEARCH' },
  { value: 'UPLOAD', label: 'UPLOAD' },
];

const resultOptions = [
  { value: 'all', label: 'Tất cả kết quả' },
  { value: 'allowed', label: 'Được phép' },
  { value: 'denied', label: 'Bị từ chối' },
];

const dateOptions = [
  { value: 'all', label: 'Tất cả thời gian' },
  { value: '7', label: '7 ngày qua' },
  { value: '30', label: '30 ngày qua' },
  { value: '90', label: '90 ngày qua' },
];

function getDateRange(value) {
  if (value === 'all') return {};
  const days = Number(value);
  const dateTo = new Date();
  const dateFrom = new Date(dateTo);
  dateFrom.setDate(dateFrom.getDate() - days);
  return { dateFrom: dateFrom.toISOString(), dateTo: dateTo.toISOString() };
}

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function HistoryItem({ item }) {
  const isDenied = item.resultType === 'denied';

  return (
    <article className={styles.timelineItem}>
      <span className={`${styles.timelineDot} ${isDenied ? styles.denied : styles.allowed}`} />
      <div className={styles.timelineContent}>
        <div className={styles.timelineMain}>
          <div className={styles.actionRow}>
            <span className={styles.actionLabel}>
              {actionIcons[item.action] || <HistoryOutlined />}
              {item.action}
            </span>
            <span className={`${styles.resultPill} ${isDenied ? styles.denied : styles.allowed}`}>
              {isDenied ? <WarningOutlined /> : <CheckCircleOutlined />}
              {item.result}
            </span>
          </div>
          <p>{item.detail}</p>
          <div className={styles.metaRow}>
            <span>{item.category || '—'}</span>
            <span>Quyền yêu cầu: {item.requiredPermission || '—'}</span>
          </div>
        </div>
        <time>{formatDate(item.createdAt)}</time>
      </div>
    </article>
  );
}

export default function HistoryUser() {
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const params = useMemo(() => ({
    action: filters.action,
    category: filters.category,
    permission: filters.permission,
    result: filters.result,
    ...getDateRange(filters.date),
    page,
    size,
  }), [filters, page, size]);
  const historyQuery = useUserActivityHistory(params);
  const items = useMemo(() => historyQuery.data?.content || [], [historyQuery.data?.content]);

  const categoryOptions = useMemo(() => [
    { value: 'all', label: 'Tất cả danh mục' },
    ...[...new Set(items.map((item) => item.category).filter(Boolean))].map((value) => ({ value, label: value })),
  ], [items]);

  function updateFilter(name, value) {
    setFilters((current) => ({ ...current, [name]: value || 'all' }));
    setPage(0);
  }

  return (
    <main className={styles.page}>
      <header className={styles.heroHeader}>
        <div>
          <h1>Lịch sử thao tác của tôi</h1>
          <p>Mọi thao tác được ghi nhận kèm quyền yêu cầu và kết quả.</p>
        </div>
      </header>

      {historyQuery.isError && <Alert type="error" showIcon message={getApiErrorMessage(historyQuery.error)} />}

      <section className={styles.filterPanel} aria-label="Bộ lọc lịch sử thao tác">
        <Select value={filters.action} onChange={(value) => updateFilter('action', value)} options={actionOptions} />
        <Select value={filters.category} onChange={(value) => updateFilter('category', value)} options={categoryOptions} />
        <Select value={filters.permission} onChange={(value) => updateFilter('permission', value)} options={permissionOptions} />
        <Select value={filters.result} onChange={(value) => updateFilter('result', value)} options={resultOptions} />
        <Select value={filters.date} onChange={(value) => updateFilter('date', value)} options={dateOptions} />
        <Button icon={<ReloadOutlined />} onClick={() => { setFilters(initialFilters); setPage(0); }}>
          Đặt lại
        </Button>
      </section>

      <section className={styles.timelineCard}>
        {historyQuery.isLoading ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : items.length ? (
          <>
            <div className={styles.timeline}>
              {items.map((item) => (
                <HistoryItem item={item} key={item.id} />
              ))}
            </div>
            <Pagination
              current={page + 1}
              pageSize={size}
              total={historyQuery.data?.totalElements || 0}
              showSizeChanger
              onChange={(nextPage, nextSize) => {
                setPage(nextPage - 1);
                setSize(nextSize);
              }}
            />
          </>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có thao tác phù hợp với bộ lọc" />
        )}
      </section>
    </main>
  );
}
