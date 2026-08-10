import { useMemo, useState } from 'react';
import { DeleteOutlined, ReloadOutlined, SearchOutlined, UndoOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Empty, Flex, Input, Modal, Pagination, Select, Space, Spin, Table, Tag, Typography } from 'antd';
import { toast } from 'react-toastify';
import { getApiErrorMessage } from '../../../utils/response.js';
import {
  usePermanentDeleteTrashDocuments,
  useRestoreTrashDocuments,
  useTrashDocuments,
} from '../hooks/useDocumentLifecycle.js';
import {
  formatDateTime,
  formatFileSize,
  getDocumentStatusMeta,
  getPageContent,
  normalizeDocument,
} from '../utils/documentFormatters.js';
import styles from './DocumentTrashPage.module.css';

const { Title, Text } = Typography;

function PurgeBadge({ days }) {
  const value = Number(days ?? 0);
  if (value <= 3) return <Tag color="error">Còn {value} ngày</Tag>;
  if (value <= 15) return <Tag color="warning">Còn {value} ngày</Tag>;
  return <Tag color="success">Còn {value} ngày</Tag>;
}

export default function DocumentTrashPage() {
  const [keyword, setKeyword] = useState('');
  const [fileType, setFileType] = useState();
  const [page, setPage] = useState(1);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const pageSize = 10;

  const params = useMemo(
    () => ({
      page: page - 1,
      size: pageSize,
      q: keyword.trim() || undefined,
      fileType,
    }),
    [fileType, keyword, page],
  );

  const trashQuery = useTrashDocuments(params);
  const restoreMutation = useRestoreTrashDocuments();
  const permanentDeleteMutation = usePermanentDeleteTrashDocuments();
  const documents = getPageContent(trashQuery.data).map(normalizeDocument).filter(Boolean);
  const totalElements = trashQuery.data?.totalElements ?? trashQuery.data?.total ?? documents.length;

  function resetToFirstPage(next) {
    setPage(1);
    next();
  }

  function runBatchAction({ title, content, documentIds, mutation, successMessage, danger = false }) {
    if (!documentIds.length) {
      toast.info('Chọn ít nhất một tài liệu');
      return;
    }
    Modal.confirm({
      title,
      content,
      okText: 'Xác nhận',
      cancelText: 'Hủy',
      okButtonProps: { danger },
      async onOk() {
        try {
          const result = await mutation.mutateAsync(documentIds);
          setSelectedRowKeys([]);
          const failed = result?.failureCount ?? 0;
          if (failed > 0) {
            toast.warn(`${successMessage}, ${failed} tài liệu thất bại`);
          } else {
            toast.success(successMessage);
          }
        } catch (error) {
          toast.error(getApiErrorMessage(error));
          throw error;
        }
      },
    });
  }

  function restoreDocuments(documentIds) {
    runBatchAction({
      title: 'Khôi phục tài liệu?',
      content: 'Tài liệu được chọn sẽ được đưa ra khỏi thùng rác và quay về trạng thái trước khi xóa.',
      documentIds,
      mutation: restoreMutation,
      successMessage: 'Đã khôi phục tài liệu',
    });
  }

  function permanentlyDeleteDocuments(documentIds) {
    runBatchAction({
      title: 'Xóa vĩnh viễn tài liệu?',
      content: 'Hành động này sẽ xóa file lưu trữ và không thể khôi phục từ thùng rác.',
      documentIds,
      mutation: permanentDeleteMutation,
      successMessage: 'Đã xóa vĩnh viễn tài liệu',
      danger: true,
    });
  }

  const columns = [
    {
      title: 'Tài liệu',
      dataIndex: 'title',
      render: (_, record) => (
        <div>
          <Text strong>{record.title || record.fileName || 'Không có tiêu đề'}</Text>
          <div><Text type="secondary">{record.documentCode || record.fileName || '—'}</Text></div>
        </div>
      ),
    },
    {
      title: 'Loại file',
      dataIndex: 'fileType',
      render: (value) => value || '—',
    },
    {
      title: 'Dung lượng',
      dataIndex: 'fileSize',
      render: formatFileSize,
    },
    {
      title: 'Trạng thái trước đó',
      dataIndex: 'previousStatus',
      render: (value) => {
        const meta = getDocumentStatusMeta(value);
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: 'Người xóa',
      dataIndex: 'deletedBy',
      render: (value) => value || '—',
    },
    {
      title: 'Ngày xóa',
      dataIndex: 'deletedAt',
      render: formatDateTime,
    },
    {
      title: 'Hạn purge',
      dataIndex: 'daysUntilPurge',
      render: (_, record) => <PurgeBadge days={record.daysUntilPurge} />,
    },
    {
      title: 'Thao tác',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button icon={<UndoOutlined />} onClick={() => restoreDocuments([record.id])} loading={restoreMutation.isPending}>
            Khôi phục
          </Button>
          <Button danger icon={<DeleteOutlined />} onClick={() => permanentlyDeleteDocuments([record.id])} loading={permanentDeleteMutation.isPending}>
            Xóa vĩnh viễn
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <main className={styles.page}>
      <Card className={styles.card}>
        <Flex justify="space-between" align="flex-start" gap={16} wrap="wrap">
        <div>
          <Title level={3}>Thùng rác tài liệu</Title>
          <Text type="secondary">Tài liệu đã xóa tạm thời sẽ được purge tự động sau thời hạn lưu giữ.</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={() => trashQuery.refetch()}>
          Làm mới
        </Button>
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
          allowClear
          placeholder="Loại file"
          value={fileType}
          onChange={(value) => resetToFirstPage(() => setFileType(value))}
          style={{ width: 160 }}
          options={[
            { value: 'PDF', label: 'PDF' },
            { value: 'DOCX', label: 'DOCX' },
            { value: 'XLSX', label: 'XLSX' },
            { value: 'IMAGE', label: 'Ảnh' },
          ]}
        />
      </Space>

      {selectedRowKeys.length > 0 && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message={`${selectedRowKeys.length} tài liệu được chọn`}
          action={(
            <Space>
              <Button size="small" icon={<UndoOutlined />} onClick={() => restoreDocuments(selectedRowKeys)} loading={restoreMutation.isPending}>
                Khôi phục
              </Button>
              <Button size="small" danger icon={<DeleteOutlined />} onClick={() => permanentlyDeleteDocuments(selectedRowKeys)} loading={permanentDeleteMutation.isPending}>
                Xóa vĩnh viễn
              </Button>
            </Space>
          )}
        />
      )}

      {trashQuery.isError && <Alert type="error" showIcon message={getApiErrorMessage(trashQuery.error)} />}

      <Spin spinning={trashQuery.isLoading}>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={documents}
          pagination={false}
          rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
          locale={{ emptyText: <Empty description="Thùng rác trống" /> }}
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
    </main>
  );
}
