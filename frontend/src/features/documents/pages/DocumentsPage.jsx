import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DeleteOutlined,
  EyeOutlined,
  FileImageOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  InboxOutlined,
  ReloadOutlined,
  SearchOutlined,
  SyncOutlined,
  UndoOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { Alert, Button, Card, Empty, Flex, Input, Modal, Pagination, Select, Space, Spin, Table, Tag, Typography } from 'antd';
import { toast } from 'react-toastify';
import { batchArchiveDocuments, batchDeleteDocuments, batchMoveDocuments } from '../../../api/documentApi.js';
import { useAuthStore } from '../../../store/authStore.js';
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
  getAccessLevelLabel,
  getDocumentStatusMeta,
  getPageContent,
  normalizeDocument,
} from '../utils/documentFormatters.js';
import styles from './DocumentsPage.module.css';

const { Title, Text } = Typography;

function FileIcon({ fileType }) {
  const type = String(fileType || '').toLowerCase();
  if (type.includes('pdf')) return <FilePdfOutlined className={styles.fileIconPdf} />;
  if (type.includes('jpg') || type.includes('jpeg') || type.includes('png') || type.includes('tiff') || type.includes('image')) {
    return <FileImageOutlined className={styles.fileIconImage} />;
  }
  return <FileTextOutlined className={styles.fileIconDoc} />;
}

function StatusBadge({ status }) {
  const meta = getDocumentStatusMeta(status);
  return <Tag color={meta.color}>{meta.label}</Tag>;
}

