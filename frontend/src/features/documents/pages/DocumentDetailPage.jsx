import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeftOutlined, DownloadOutlined, EyeOutlined, HistoryOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Descriptions, Empty, Flex, Modal, Space, Spin, Tag, Typography } from 'antd';
import DOMPurify from 'dompurify';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { getDownloadUrl, getPreviewUrl } from '../../../api/documentApi.js';
import { getApiErrorMessage } from '../../../utils/response.js';
import { useDocument } from '../hooks/useDocument.js';
import {
  formatDateTime,
  formatFileSize,
  getAccessLevelLabel,
  getDocumentStatusMeta,
  normalizeDocument,
} from '../utils/documentFormatters.js';
import styles from './DocumentDetailPage.module.css';

const { Title, Text, Paragraph } = Typography;
const PREVIEWABLE_TYPES = ['pdf', 'png', 'jpg', 'jpeg', 'tiff', 'image', 'doc', 'docx', 'xls', 'xlsx'];

function canPreviewFile(document) {
  const type = String(document?.fileType || document?.mimeType || document?.fileName || '').toLowerCase();
  return PREVIEWABLE_TYPES.some((previewableType) => type.includes(previewableType));
}

function getPresignedUrl(payload) {
  return payload?.url || payload?.previewUrl || payload?.downloadUrl;
}

export default function DocumentDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const queryClient = useQueryClient();
  const documentQuery = useDocument(id);
  const [preview, setPreview] = useState(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const document = normalizeDocument(documentQuery.data);
  const statusMeta = getDocumentStatusMeta(document?.status);
  const isReady = document?.status === 'INDEXED';

  async function handlePreview() {
    if (!document) return;
    setIsPreviewLoading(true);
    try {
      const previewData = await getPreviewUrl(document.id);
      const url = getPresignedUrl(previewData);
      if (!url) throw new Error('Backend không trả về preview URL.');

      if (!canPreviewFile(document)) {
        window.open(url, '_blank', 'noopener,noreferrer');
        return;
      }

      setPreview({ ...previewData, url });
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setIsPreviewLoading(false);
    }
  }

  async function handleDownload() {
    if (!document) return;
    try {
      const downloadData = await getDownloadUrl(document.id);
      const url = getPresignedUrl(downloadData);
      if (!url) throw new Error('Backend không trả về download URL.');

      const link = window.document.createElement('a');
      link.href = url;
      link.download = downloadData.fileName || document.fileName || document.title || 'document';
      link.rel = 'noopener noreferrer';
      window.document.body.appendChild(link);
      link.click();
      link.remove();
      queryClient.invalidateQueries({ queryKey: ['documents', id] });
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  }

  if (documentQuery.isLoading) {
    return <Spin fullscreen tip="Đang tải tài liệu..." />;
  }

  if (documentQuery.isError) {
    return <Alert type="error" showIcon message={getApiErrorMessage(documentQuery.error)} />;
  }

  if (!document) {
    return <Empty description="Không tìm thấy tài liệu" />;
  }

  return (
    <div className={styles.pageWrapper}>
      <Card>
        <Flex justify="space-between" align="flex-start" gap={16} wrap="wrap">
          <Space direction="vertical" size={4}>
            <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
              Quay lại
            </Button>
            <Title level={3}>{document.title || document.fileName}</Title>
            <Space wrap>
              <Text type="secondary">{document.documentCode || document.fileName}</Text>
              <Tag color={statusMeta.color}>{statusMeta.label}</Tag>
            </Space>
          </Space>
          <Space>
            <Button icon={<HistoryOutlined />} onClick={() => navigate(`/admin/documents/${document.id}/history`)}>
              Versions
            </Button>
            <Button icon={<EyeOutlined />} onClick={handlePreview} loading={isPreviewLoading} disabled={!isReady}>
              Preview
            </Button>
            <Button type="primary" icon={<DownloadOutlined />} onClick={handleDownload} disabled={!isReady}>
              Download
            </Button>
          </Space>
        </Flex>

        {!isReady && (
          <Alert
            style={{ marginTop: 16 }}
            type={document.status === 'EXTRACTION_FAILED' ? 'error' : 'info'}
            showIcon
            message="Tài liệu chưa sẵn sàng để preview/download"
            description="Backend chỉ cấp presigned URL sau khi trích xuất/OCR và INDEXED."
          />
        )}

        <Descriptions bordered column={2} style={{ marginTop: 24 }}>
          <Descriptions.Item label="Tên file">{document.fileName || '—'}</Descriptions.Item>
          <Descriptions.Item label="Dung lượng">{formatFileSize(document.fileSize)}</Descriptions.Item>
          <Descriptions.Item label="Loại file">{document.fileType || document.mimeType || '—'}</Descriptions.Item>
          <Descriptions.Item label="Danh mục">{document.categoryName || '—'}</Descriptions.Item>
          <Descriptions.Item label="Phòng ban">{document.departmentName || '—'}</Descriptions.Item>
          <Descriptions.Item label="Quyền truy cập">{getAccessLevelLabel(document.accessLevel)}</Descriptions.Item>
          <Descriptions.Item label="Người upload">{document.uploadedByName || '—'}</Descriptions.Item>
          <Descriptions.Item label="Ngày tạo">{formatDateTime(document.createdAt)}</Descriptions.Item>
          <Descriptions.Item label="Ngày hiệu lực">{formatDateTime(document.effectiveDate)}</Descriptions.Item>
          <Descriptions.Item label="Ngày hết hạn">{formatDateTime(document.expiryDate)}</Descriptions.Item>
          <Descriptions.Item label="Lượt xem">{document.viewCount ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Lượt tải">{document.downloadCount ?? '—'}</Descriptions.Item>
        </Descriptions>

        {document.description && (
          <Card title="Mô tả" style={{ marginTop: 24 }}>
            <Paragraph>{document.description}</Paragraph>
          </Card>
        )}
      </Card>

      <Modal
        title={preview?.fileName || document.fileName || document.title}
        open={Boolean(preview)}
        onCancel={() => setPreview(null)}
        footer={null}
        width="80vw"
      >
        {preview?.contentType?.includes('html') ? (
          <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(preview.html || '') }} />
        ) : (
          <iframe title="Document preview" src={preview?.url} className={styles.previewFrame} />
        )}
      </Modal>
    </div>
  );
}
