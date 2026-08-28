import { DeleteOutlined, DownloadOutlined, EditOutlined, FileDoneOutlined, FilterOutlined, HistoryOutlined, SearchOutlined } from '@ant-design/icons';
import { Alert, Button, Empty, Input, Modal, Pagination, Select, Skeleton, Space, Tag, Tooltip } from 'antd';
import { useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import {
  deleteDocumentVersion,
  getDocumentVersionDownloadUrl,
  restoreDocumentVersion,
  updateDocumentVersion,
} from '../../../api/documentApi.js';
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

function getVersionStatusMessage(status) {
  switch (status) {
    case 'PROCESSING': return 'Đang xử lý, không thể khôi phục thêm.';
    case 'PENDING_APPROVAL': return 'Đã gửi yêu cầu khôi phục, đang chờ admin duyệt.';
    case 'REJECTED': return 'Phiên bản đã bị từ chối, không thể khôi phục.';
    case 'AWAITING_UPLOAD': return 'Phiên bản chưa tải lên hoàn tất.';
    case 'EXTRACTION_FAILED': return 'Phiên bản xử lý thất bại, không thể khôi phục.';
    default: return '';
  }
}

function getDateRange(value) {
  if (!value) return {};
  const dateTo = new Date();
  const dateFrom = new Date(dateTo);
  dateFrom.setDate(dateFrom.getDate() - Number(value));
  return { dateFrom: dateFrom.toISOString(), dateTo: dateTo.toISOString() };
}

export default function VersionUser() {
  const [modal, modalContextHolder] = Modal.useModal();
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState();
  const [status, setStatus] = useState();
  const [range, setRange] = useState();
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [editingVersion, setEditingVersion] = useState(null);
  const [editVersionNumber, setEditVersionNumber] = useState('');
  const [editChangelog, setEditChangelog] = useState('');
  const [actionKey, setActionKey] = useState('');
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

  function makeCurrent(row) {
    modal.confirm({
      title: 'Đặt phiên bản này làm hiện hành?',
      content: `Phiên bản ${row.versionNumber} sẽ thay thế phiên bản hiện hành của tài liệu.`,
      okText: 'Đặt làm hiện hành',
      cancelText: 'Hủy',
      onOk: async () => {
        const key = `restore-${row.versionId}`;
        setActionKey(key);
        try {
          await restoreDocumentVersion(row.documentId, row.versionId);
          toast.success('Đã gửi yêu cầu khôi phục. Hệ thống đang xử lý và sẽ chờ admin duyệt nếu cần.');
          await versionsQuery.refetch();
        } catch (error) {
          toast.error(getApiErrorMessage(error));
          throw error;
        } finally {
          setActionKey('');
        }
      },
    });
  }

  function openEdit(row) {
    setEditingVersion(row);
    setEditVersionNumber(row.versionNumber || '');
    setEditChangelog(row.note || '');
  }

  async function saveVersionInfo() {
    if (!editingVersion) return;
    if (!/^\d+(\.\d+){1,2}$/.test(editVersionNumber.trim()) || !editChangelog.trim()) {
      toast.error('Vui lòng nhập số phiên bản hợp lệ và ghi chú thay đổi.');
      return;
    }
    setActionKey(`edit-${editingVersion.versionId}`);
    try {
      await updateDocumentVersion(editingVersion.documentId, editingVersion.versionId, {
        versionNumber: editVersionNumber.trim(),
        changelog: editChangelog.trim(),
      });
      toast.success('Đã cập nhật thông tin phiên bản');
      setEditingVersion(null);
      await versionsQuery.refetch();
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setActionKey('');
    }
  }

  function removeVersion(row) {
    modal.confirm({
      title: 'Xóa phiên bản?',
      content: `Phiên bản ${row.versionNumber} và file tương ứng sẽ bị xóa vĩnh viễn.`,
      okText: 'Xóa',
      okType: 'danger',
      cancelText: 'Hủy',
      onOk: async () => {
        const key = `delete-${row.versionId}`;
        setActionKey(key);
        try {
          await deleteDocumentVersion(row.documentId, row.versionId);
          toast.success('Đã xóa phiên bản');
          await versionsQuery.refetch();
        } catch (error) {
          toast.error(getApiErrorMessage(error));
          throw error;
        } finally {
          setActionKey('');
        }
      },
    });
  }

  return (
    <main className={styles.page}>
      {modalContextHolder}
      <header className={styles.heroHeader}>
        <div>
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
                      {row.canView === false && <Tag color="warning">Không còn quyền truy cập</Tag>}
                    </td>
                    <td>
                      <div className={styles.versionCell}>
                        <span>{row.versionNumber}</span>
                        {row.current && <Tag className={styles.currentTag}>hiện hành</Tag>}
                        {!row.current && getVersionStatusMessage(row.status) && (
                          <Tag color={row.status === 'REJECTED' ? 'red' : 'gold'}>{getVersionStatusMessage(row.status)}</Tag>
                        )}
                      </div>
                    </td>
                    <td>{row.note || '—'}</td>
                    <td>{formatBytes(row.fileSize)}</td>
                    <td>{formatDate(row.uploadedAt)}</td>
                    <td>
                      <Space size={4} wrap>
                        <Button type="link" className={styles.actionButton} icon={<DownloadOutlined />} disabled={row.canView === false} onClick={() => downloadVersion(row)}>Tải</Button>
                        {!row.canView && <Tooltip title="Bạn không còn quyền VIEW trên danh mục này"><span><Button type="link" disabled>Không thể truy cập</Button></span></Tooltip>}
                        {!row.canView ? null : (
                          <>
                            {!row.current && row.status === 'INDEXED' && (
                              <Button type="link" className={styles.actionButton} icon={<HistoryOutlined />} loading={actionKey === `restore-${row.versionId}`} onClick={() => makeCurrent(row)}>Khôi phục</Button>
                            )}
                            <Button type="link" className={styles.actionButton} icon={<EditOutlined />} onClick={() => openEdit(row)}>Sửa</Button>
                            {!row.current && (
                              <Button danger type="link" className={styles.actionButton} icon={<DeleteOutlined />} loading={actionKey === `delete-${row.versionId}`} onClick={() => removeVersion(row)}>Xóa</Button>
                            )}
                          </>
                        )}
                      </Space>
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

      <Modal
        title="Sửa thông tin phiên bản"
        open={Boolean(editingVersion)}
        okText="Lưu thay đổi"
        cancelText="Hủy"
        confirmLoading={actionKey === `edit-${editingVersion?.versionId}`}
        onOk={saveVersionInfo}
        onCancel={() => setEditingVersion(null)}
      >
        <div className={styles.editForm}>
          <label htmlFor="edit-version-number">Số phiên bản</label>
          <Input id="edit-version-number" value={editVersionNumber} onChange={(event) => setEditVersionNumber(event.target.value)} placeholder="Ví dụ: 1.0 hoặc 1.0.1" />
          <label htmlFor="edit-version-note">Ghi chú thay đổi</label>
          <Input.TextArea id="edit-version-note" rows={4} value={editChangelog} onChange={(event) => setEditChangelog(event.target.value)} />
        </div>
      </Modal>
    </main>
  );
}