export default function DocumentsPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'ADMIN';
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState();
  const [fileType, setFileType] = useState();
  const [scope, setScope] = useState('mine'); // Default to 'Tài liệu của tôi'
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
      ownerId: scope === 'mine' ? user?.id : undefined,
      departmentId: scope === 'department' ? user?.departmentId : undefined,
    }),
    [fileType, keyword, page, status, scope, user?.id, user?.departmentId],
  );

  const documentsQuery = useDocuments(params);
  const documents = getPageContent(documentsQuery.data).map(normalizeDocument).filter(Boolean);
  const totalElements = documentsQuery.data?.totalElements ?? documentsQuery.data?.total ?? documents.length;

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
      title: 'Thử lại xử lý tài liệu?',
      content: `Gửi lại yêu cầu xử lý cho tài liệu "${record.title || record.fileName}".`,
      mutation: retryMutation,
      documentId: record.id,
      successMessage: 'Đã gửi yêu cầu thử lại',
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

  const columns = [
    {
      title: 'Tài liệu',
      dataIndex: 'title',
      render: (_, record) => (
        <Flex gap={12} align="center">
          <FileIcon fileType={record.fileType || record.mimeType || record.fileName} />
          <div>
            <Button type="link" className={styles.titleLink} onClick={() => navigate(`/documents/`)}>
              {record.title || record.fileName || 'Không có tiêu đề'}
            </Button>
            <div>
              <Text type="secondary">{record.documentCode || record.fileName || '—'}</Text>
            </div>
          </div>
        </Flex>
      ),
    },
    {
      title: 'Danh mục',
      dataIndex: 'categoryName',
      render: (value) => value || '—',
    },
    {
      title: 'Dung lượng',
      dataIndex: 'fileSize',
      render: formatFileSize,
    },
    {
      title: 'Quyền truy cập',
      dataIndex: 'accessLevel',
      render: getAccessLevelLabel,
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
      title: 'Thao tác',
      key: 'actions',
      render: (_, record) => (
        <Space wrap>
          <Button icon={<EyeOutlined />} onClick={() => navigate(`/documents/`)}>
            Chi tiết
          </Button>
          {isAdmin && record.status === 'INDEXED' && (
            <Button icon={<InboxOutlined />} onClick={() => archiveRecord(record)} loading={archiveMutation.isPending}>
              Lưu trữ
            </Button>
          )}
          {isAdmin && record.status === 'ARCHIVED' && (
            <Button icon={<UndoOutlined />} onClick={() => restoreRecord(record)} loading={restoreMutation.isPending}>
              Khôi phục
            </Button>
          )}
          {isAdmin && record.status === 'EXTRACTION_FAILED' && (
            <Button icon={<SyncOutlined />} onClick={() => retryRecord(record)} loading={retryMutation.isPending}>
              Thử lại
            </Button>
          )}
          {isAdmin && ['INDEXED', 'ARCHIVED', 'EXTRACTION_FAILED'].includes(record.status) && (
            <Button danger icon={<DeleteOutlined />} onClick={() => deleteRecord(record)} loading={deleteMutation.isPending}>
              Xóa
            </Button>
          )}
        </Space>
      ),
    },
  ];

  function resetToFirstPage(next) {
    setPage(1);
    next();
  }

  return (
    <div className={styles.content || ''}>
      <Card>
        <Flex justify="space-between" align="flex-start" gap={16} wrap="wrap">
          <div>
            <Title level={3}>Quản lý tài liệu</Title>
            <Text type="secondary">Theo dõi tài liệu, trạng thái xử lý và quyền truy cập.</Text>
          </div>
          {isAdmin && (
            <Button type="primary" icon={<UploadOutlined />} onClick={() => navigate('/admin/upload-admin')}>
              Upload tài liệu mới
            </Button>
          )}
        </Flex>

        <Space size="middle" wrap style={{ marginTop: 24, marginBottom: 16 }}>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Tìm theo tiêu đề, mã tài liệu..."
            value={keyword}
            onChange={(event) => resetToFirstPage(() => setKeyword(event.target.value))}
            style={{ width: 320 }}
          />
          <Select
            placeholder="Phạm vi"
            allowClear={false}
            value={scope}
            onChange={(value) => resetToFirstPage(() => setScope(value))}
            style={{ width: 160 }}
            options={[
              { label: 'Tài liệu của tôi', value: 'mine' },
              { label: 'Phòng ban của tôi', value: 'department' },
              { label: 'Tất cả tài liệu', value: 'all' },
            ]}
          />
          <Select
            allowClear
            placeholder="Trạng thái"
            value={status}
            onChange={(value) => resetToFirstPage(() => setStatus(value))}
            style={{ width: 160 }}
            options={[
              { value: 'PROCESSING', label: 'Đang xử lý' },
              { value: 'INDEXED', label: 'Sẵn sàng' },
              { value: 'EXTRACTION_FAILED', label: 'Lỗi trích xuất' },
              { value: 'AWAITING_UPLOAD', label: 'Chờ upload' },
              ...(isAdmin ? [
                { value: 'ARCHIVED', label: 'Lưu trữ' },
                { value: 'DELETED', label: 'Đã xóa' },
              ] : []),
            ]}
          />
          <Select
            allowClear
            placeholder="Loại file"
            value={fileType}
            onChange={(value) => resetToFirstPage(() => setFileType(value))}
            style={{ width: 160 }}
            options={[
              { value: 'PDF', label: 'PDF' },
              { value: 'DOCX', label: 'Word (DOCX)' },
              { value: 'DOC', label: 'Word (DOC)' },
              { value: 'XLSX', label: 'Excel (XLSX)' },
              { value: 'XLS', label: 'Excel (XLS)' },
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={() => documentsQuery.refetch()}>
            Làm mới
          </Button>
        </Space>

        {isAdmin && selectedDocumentIds.length > 0 && (
          <Alert
            type="info"
            showIcon
            message={
              <Flex justify="space-between" align="center" gap={12} wrap="wrap">
                <Text>Đã chọn {selectedDocumentIds.length} tài liệu</Text>
                <Space wrap>
                  <Button onClick={confirmBatchMove} loading={bulkActionLoading}>Chuyển danh mục</Button>
                  <Button icon={<InboxOutlined />} onClick={confirmBatchArchive} loading={bulkActionLoading}>Lưu trữ</Button>
                  <Button danger icon={<DeleteOutlined />} onClick={confirmBatchDelete} loading={bulkActionLoading}>Xóa</Button>
                  <Button onClick={() => setSelectedDocumentIds([])}>Bỏ chọn</Button>
                </Space>
              </Flex>
            }
            style={{ marginBottom: 16 }}
          />
        )}

        {documentsQuery.isError && <Alert type="error" showIcon message={getApiErrorMessage(documentsQuery.error)} />}

        <Spin spinning={documentsQuery.isLoading}>
          <Table
            rowKey="id"
            rowSelection={isAdmin ? { selectedRowKeys: selectedDocumentIds, onChange: setSelectedDocumentIds } : undefined}
            columns={columns}
            dataSource={documents}
            pagination={false}
            locale={{ emptyText: <Empty description="Chưa có tài liệu" /> }}
          />
        </Spin>

        <Flex justify="flex-end" style={{ marginTop: 16 }}>
          <Pagination
            current={page}
            pageSize={pageSize}
            total={totalElements}
            onChange={setPage}
            showSizeChanger={false}
          />
        </Flex>
      </Card>
    </div>
  );
}
