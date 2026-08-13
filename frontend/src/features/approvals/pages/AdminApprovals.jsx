import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  EyeOutlined,
  FileTextOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { Alert, Button, Input, Pagination, Select, Skeleton, Space, Tag } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { getApiErrorMessage } from '../../../utils/response.js';
import {
  useAdminApprovalSummary,
  useAdminApprovals,
  useApproveDocument,
  useRejectDocument,
} from '../hooks/useAdminApprovals.js';
import styles from './AdminApprovals.module.css';

const statusOptions = [
  { value: 'PENDING', label: 'Chờ duyệt' },
  { value: 'APPROVED', label: 'Đã duyệt' },
  { value: 'REJECTED', label: 'Từ chối' },
  { value: 'ALL', label: 'Tất cả' },
];

const statusMeta = {
  PENDING: { label: 'Chờ duyệt', color: 'gold', icon: <ClockCircleOutlined /> },
  APPROVED: { label: 'Đã duyệt', color: 'green', icon: <CheckCircleOutlined /> },
  REJECTED: { label: 'Từ chối', color: 'red', icon: <CloseCircleOutlined /> },
};

function StatusTag({ status }) {
  const meta = statusMeta[status] || statusMeta.PENDING;
  return <Tag color={meta.color} icon={meta.icon}>{meta.label}</Tag>;
}

