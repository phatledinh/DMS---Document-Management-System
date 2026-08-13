import {
  EyeOutlined,
  FileImageOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  HistoryOutlined,
  SyncOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { Alert, Button, Space, Table, Tag } from 'antd';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { getApiErrorMessage } from '../../../utils/response.js';
import { useRetryDocumentIndexing } from '../../documents/hooks/useDocumentLifecycle.js';
import { useProcessingErrors } from '../hooks/useProcessingErrors.js';
import styles from './ProcessingErrorsPage.module.css';

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function FileIcon({ type }) {
  const normalized = type?.toUpperCase();
  if (normalized === 'PDF') return <span className={styles.pdfIcon}><FilePdfOutlined /></span>;
  if (['PNG', 'JPG', 'JPEG'].includes(normalized)) return <span className={styles.imageIcon}><FileImageOutlined /></span>;
  return <span className={styles.docIcon}><FileTextOutlined /></span>;
}

export default function ProcessingErrorsPage() {
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const errorsQuery = useProcessingErrors({ page, size });
  const retryMutation = useRetryDocumentIndexing();
  const rows = useMemo(() => errorsQuery.data?.content || [], [errorsQuery.data?.content]);

  async function retryDocument(documentId) {
    try {
      await retryMutation.mutateAsync(documentId);
      toast.success('Đã gửi yêu cầu retry indexing.');
    } catch (error) {
      toast.error(getApiErrorMessage(error));
      throw error;
    }
  }

  async function retryCurrentPage() {
    const documentIds = rows.map((row) => row.documentId).filter(Boolean);
    if (!documentIds.length) {
      toast.info('Không có tài liệu lỗi trên trang hiện tại.');
      return;
    }
    const results = await Promise.allSettled(documentIds.map(retryDocument));
    const failed = results.filter((result) => result.status === 'rejected').length;
    if (failed) {
      toast.warn(`Đã retry ${documentIds.length - failed}/${documentIds.length} tài liệu.`);
    }
  }

  const summaryCards = useMemo(() => {
    const total = errorsQuery.data?.totalElements || 0;
    const extractionFailed = rows.filter((row) => row.status === 'EXTRACTION_FAILED').length;
    const retrying = rows.filter((row) => (row.retryCount || 0) > 0).length;
    return [
      { label: 'Tổng số lỗi', value: total, helper: 'tài liệu', tone: 'error', icon: <WarningOutlined /> },
      { label: 'Đã retry', value: retrying, helper: 'trong trang', tone: 'warning', icon: <HistoryOutlined /> },
      { label: 'Extraction failed', value: extractionFailed, helper: 'trong trang', tone: 'tertiary', icon: <FileTextOutlined /> },
    ];
  }, [errorsQuery.data?.totalElements, rows]);

  const columns = [
    {
      title: 'Tài liệu',
      dataIndex: 'title',
      render: (title, record) => <div className={styles.titleCell}><FileIcon type={record.fileType} /><strong>{title}</strong></div>,
    },
    {
      title: 'Loại',
      dataIndex: 'fileType',
      width: 90,
      render: (value) => <span className={styles.monoCell}>{value || '—'}</span>,
    },
    {
      title: 'Trạng thái lỗi',
      dataIndex: 'status',
      width: 180,
      render: (value) => {
        if (value === 'PROCESSING') return <Tag color="processing">Đang xử lý</Tag>;
        return <Tag color="red">{value || 'FAILED'}</Tag>;
      },
    },
    {
      title: 'Retry',
      dataIndex: 'retryCount',
      width: 100,
      render: (value) => <span className={styles.monoCell}>{value || 0}</span>,
    },
    {
      title: 'Thông báo lỗi',
      dataIndex: 'errorMessage',
      ellipsis: true,
      render: (value) => value || '—',
    },
    {
      title: 'Cập nhật',
      dataIndex: 'updatedAt',
      width: 170,
      render: formatDate,
    },
    {
      title: 'Thao tác',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button 
            size="small" 
            type="primary" 
            ghost 
            icon={<SyncOutlined />} 
            loading={retryMutation.isPending || record.status === 'PROCESSING'} 
            disabled={record.status === 'PROCESSING'}
            onClick={() => retryDocument(record.documentId)}
          >
            {record.status === 'PROCESSING' ? 'Đang xử lý' : 'Thử lại'}
          </Button>
          <Link to={`/documents/`}>
            <Button size="small" icon={<EyeOutlined />} title="Chi tiết" />
          </Link>
        </Space>
      ),
    },
  ];

  return (
    <div className={styles.page}>
      <main className={styles.pageBody}>
        <div className={styles.canvas}>
          <div className={styles.container}>
            <section className={styles.pageHeader}>
              <div>
                <div className={styles.breadcrumbs}><Link to="/audit-logs">Audit Logs</Link><span>›</span><strong>Processing Errors</strong></div>
                <h2>TÀI LIỆU LỖI XỬ LÝ</h2>
              </div>
              <Button icon={<SyncOutlined />} loading={retryMutation.isPending} onClick={retryCurrentPage}>Retry trang hiện tại</Button>
            </section>

            {errorsQuery.isError && <Alert type="error" showIcon message={getApiErrorMessage(errorsQuery.error)} />}

            <section className={styles.summaryGrid}>
              {summaryCards.map((card) => (
                <article className={`${styles.summaryCard} ${styles[card.tone]}`} key={card.label}>
                  <div>
                    <span>{card.label}</span>
                    <div className={styles.summaryValue}><strong>{card.value}</strong><small>{card.helper}</small></div>
                  </div>
                  <div className={styles.summaryIcon}>{card.icon}</div>
                </article>
              ))}
            </section>

            <section className={styles.tablePanel}>
              <Table
                rowKey="documentId"
                columns={columns}
                dataSource={rows}
                loading={errorsQuery.isLoading || errorsQuery.isFetching}
                pagination={{
                  current: page + 1,
                  pageSize: size,
                  total: errorsQuery.data?.totalElements || 0,
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
        </div>
      </main>
    </div>
  );
}
