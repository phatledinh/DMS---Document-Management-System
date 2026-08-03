import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  EyeOutlined,
  FileImageOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  ReloadOutlined,
  SearchOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { Alert, Button, Card, Empty, Flex, Input, Pagination, Select, Space, Spin, Table, Tag, Typography } from 'antd';
import { useAuthStore } from '../../../store/authStore.js';
import { getApiErrorMessage } from '../../../utils/response.js';
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
  const [page, setPage] = useState(1);
  const pageSize = 10;

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
  const documents = getPageContent(documentsQuery.data).map(normalizeDocument).filter(Boolean);
  const totalElements = documentsQuery.data?.totalElements ?? documentsQuery.data?.total ?? documents.length;

  const columns = [
    {
      title: 'Tài liệu',
      dataIndex: 'title',
      render: (_, record) => (
        <Flex gap={12} align="center">
          <FileIcon fileType={record.fileType || record.mimeType || record.fileName} />
          <div>
            <Button type="link" className={styles.titleLink} onClick={() => navigate(`/documents/${record.id}`)}>
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
        <Button icon={<EyeOutlined />} onClick={() => navigate(`/documents/${record.id}`)}>
          Chi tiết
        </Button>
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
            <Button type="primary" icon={<UploadOutlined />} onClick={() => navigate('/admin/documents/upload')}>
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
            allowClear
            placeholder="Trạng thái"
            value={status}
            onChange={(value) => resetToFirstPage(() => setStatus(value))}
            style={{ width: 200 }}
            options={[
              { value: 'PROCESSING', label: 'Đang xử lý' },
              { value: 'INDEXED', label: 'Sẵn sàng' },
              { value: 'EXTRACTION_FAILED', label: 'Lỗi trích xuất' },
              { value: 'AWAITING_UPLOAD', label: 'Chờ upload' },
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
              { value: 'DOCX', label: 'DOCX' },
              { value: 'XLSX', label: 'XLSX' },
              { value: 'IMAGE', label: 'Ảnh' },
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={() => documentsQuery.refetch()}>
            Làm mới
          </Button>
        </Space>

        {documentsQuery.isError && <Alert type="error" showIcon message={getApiErrorMessage(documentsQuery.error)} />}

        <Spin spinning={documentsQuery.isLoading}>
          <Table
            rowKey="id"
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
