import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeftOutlined, DownloadOutlined, EyeOutlined, FileTextOutlined, HistoryOutlined } from '@ant-design/icons';
import { Alert, Button, Empty, Modal, Space, Spin, Tag, Typography } from 'antd';
import DOMPurify from 'dompurify';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { getDownloadUrl, getPreviewUrl } from '../../../api/documentApi.js';
import { getApiErrorMessage } from '../../../utils/response.js';
import { useDocument } from '../hooks/useDocument.js';
import {
  formatDateTime,
  formatFileSize,
  getDocumentStatusMeta,
  normalizeDocument,
} from '../utils/documentFormatters.js';
import styles from './DocumentDetailPage.module.css';

const { Text, Paragraph } = Typography;
const PREVIEWABLE_TYPES = ['pdf', 'png', 'jpg', 'jpeg', 'tiff', 'image', 'doc', 'docx', 'xls', 'xlsx'];

function canPreviewFile(document) {
  const type = String(document?.fileType || document?.mimeType || document?.fileName || '').toLowerCase();
  return PREVIEWABLE_TYPES.some((previewableType) => type.includes(previewableType));
}

function getPresignedUrl(payload) {
  return payload?.url || payload?.previewUrl || payload?.downloadUrl;
}

function getTags(document) {
  if (Array.isArray(document?.tags)) {
    return document.tags.map((tag) => tag.name || tag.label || tag).filter(Boolean);
  }
  if (Array.isArray(document?.tagNames)) return document.tagNames;
  return [];
}

function getAuthorizedDepartments(document) {
  if (Array.isArray(document?.authorizedDepartments)) {
    return document.authorizedDepartments.filter(Boolean);
  }
  return [];
}

function InfoRow({ label, value }) {
  return (
    <div className={styles.infoRow}>
      <span>{label}</span>
      <strong>{value || '—'}</strong>
    </div>
  );
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
  const tags = getTags(document);
  const authorizedDepartments = getAuthorizedDepartments(document);

  async function handlePreview() {
    if (!document) return;
    setIsPreviewLoading(true);
    try {
      const previewData = await getPreviewUrl(document.id);
      const url = getPresignedUrl(previewData);
      if (!url) throw new Error('Backend không trả về URL mở tài liệu.');

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
    <main className={styles.pageWrapper}>
      <header className={styles.detailHeader}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
          Quay lại
        </Button>
        <div className={styles.headerTitleGroup}>
          <h1>{document.title || document.fileName}</h1>
          <Space wrap>
            <Text type="secondary">{document.documentCode || document.fileName}</Text>
            <Tag color={statusMeta.color}>{statusMeta.label}</Tag>
          </Space>
        </div>
        <Space wrap className={styles.headerActions}>
          <Button icon={<HistoryOutlined />} onClick={() => navigate(`/documents/${document.id}/history`)}>
            Version
          </Button>
          <Button icon={<EyeOutlined />} onClick={handlePreview} loading={isPreviewLoading} disabled={!isReady}>
            Mở tài liệu
          </Button>
          <Button type="primary" icon={<DownloadOutlined />} onClick={handleDownload} disabled={!isReady}>
            Tải xuống
          </Button>
        </Space>
      </header>

      <section className={styles.detailGrid}>
        <section className={styles.previewCard}>
          <div className={styles.previewToolbar}>
            <strong>Mở tài liệu</strong>
            <Button icon={<EyeOutlined />} onClick={handlePreview} loading={isPreviewLoading} disabled={!isReady}>
              Mở tài liệu
            </Button>
          </div>
          {!isReady && (
            <Alert
              className={styles.readyAlert}
              type={document.status === 'EXTRACTION_FAILED' ? 'error' : 'info'}
              showIcon
              message="Tài liệu chưa sẵn sàng để mở/tải xuống"
              description="Backend chỉ cấp URL mở tài liệu sau khi trích xuất/OCR và INDEXED."
            />
          )}
          <div className={styles.previewCanvas}>
            <div className={styles.paperPreview}>
              <div className={styles.paperHeader}>
                <div>
                  <span>DMS</span>
                  <small>{document.documentCode || 'DOCUMENT'}</small>
                </div>
                <FileTextOutlined />
              </div>
              <div className={styles.paperBody}>
                <h2>{document.title || document.fileName}</h2>
                <div className={styles.lineLong} />
                <div className={styles.lineMedium} />
                <div className={styles.lineFull} />
                <div className={styles.lineFull} />
                <div className={styles.lineShort} />
                <div className={styles.lineFull} />
                <div className={styles.lineMedium} />
              </div>
            </div>
          </div>
        </section>

        <aside className={styles.sidebarColumn}>
          <section className={styles.infoCard}>
            <div className={styles.sidebarHeader}>
              <div>
                <span>{document.documentCode || document.fileName}</span>
                <h2>{document.title || document.fileName}</h2>
              </div>
              <Tag color={statusMeta.color}>{statusMeta.label}</Tag>
            </div>
            <div className={styles.infoList}>
              <InfoRow label="Danh mục" value={document.categoryName} />
              <InfoRow label="Phòng ban" value={document.departmentName} />
              <InfoRow label="Loại file" value={`${document.fileType || document.mimeType || '—'} · ${formatFileSize(document.fileSize)}`} />
              <InfoRow label="Ngày upload" value={formatDateTime(document.createdAt)} />
              <InfoRow label="Hiệu lực" value={formatDateTime(document.effectiveDate)} />
              <InfoRow label="Hết hiệu lực" value={formatDateTime(document.expiryDate)} />
              <InfoRow label="Lượt xem/tải" value={`${document.viewCount ?? '—'} / ${document.downloadCount ?? '—'}`} />
              <InfoRow label="Upload bởi" value={document.uploadedByName} />
            </div>
            {!!tags.length && (
              <div className={styles.tagList}>
                {tags.map((tag) => <Tag key={tag}>#{tag}</Tag>)}
              </div>
            )}
          </section>

          <section className={styles.infoCard}>
            <h3>Phòng ban có quyền xem</h3>
            {authorizedDepartments.length ? (
              <div className={styles.permissionPills}>
                {authorizedDepartments.map((department) => (
                  <span key={department.id} title={department.code || department.name}>
                    {department.name || department.code || `Phòng ban #${department.id}`}
                  </span>
                ))}
              </div>
            ) : (
              <p>Danh mục của tài liệu này chưa cấp quyền xem cho phòng ban nào.</p>
            )}
          </section>

          <section className={styles.infoCard}>
            <div className={styles.versionHeader}>
              <h3>Lịch sử phiên bản</h3>
              <button type="button" onClick={() => navigate(`/documents/${document.id}/history`)}>Xem tất cả</button>
            </div>
            <div className={styles.versionItem}>
              <strong>{document.version || document.currentVersion || 'Hiện tại'}</strong>
              <span>{formatDateTime(document.updatedAt || document.createdAt)}</span>
            </div>
          </section>

          {document.description && (
            <section className={styles.infoCard}>
              <h3>Mô tả</h3>
              <Paragraph className={styles.description}>{document.description}</Paragraph>
            </section>
          )}
        </aside>
      </section>

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
          <iframe title="Mở tài liệu" src={preview?.url} className={styles.previewFrame} />
        )}
      </Modal>
    </main>
  );
}