function SummaryCard({ label, value, status }) {
  const meta = statusMeta[status] || statusMeta.PENDING;
  return (
    <article className={styles.summaryCard}>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <span className={styles.summaryIcon}>{meta.icon}</span>
    </article>
  );
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / (1024 ** index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function ApprovalListItem({ item, selected, onSelect }) {
  return (
    <button className={selected ? styles.approvalItemActive : styles.approvalItem} type="button" onClick={onSelect}>
      <span className={styles.fileIcon}><FileTextOutlined /></span>
      <span className={styles.itemContent}>
        <span className={styles.itemTitleRow}>
          <strong>{item.title}</strong>
          <StatusTag status={item.status} />
        </span>
        <span>{item.documentCode || `#${item.id}`} · {item.department || '—'} · {formatBytes(item.fileSize)}</span>
        <small>{item.submitter || '—'} · {formatDate(item.submittedAt)}</small>
      </span>
    </button>
  );
}

export default function AdminApprovals() {
  const [activeStatus, setActiveStatus] = useState('PENDING');
  const [keyword, setKeyword] = useState('');
  const [department, setDepartment] = useState();
  const [category, setCategory] = useState();
  const [selectedId, setSelectedId] = useState();
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const params = useMemo(() => ({
    status: activeStatus,
    keyword: keyword || undefined,
    department,
    category,
    page,
    size,
  }), [activeStatus, category, department, keyword, page, size]);
  const approvalsQuery = useAdminApprovals(params);
  const summaryQuery = useAdminApprovalSummary();
  const approveMutation = useApproveDocument();
  const rejectMutation = useRejectDocument();
  const approvalItems = useMemo(() => approvalsQuery.data?.content || [], [approvalsQuery.data?.content]);

  useEffect(() => {
    if (!selectedId && approvalItems.length) {
      setSelectedId(approvalItems[0].id);
    }
    if (selectedId && approvalItems.length && !approvalItems.some((item) => item.id === selectedId)) {
      setSelectedId(approvalItems[0].id);
    }
  }, [approvalItems, selectedId]);

  const departments = useMemo(() => [...new Set(approvalItems.map((item) => item.department).filter(Boolean))], [approvalItems]);
  const categories = useMemo(() => [...new Set(approvalItems.map((item) => item.category).filter(Boolean))], [approvalItems]);
  const selectedItem = approvalItems.find((item) => item.id === selectedId) || approvalItems[0];
  const stats = summaryQuery.data || { pending: 0, approved: 0, rejected: 0 };
  const decisionPending = approveMutation.isPending || rejectMutation.isPending;

  async function approveSelected() {
    try {
      await approveMutation.mutateAsync(selectedItem.id);
      toast.success('Đã phê duyệt tài liệu.');
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  }

  async function rejectSelected() {
    try {
      await rejectMutation.mutateAsync({ documentId: selectedItem.id, reason: 'Rejected from approvals page' });
      toast.success('Đã từ chối tài liệu.');
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.pageHeader}>
        <div>
          <span>MH24</span>
          <h1>Duyệt bài đăng của người dùng</h1>
          <p>Kiểm tra tài liệu người dùng gửi lên, phê duyệt để xuất bản hoặc trả lại kèm lý do.</p>
        </div>
      </section>

      {(approvalsQuery.isError || summaryQuery.isError) && (
        <Alert type="error" showIcon message={getApiErrorMessage(approvalsQuery.error || summaryQuery.error)} />
      )}

      <section className={styles.summaryGrid}>
        <SummaryCard label="Đang chờ duyệt" value={stats.pending} status="PENDING" />
        <SummaryCard label="Đã duyệt" value={stats.approved} status="APPROVED" />
        <SummaryCard label="Đã từ chối" value={stats.rejected} status="REJECTED" />
      </section>

      <section className={styles.statusTabs}>
        {statusOptions.map((option) => (
          <button
            key={option.value}
            className={activeStatus === option.value ? styles.tabActive : styles.tab}
            type="button"
            onClick={() => { setActiveStatus(option.value); setPage(0); setSelectedId(undefined); }}
          >
            {option.label}
          </button>
        ))}
      </section>

      <section className={styles.filters}>
        <Input
          allowClear
          prefix={<SearchOutlined />}
          placeholder="Tìm theo tiêu đề, mã tài liệu hoặc người gửi…"
          value={keyword}
          onChange={(event) => { setKeyword(event.target.value); setPage(0); }}
        />
        <Select
          allowClear
          placeholder="Phòng ban"
          value={department}
          onChange={(value) => { setDepartment(value); setPage(0); }}
          options={departments.map((value) => ({ value, label: value }))}
        />
        <Select
          allowClear
          placeholder="Danh mục"
          value={category}
          onChange={(value) => { setCategory(value); setPage(0); }}
          options={categories.map((value) => ({ value, label: value }))}
        />
      </section>

      <section className={styles.contentGrid}>
        <div className={styles.listPanel}>
          {approvalsQuery.isLoading ? (
            <Skeleton active paragraph={{ rows: 8 }} />
          ) : approvalItems.length ? (
            <>
              {approvalItems.map((item) => (
                <ApprovalListItem
                  key={item.id}
                  item={item}
                  selected={selectedItem?.id === item.id}
                  onSelect={() => setSelectedId(item.id)}
                />
              ))}
              <Pagination
                current={page + 1}
                pageSize={size}
                total={approvalsQuery.data?.totalElements || 0}
                showSizeChanger
                onChange={(nextPage, nextSize) => {
                  setPage(nextPage - 1);
                  setSize(nextSize);
                  setSelectedId(undefined);
                }}
              />
            </>
          ) : (
            <div className={styles.emptyState}>Không có bài đăng phù hợp bộ lọc.</div>
          )}
        </div>

        {selectedItem && (
          <aside className={styles.detailPanel}>
            <div className={styles.detailHeader}>
              <div>
                <span>{selectedItem.documentCode || `#${selectedItem.id}`}</span>
                <h2>{selectedItem.title}</h2>
              </div>
              <StatusTag status={selectedItem.status} />
            </div>

            <dl className={styles.detailList}>
              <div><dt>Người gửi</dt><dd>{selectedItem.submitter || '—'}</dd></div>
              <div><dt>Thời gian gửi</dt><dd>{formatDate(selectedItem.submittedAt)}</dd></div>
              <div><dt>Phòng ban</dt><dd>{selectedItem.department || '—'}</dd></div>
              <div><dt>Danh mục</dt><dd>{selectedItem.category || '—'}</dd></div>
              <div><dt>Định dạng</dt><dd>{selectedItem.fileType} · {formatBytes(selectedItem.fileSize)}</dd></div>
              <div><dt>Tags</dt><dd>{selectedItem.tags?.join(', ') || '—'}</dd></div>
            </dl>

            <section className={styles.extractBox}>
              <h3>Nội dung trích xuất</h3>
              <p>{selectedItem.summary || 'Chưa có nội dung trích xuất.'}</p>
            </section>

            <Space wrap className={styles.detailActions}>
              <Link to={`/documents/${selectedItem.id}`}><Button icon={<EyeOutlined />}>Xem trước</Button></Link>
              <Button danger disabled={selectedItem.status !== 'PENDING' || decisionPending} loading={rejectMutation.isPending} onClick={rejectSelected}>Từ chối</Button>
              <Button type="primary" disabled={selectedItem.status !== 'PENDING' || decisionPending} loading={approveMutation.isPending} onClick={approveSelected}>Phê duyệt</Button>
            </Space>
          </aside>
        )}
      </section>
    </main>
  );
}
