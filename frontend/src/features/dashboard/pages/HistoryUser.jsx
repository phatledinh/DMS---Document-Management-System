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
import { Button, Empty, Select } from 'antd';
import { useMemo, useState } from 'react';
import styles from './HistoryUser.module.css';

const historyItems = [
  {
    action: 'DOWNLOAD',
    category: 'Chính sách',
    requiredPermission: 'DOWNLOAD',
    result: 'MISSING_DOWNLOAD',
    resultType: 'denied',
    detail: 'Chính sách an toàn thông tin nội bộ',
    time: '07/08/2026 09:12',
  },
  {
    action: 'PREVIEW',
    category: 'ISO',
    requiredPermission: 'VIEW',
    result: 'Được phép',
    resultType: 'allowed',
    detail: 'Quy trình ISO 9001 — Kiểm soát chất lượng',
    time: '07/08/2026 08:40',
  },
  {
    action: 'SEARCH',
    category: 'Biểu mẫu',
    requiredPermission: 'SEARCH',
    result: 'Được phép',
    resultType: 'allowed',
    detail: 'Từ khoá: "biểu mẫu nhân sự"',
    time: '06/08/2026 16:05',
  },
  {
    action: 'UPLOAD',
    category: 'Biểu mẫu',
    requiredPermission: 'UPLOAD',
    result: 'Được phép',
    resultType: 'allowed',
    detail: 'Biểu mẫu đăng ký nhân sự mới',
    time: '05/08/2026 11:22',
  },
];

const actionIcons = {
  DOWNLOAD: <DownloadOutlined />,
  PREVIEW: <EyeOutlined />,
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

function buildOptions(values, allLabel) {
  return [
    { value: 'all', label: allLabel },
    ...values.map((value) => ({ value, label: value })),
  ];
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
            <span>{item.category}</span>
            <span>Quyền yêu cầu: {item.requiredPermission}</span>
          </div>
        </div>
        <time>{item.time}</time>
      </div>
    </article>
  );
}

export default function HistoryUser() {
  const [filters, setFilters] = useState(initialFilters);

  const filterOptions = useMemo(() => {
    const actions = [...new Set(historyItems.map((item) => item.action))];
    const categories = [...new Set(historyItems.map((item) => item.category))];
    const permissions = [...new Set(historyItems.map((item) => item.requiredPermission))];
    const dates = [...new Set(historyItems.map((item) => item.time.slice(0, 10)))];

    return {
      actions: buildOptions(actions, 'Tất cả hành động'),
      categories: buildOptions(categories, 'Tất cả danh mục'),
      permissions: buildOptions(permissions, 'Tất cả quyền'),
      results: [
        { value: 'all', label: 'Tất cả kết quả' },
        { value: 'allowed', label: 'Được phép' },
        { value: 'denied', label: 'Bị từ chối' },
      ],
      dates: buildOptions(dates, 'Tất cả thời gian'),
    };
  }, []);

  const filteredItems = useMemo(() => historyItems.filter((item) => {
    if (filters.action !== 'all' && item.action !== filters.action) return false;
    if (filters.category !== 'all' && item.category !== filters.category) return false;
    if (filters.permission !== 'all' && item.requiredPermission !== filters.permission) return false;
    if (filters.result !== 'all' && item.resultType !== filters.result) return false;
    if (filters.date !== 'all' && item.time.slice(0, 10) !== filters.date) return false;
    return true;
  }), [filters]);

  function updateFilter(name, value) {
    setFilters((current) => ({ ...current, [name]: value || 'all' }));
  }

  return (
    <main className={styles.page}>
      <header className={styles.heroHeader}>
        <div>
          <span className={styles.eyebrow}>MH23</span>
          <h1>Lịch sử thao tác của tôi</h1>
          <p>Mọi thao tác được ghi nhận kèm quyền yêu cầu và kết quả.</p>
        </div>
      </header>

      <section className={styles.filterPanel} aria-label="Bộ lọc lịch sử thao tác">
        <Select value={filters.action} onChange={(value) => updateFilter('action', value)} options={filterOptions.actions} />
        <Select value={filters.category} onChange={(value) => updateFilter('category', value)} options={filterOptions.categories} />
        <Select value={filters.permission} onChange={(value) => updateFilter('permission', value)} options={filterOptions.permissions} />
        <Select value={filters.result} onChange={(value) => updateFilter('result', value)} options={filterOptions.results} />
        <Select value={filters.date} onChange={(value) => updateFilter('date', value)} options={filterOptions.dates} />
        <Button icon={<ReloadOutlined />} onClick={() => setFilters(initialFilters)}>
          Đặt lại
        </Button>
      </section>

      <section className={styles.timelineCard}>
        {filteredItems.length ? (
          <div className={styles.timeline}>
            {filteredItems.map((item) => (
              <HistoryItem item={item} key={`${item.action}-${item.time}`} />
            ))}
          </div>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có thao tác phù hợp với bộ lọc" />
        )}
      </section>
    </main>
  );
}
