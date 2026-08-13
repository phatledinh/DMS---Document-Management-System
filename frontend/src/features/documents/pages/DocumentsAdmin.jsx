import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  FileImageOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  InboxOutlined,
  MoreOutlined,
  ReloadOutlined,
  SearchOutlined,
  SyncOutlined,
  UndoOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { Alert, Button, Dropdown, Empty, Input, Modal, Pagination, Select, Space, Spin, Table, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { getCategories } from '../../../api/categoryApi.js';
import { batchArchiveDocuments, batchDeleteDocuments, batchMoveDocuments } from '../../../api/documentApi.js';
import { getApiErrorMessage } from '../../../utils/response.js';
import {
  useArchiveDocument,
  useDeleteDocument,
  useRestoreDocument,
  useRetryDocumentIndexing,
} from '../hooks/useDocumentLifecycle.js';
import { useDocuments } from '../hooks/useDocuments.js';
import {
  formatDateTime,
  formatFileSize,
  getDocumentStatusMeta,
  getPageContent,
  normalizeDocument,
} from '../utils/documentFormatters.js';
import styles from './DocumentsAdmin.module.css';

const { Text } = Typography;

function FileIcon({ fileType }) {
  const type = String(fileType || '').toLowerCase();
  if (type.includes('pdf')) return <FilePdfOutlined className={styles.fileIconPdf} />;
  if (type.includes('jpg') || type.includes('jpeg') || type.includes('png') || type.includes('tiff') || type.includes('image')) {
    return <FileImageOutlined className={styles.fileIconImage} />;
  }
  return <FileTextOutlined className={styles.fileIconDoc} />;
}

function normalizeList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.content)) return data.content;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

function getDocumentCategoryName(record, categoryById) {
  return record.categoryName
    || record.category?.name
    || categoryById.get(String(record.categoryId))
    || categoryById.get(String(record.category?.id))
    || '—';
}

function StatusBadge({ status }) {
  const meta = getDocumentStatusMeta(status);
  const normalized = String(status || '').toUpperCase();
  const className = normalized === 'INDEXED'
    ? styles.statusReady
    : normalized === 'PROCESSING'
      ? styles.statusProcessing
      : normalized === 'EXTRACTION_FAILED'
        ? styles.statusError
        : styles.statusNeutral;

  return (
    <span className={className}>
      <i />
      {meta.label}
    </span>
  );
}

