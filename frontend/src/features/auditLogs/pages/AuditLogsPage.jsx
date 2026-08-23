import { CalendarOutlined, FilterOutlined, SearchOutlined } from '@ant-design/icons';
import { Button, DatePicker, Input, Select, Space, Table, Tag } from 'antd';
import { useMemo, useState } from 'react';
import { useAdminLogs } from '../hooks/useAdminLogs.js';
import styles from './AuditLogsPage.module.css';

const { RangePicker } = DatePicker;

const tabs = [
  { label: 'Tất cả', value: 'ALL' },
  { label: 'Nhật ký hệ thống', value: 'AUDIT' },
  { label: 'Truy cập tài liệu', value: 'ACCESS' },
  { label: 'Lịch sử tìm kiếm', value: 'SEARCH' },
];

const actionOptions = [
  'LOGIN', 'UPLOAD', 'MOVE', 'ARCHIVE', 'DELETE', 'RESTORE', 'PURGE', 'VIEW', 'PREVIEW', 'DOWNLOAD', 'VERSION_DOWNLOAD', 'SEARCH',
].map((value) => ({ value, label: value }));

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value));
}

function logTypeColor(type) {
  if (type === 'ACCESS') return 'blue';
  if (type === 'SEARCH') return 'purple';
  return 'default';
}

export default function AuditLogsPage() {
  const [activeTab, setActiveTab] = useState('ALL');
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [filters, setFilters] = useState({});
  const [draftFilters, setDraftFilters] = useState({});

  const params = useMemo(() => ({
    ...filters,
    logType: activeTab,
    page,
    size,
  }), [activeTab, filters, page, size]);

  const logsQuery = useAdminLogs(params);
  const logs = logsQuery.data?.content || [];

  const columns = [
    {
      title: 'Thời gian',
      dataIndex: 'createdAt',
      width: 190,
      render: formatDate,
    },
    {
      title: 'Loại',
      dataIndex: 'logType',
      width: 110,
      render: (type) => <Tag color={logTypeColor(type)}>{type}</Tag>,
    },
    {
      title: 'Người thực hiện',
      dataIndex: 'actorName',
      render: (name, record) => name || 'Hệ thống / Ẩn danh',
    },
    {
      title: 'Hành động',
      dataIndex: 'action',
      width: 160,
      render: (action, record) => (
        <Space direction="vertical" size={0}>
          <strong>{action}</strong>
          {record.accessGranted === false && <Tag color="red">DENIED</Tag>}
        </Space>
      ),
    },
    {
      title: 'Đối tượng / Chi tiết',
      render: (_, record) => {
        if (record.logType === 'SEARCH') {
          return <span>Từ khóa: <strong>{record.keyword || '—'}</strong> ({record.resultCount || 0} kết quả)</span>;
        }
        if (record.logType === 'ACCESS') {
          return <span>Tài liệu: <strong>{record.documentTitle || record.documentSlug || 'Không xác định'}</strong>{record.denialReason ? ` — ${record.denialReason}` : ''}</span>;
        }
        let targetName = null;
        try {
          const payload = record.newValue ? JSON.parse(record.newValue) : (record.oldValue ? JSON.parse(record.oldValue) : null);
          targetName = payload?.name || payload?.title;
        } catch (e) {
          // ignore
        }
        
        if (targetName) {
          return <span>{record.targetType || '—'} <strong>{targetName}</strong></span>;
        }
        return <span>{record.targetType || '—'} {record.targetId ? `(ID: ${record.targetId})` : ''}</span>;
      },
    },
    {
      title: 'IP',
      dataIndex: 'ipAddress',
      width: 150,
      render: (value) => value || '—',
    },
  ];

  function applyFilters() {
    setFilters(draftFilters);
    setPage(0);
  }

  function updateDateRange(range) {
    setDraftFilters((current) => ({
      ...current,
      dateFrom: range?.[0]?.startOf('day').toISOString(),
      dateTo: range?.[1]?.endOf('day').toISOString(),
    }));
  }

  return (
    <div className={styles.page}>
      <main className={styles.pageBody}>
        <div className={styles.container}>
          <section className={styles.pageHeader}>
            <h1>NHẬT KÝ HỆ THỐNG</h1>
            <p>AUDIT & ACCESS LOG</p>
          </section>

          <div className={styles.tabs}>
            {tabs.map((tab) => (
              <button
                key={tab.value}
                className={activeTab === tab.value ? styles.tabActive : styles.tab}
                type="button"
                onClick={() => { setActiveTab(tab.value); setPage(0); }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <section className={styles.filters}>
            <div className={styles.dateGroup}><CalendarOutlined /><RangePicker onChange={updateDateRange} /></div>
            <Select
              allowClear
              placeholder="Hành động"
              options={actionOptions}
              onChange={(value) => setDraftFilters((current) => ({ ...current, action: value }))}
            />
            <label className={styles.detailSearch}>
              <SearchOutlined />
              <input
                placeholder="Từ khóa / chi tiết..."
                type="text"
                onChange={(event) => setDraftFilters((current) => ({ ...current, keyword: event.target.value || undefined }))}
              />
            </label>
            <Button className={styles.filterButton} icon={<FilterOutlined />} onClick={applyFilters}>Lọc</Button>
          </section>

          <section className={styles.tablePanel}>
            <Table
              rowKey={(record) => `${record.logType}-${record.id}`}
              columns={columns}
              dataSource={logs}
              loading={logsQuery.isLoading || logsQuery.isFetching}
              pagination={{
                current: page + 1,
                pageSize: size,
                total: logsQuery.data?.totalElements || 0,
                showSizeChanger: true,
                onChange: (nextPage, nextSize) => {
                  setPage(nextPage - 1);
                  setSize(nextSize);
                },
              }}
              scroll={{ x: 900 }}
            />
          </section>
        </div>
      </main>
    </div>
  );
}
