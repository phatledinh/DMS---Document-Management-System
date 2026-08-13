import { DownloadOutlined, FileDoneOutlined, FilterOutlined, SearchOutlined } from '@ant-design/icons';
import { Alert, Button, Empty, Input, Pagination, Select, Skeleton, Tag } from 'antd';
import { useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { getDocumentVersionDownloadUrl } from '../../../api/documentApi.js';
import { getApiErrorMessage } from '../../../utils/response.js';
import { useMyDocumentVersions } from '../hooks/useMyDocumentVersions.js';
import styles from './VersionUser.module.css';

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / (1024 ** index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short' }).format(new Date(value));
}

function getDateRange(value) {
  if (!value) return {};
  const dateTo = new Date();
  const dateFrom = new Date(dateTo);
  dateFrom.setDate(dateFrom.getDate() - Number(value));
  return { dateFrom: dateFrom.toISOString(), dateTo: dateTo.toISOString() };
}

export default function VersionUser() {
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState();
  const [status, setStatus] = useState();
  const [range, setRange] = useState();
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const params = useMemo(() => ({
    keyword: keyword || undefined,
    category,
    status,
    ...getDateRange(range),
    page,
    size,
  }), [category, keyword, page, range, size, status]);
  const versionsQuery = useMyDocumentVersions(params);
  const versionRows = useMemo(() => versionsQuery.data?.content || [], [versionsQuery.data?.content]);
  const categoryOptions = useMemo(() => [
    ...[...new Set(versionRows.map((row) => row.categoryName).filter(Boolean))].map((value) => ({ value, label: value })),
  ], [versionRows]);

  async function downloadVersion(row) {
    try {
      const result = await getDocumentVersionDownloadUrl(row.documentId, row.versionId);
      window.open(result.url || result.presignedUrl || result.downloadUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.heroHeader}>
        <div>
          <span className={styles.eyebrow}>MH22</span>
          <h1>Version của tôi</h1>
          <p>Phiên bản tài liệu bạn đã tải lên.</p>
        </div>
        <span className={styles.summaryBadge}><FileDoneOutlined /> {versionsQuery.data?.totalElements || 0} bản ghi</span>
      </header>

      {versionsQuery.isError && <Alert type="error" showIcon message={getApiErrorMessage(versionsQuery.error)} />}

      <section className={styles.filterCard} aria-label="Bộ lọc version">
        <Input
          className={styles.searchInput}
          prefix={<SearchOutlined />}
          placeholder="Tìm theo tên tài liệu…"
          allowClear
          value={keyword}
          onChange={(event) => { setKeyword(event.target.value); setPage(0); }}
        />
        <Select
          className={styles.filterSelect}
          placeholder="Danh mục"
          suffixIcon={<FilterOutlined />}
          allowClear
          value={category}
          onChange={(value) => { setCategory(value); setPage(0); }}
          options={categoryOptions}
        />
        <Select
          className={styles.filterSelect}
          placeholder="Trạng thái"
          allowClear
          value={status}
          onChange={(value) => { setStatus(value); setPage(0); }}
          options={[
            { value: 'INDEXED', label: 'Sẵn sàng' },
            { value: 'ARCHIVED', label: 'Lưu trữ' },
            { value: 'PROCESSING', label: 'Đang xử lý' },
            { value: 'EXTRACTION_FAILED', label: 'Lỗi xử lý' },
          ]}
        />
        <Select
          className={styles.filterSelect}
          placeholder="Thời gian"
          allowClear
          value={range}
          onChange={(value) => { setRange(value); setPage(0); }}
          options={[
            { value: '30', label: '30 ngày qua' },
            { value: '90', label: '90 ngày qua' },
          ]}
        />
      </section>

      <section className={styles.tableCard}>
        {versionsQuery.isLoading ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : versionRows.length ? (
          <div className={styles.tableScroll}>
            <table className={styles.versionTable}>
              <thead>
                <tr>
                  <th>Tài liệu</th>
                  <th>Phiên bản</th>
                  <th>Ghi chú</th>
                  <th>Dung lượng</th>
                  <th>Ngày tải lên</th>
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {versionRows.map((row) => (
                  <tr key={`${row.documentId}-${row.versionId}`}>
                    <td>
                      <strong>{row.documentTitle}</strong>
                      <span>{row.categoryName || '—'} · {row.status}</span>
                    </td>
                    <td>
                      <div className={styles.versionCell}>
                        <span>{row.versionNumber}</span>
                        {row.current && <Tag className={styles.currentTag}>hiện hành</Tag>}
                      </div>
                    </td>
                    <td>{row.note || '—'}</td>
                    <td>{formatBytes(row.fileSize)}</td>
                    <td>{formatDate(row.uploadedAt)}</td>
                    <td>
                      <Button type="link" className={styles.downloadButton} icon={<DownloadOutlined />} onClick={() => downloadVersion(row)}>
                        Tải
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có version phù hợp bộ lọc" />
        )}
      </section>

      <footer className={styles.paginationFooter}>
        <span>Hiển thị {versionRows.length ? page * size + 1 : 0}–{page * size + versionRows.length} trong {versionsQuery.data?.totalElements || 0} bản ghi</span>
        <Pagination
          current={page + 1}
          pageSize={size}
          total={versionsQuery.data?.totalElements || 0}
          showSizeChanger
          onChange={(nextPage, nextSize) => {
            setPage(nextPage - 1);
            setSize(nextSize);
          }}
        />
      </footer>
    </main>
  );
}