export default function DocumentsAdmin() {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState();
  const [fileType, setFileType] = useState();
  const [selectedDocumentIds, setSelectedDocumentIds] = useState([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const archiveMutation = useArchiveDocument();
  const deleteMutation = useDeleteDocument();
  const restoreMutation = useRestoreDocument();
  const retryMutation = useRetryDocumentIndexing();

  const params = useMemo(
    () => ({
      page: page - 1,
      size: pageSize,
      sort: 'createdAt,desc',
      q: keyword.trim() || undefined,
      status,
      fileType,
    }),
    [fileType, keyword, page, status],
  );

  const documentsQuery = useDocuments(params);
  const categoriesQuery = useQuery({
    queryKey: ['document-admin-categories'],
    queryFn: () => getCategories({ activeOnly: false }),
  });
  const categoryById = useMemo(() => {
    return new Map(normalizeList(categoriesQuery.data).map((category) => [String(category.id), category.name]));
  }, [categoriesQuery.data]);
  const documents = getPageContent(documentsQuery.data).map(normalizeDocument).filter(Boolean);
  const totalElements = documentsQuery.data?.totalElements ?? documentsQuery.data?.total ?? documents.length;

  function resetToFirstPage(next) {
    setPage(1);
    next();
  }

  function runLifecycleAction({ title, content, mutation, documentId, successMessage }) {
    Modal.confirm({
      title,
      content,
      okText: 'Xác nhận',
      cancelText: 'Hủy',
      okButtonProps: { danger: mutation === deleteMutation },
      async onOk() {
        try {
          await mutation.mutateAsync(documentId);
          toast.success(successMessage);
        } catch (error) {
          toast.error(getApiErrorMessage(error));
          throw error;
        }
      },
    });
  }

  function archiveRecord(record) {
    runLifecycleAction({
      title: 'Lưu trữ tài liệu?',
      content: `Tài liệu "${record.title || record.fileName}" sẽ bị ẩn khỏi danh sách mặc định và tìm kiếm.`,
      mutation: archiveMutation,
      documentId: record.id,
      successMessage: 'Đã lưu trữ tài liệu',
    });
  }

  function deleteRecord(record) {
    runLifecycleAction({
      title: 'Chuyển tài liệu vào thùng rác?',
      content: `Tài liệu "${record.title || record.fileName}" có thể được khôi phục trước hạn purge.`,
      mutation: deleteMutation,
      documentId: record.id,
      successMessage: 'Đã chuyển tài liệu vào thùng rác',
    });
  }

  function restoreRecord(record) {
    runLifecycleAction({
      title: 'Khôi phục tài liệu?',
      content: `Tài liệu "${record.title || record.fileName}" sẽ được đưa về trạng thái hoạt động.`,
      mutation: restoreMutation,
      documentId: record.id,
      successMessage: 'Đã khôi phục tài liệu',
    });
  }

  function retryRecord(record) {
    runLifecycleAction({
      title: 'Retry xử lý tài liệu?',
      content: `Gửi lại yêu cầu xử lý cho tài liệu "${record.title || record.fileName}".`,
      mutation: retryMutation,
      documentId: record.id,
      successMessage: 'Đã gửi retry xử lý tài liệu',
    });
  }

  function showBatchResult(result, successText) {
    const succeeded = result?.succeeded || 0;
    const failed = result?.failed || 0;
    if (failed) {
      toast.warning(`${successText}: ${succeeded} thành công, ${failed} lỗi.`);
    } else {
      toast.success(successText);
    }
  }

  async function runBatchAction(action, successText) {
    setBulkActionLoading(true);
    try {
      const result = await action(selectedDocumentIds);
      showBatchResult(result, successText);
      setSelectedDocumentIds([]);
      await documentsQuery.refetch();
    } catch (error) {
      toast.error(getApiErrorMessage(error));
      throw error;
    } finally {
      setBulkActionLoading(false);
    }
  }

  function confirmBatchDelete() {
    Modal.confirm({
      title: 'Chuyển các tài liệu đã chọn vào thùng rác?',
      content: `${selectedDocumentIds.length} tài liệu sẽ được xử lý theo từng item.`,
      okText: 'Xóa',
      okButtonProps: { danger: true },
      cancelText: 'Hủy',
      onOk: () => runBatchAction(batchDeleteDocuments, 'Batch delete completed'),
    });
  }

  function confirmBatchArchive() {
    Modal.confirm({
      title: 'Lưu trữ các tài liệu đã chọn?',
      content: `${selectedDocumentIds.length} tài liệu sẽ được xử lý theo từng item.`,
      okText: 'Lưu trữ',
      cancelText: 'Hủy',
      onOk: () => runBatchAction(batchArchiveDocuments, 'Batch archive completed'),
    });
  }

  function confirmBatchMove() {
    let targetCategoryId;
    Modal.confirm({
      title: 'Chuyển danh mục các tài liệu đã chọn',
      content: <Input placeholder="Nhập target categoryId" onChange={(event) => { targetCategoryId = Number(event.target.value); }} />,
      okText: 'Chuyển',
      cancelText: 'Hủy',
      onOk: () => {
        if (!targetCategoryId) {
          toast.error('Vui lòng nhập target categoryId.');
          return Promise.reject(new Error('target category required'));
        }
        return runBatchAction((ids) => batchMoveDocuments(ids, targetCategoryId), 'Batch move completed');
      },
    });
  }

  function actionItems(record) {
    const items = [
      {
        key: 'view',
        icon: <EyeOutlined />,
        label: 'Chi tiết',
        onClick: () => navigate(`/documents/`),
      },
      {
        key: 'edit',
        icon: <EditOutlined />,
        label: 'Chỉnh sửa',
        onClick: () => navigate(`/admin/documents-admin/${record.id}/edit`),
      },
    ];

    if (record.status === 'INDEXED') {
      items.push({ key: 'archive', icon: <InboxOutlined />, label: 'Lưu trữ', onClick: () => archiveRecord(record) });
    }
    if (record.status === 'ARCHIVED') {
      items.push({ key: 'restore', icon: <UndoOutlined />, label: 'Khôi phục', onClick: () => restoreRecord(record) });
    }
    if (record.status === 'EXTRACTION_FAILED') {
      items.push({ key: 'retry', icon: <SyncOutlined />, label: 'Retry xử lý', onClick: () => retryRecord(record) });
    }
    if (['INDEXED', 'ARCHIVED', 'EXTRACTION_FAILED'].includes(record.status)) {
      items.push({ key: 'delete', danger: true, icon: <DeleteOutlined />, label: 'Xóa', onClick: () => deleteRecord(record) });
    }

    return items;
  }

  const columns = [
    {
      title: 'Tài liệu',
      dataIndex: 'title',
      width: 320,
      render: (_, record) => (
        <button className={styles.documentTitle} type="button" onClick={() => navigate(`/documents/`)}>
          <span className={styles.documentIconWrap}>
            <FileIcon fileType={record.fileType || record.mimeType || record.fileName} />
          </span>
          <span className={styles.documentName}>{record.title || record.fileName || 'Không có tiêu đề'}</span>
          <small>{record.documentCode || record.fileName || '—'}</small>
        </button>
      ),
    },
    {
      title: 'Danh mục',
      dataIndex: 'categoryName',
      render: (_, record) => getDocumentCategoryName(record, categoryById),
    },
    {
      title: 'Loại file',
      dataIndex: 'fileType',
      render: (value, record) => <Tag>{value || record.mimeType || '—'}</Tag>,
    },
    {
      title: 'Kích thước',
      dataIndex: 'fileSize',
      render: formatFileSize,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      render: (value) => <StatusBadge status={value} />,
    },
    {
      title: 'Cập nhật',
      dataIndex: 'createdAt',
      render: formatDateTime,
    },
    {
      title: '',
      key: 'actions',
      width: 56,
      align: 'center',
      render: (_, record) => (
        <Dropdown trigger={['click']} menu={{ items: actionItems(record) }}>
          <Button type="text" icon={<MoreOutlined />} />
        </Dropdown>
      ),
    },
  ];

  return (
    <main className={styles.page}>
      <div className={styles.topStrip}>
        <Input
          className={styles.quickSearch}
          prefix={<SearchOutlined />}
          placeholder="Tìm nhanh tài liệu, mã tài liệu, tag…"
          allowClear
          value={keyword}
          onChange={(event) => resetToFirstPage(() => setKeyword(event.target.value))}
        />
        <Button icon={<ReloadOutlined />} onClick={() => documentsQuery.refetch()}>
          Làm mới
        </Button>
      </div>

      <header className={styles.heroHeader}>
        <div>
          <h1>Documents Admin</h1>
          <p>Tìm, lọc và thao tác trên toàn bộ tài liệu trong hệ thống.</p>
        </div>
        <Button className={styles.uploadButton} type="primary" icon={<UploadOutlined />} onClick={() => navigate('/admin/upload-admin')}>
          Upload
        </Button>
      </header>

      <section className={styles.filterPanel}>
        <Input
          allowClear
          prefix={<SearchOutlined />}
          placeholder="Tìm theo tiêu đề, mã tài liệu..."
          value={keyword}
          onChange={(event) => resetToFirstPage(() => setKeyword(event.target.value))}
        />
        <Select
          allowClear
          placeholder="Trạng thái"
          value={status}
          onChange={(value) => resetToFirstPage(() => setStatus(value))}
          options={[
            { value: 'PROCESSING', label: 'Đang xử lý' },
            { value: 'INDEXED', label: 'Sẵn sàng' },
            { value: 'EXTRACTION_FAILED', label: 'Lỗi trích xuất' },
            { value: 'AWAITING_UPLOAD', label: 'Chờ upload' },
            { value: 'ARCHIVED', label: 'Lưu trữ' },
            { value: 'DELETED', label: 'Đã xóa' },
          ]}
        />
        <Select
          allowClear
          placeholder="Loại file"
          value={fileType}
          onChange={(value) => resetToFirstPage(() => setFileType(value))}
          options={[
            { value: 'PDF', label: 'PDF' },
            { value: 'DOCX', label: 'DOCX' },
            { value: 'XLSX', label: 'XLSX' },
            { value: 'IMAGE', label: 'Ảnh' },
          ]}
        />
        <Button onClick={() => {
          setKeyword('');
          setStatus(undefined);
          setFileType(undefined);
          setPage(1);
        }}>
          Xóa lọc
        </Button>
      </section>

      {selectedDocumentIds.length > 0 && (
        <Alert
          className={styles.batchBar}
          type="info"
          showIcon
          message={(
            <div className={styles.batchContent}>
              <Text>Đã chọn {selectedDocumentIds.length} tài liệu</Text>
              <Space wrap>
                <Button onClick={confirmBatchMove} loading={bulkActionLoading}>Chuyển danh mục</Button>
                <Button icon={<InboxOutlined />} onClick={confirmBatchArchive} loading={bulkActionLoading}>Lưu trữ</Button>
                <Button danger icon={<DeleteOutlined />} onClick={confirmBatchDelete} loading={bulkActionLoading}>Xóa</Button>
                <Button onClick={() => setSelectedDocumentIds([])}>Bỏ chọn</Button>
              </Space>
            </div>
          )}
        />
      )}

      {documentsQuery.isError && <Alert className={styles.errorAlert} type="error" showIcon message={getApiErrorMessage(documentsQuery.error)} />}

      <section className={styles.tablePanel}>
        <Spin spinning={documentsQuery.isLoading}>
          <Table
            rowKey="id"
            rowSelection={{ selectedRowKeys: selectedDocumentIds, onChange: setSelectedDocumentIds }}
            columns={columns}
            dataSource={documents}
            pagination={false}
            scroll={{ x: 1120 }}
            locale={{ emptyText: <Empty description="Chưa có tài liệu" /> }}
          />
        </Spin>
        <div className={styles.paginationBar}>
          <span>
            Hiển thị <strong>{documents.length}</strong> / <strong>{totalElements}</strong> tài liệu
          </span>
          <Pagination current={page} pageSize={pageSize} total={totalElements} onChange={setPage} showSizeChanger={false} />
        </div>
      </section>
    </main>
  );
}
