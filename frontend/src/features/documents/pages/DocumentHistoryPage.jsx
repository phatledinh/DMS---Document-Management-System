import { useMemo, useRef, useState } from 'react';
import {
  AppstoreOutlined,
  BellOutlined,
  CheckCircleOutlined,
  DownloadOutlined,
  FileTextOutlined,
  FilterOutlined,
  FolderOpenOutlined,
  HistoryOutlined,
  QuestionCircleOutlined,
  ReloadOutlined,
  SearchOutlined,
  SecurityScanOutlined,
  SettingOutlined,
  ShopOutlined,
  StarFilled,
  TagsOutlined,
  TeamOutlined,
  UploadOutlined,
  DeleteOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { Alert, Modal, Spin, Form, Input, Tag } from 'antd';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  completeDocumentVersionUpload,
  getDocumentById,
  getDocumentVersionDownloadUrl,
  getDocumentVersionPreviewUrl,
  deleteDocumentVersion,
  getDocumentVersions,
  initDocumentVersionUpload,
  restoreDocumentVersion,
  uploadToPresignedUrl,
} from '../../../api/documentApi.js';
import { getApiErrorMessage } from '../../../utils/response.js';
import { formatDateTime, formatFileSize, normalizeDocument } from '../utils/documentFormatters.js';
import styles from './DocumentHistoryPage.module.css';


function getPresignedUrl(payload) {
  return payload?.url || payload?.downloadUrl || payload?.uploadUrl;
}

function getNextVersionNumber(versionsData) {
  if (!versionsData || versionsData.length === 0) return '1.1';
  let maxMajor = 0;
  let maxMinor = 0;
  for (const v of versionsData) {
    if (!v.versionNumber) continue;
    const parts = v.versionNumber.split('.');
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      const major = parseInt(parts[0], 10);
      const minor = parseInt(parts[1], 10);
      if (major > maxMajor || (major === maxMajor && minor > maxMinor)) {
        maxMajor = major;
        maxMinor = minor;
      }
    }
  }
  if (maxMajor === 0 && maxMinor === 0) return '1.1';
  return `${maxMajor}.${maxMinor + 1}`;
}

function initials(value) {
  const text = String(value || 'U').trim();
  return text.slice(0, 2).toUpperCase();
}

export default function DocumentHistoryPage() {
  const { slug } = useParams();
  const id = slug;
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadModalVisible, setIsUploadModalVisible] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadForm] = Form.useForm();

  const documentQuery = useQuery({
    queryKey: ['documents', slug],
    queryFn: () => getDocumentById(id),
    enabled: Boolean(id),
    refetchInterval: (query) => query.state?.data?.status === 'PROCESSING' ? 2000 : false,
  });
  const versionsQuery = useQuery({
    queryKey: ['documentVersions', id],
    queryFn: () => getDocumentVersions(id),
    enabled: Boolean(id),
    refetchInterval: (query) => {
      const data = query.state?.data;
      if (Array.isArray(data) && data.some(v => v.status === 'PROCESSING')) return 2000;
      return false;
    },
  });

  const document = normalizeDocument(documentQuery.data);
  const versions = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const rows = Array.isArray(versionsQuery.data) ? versionsQuery.data : [];
    const validRows = rows;
    if (!term) return validRows;
    return validRows.filter((item) => [item.versionNumber, item.fileName, item.changelog, item.uploadedBy]
      .some((value) => String(value || '').toLowerCase().includes(term)));
  }, [searchTerm, versionsQuery.data]);

  const hasPendingVersion = useMemo(() => {
    return Array.isArray(versionsQuery.data) && versionsQuery.data.some((v) => v.status === 'PENDING_APPROVAL');
  }, [versionsQuery.data]);

  async function refreshVersions() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['documents', slug] }),
      queryClient.invalidateQueries({ queryKey: ['documentVersions', id] }),
      documentQuery.refetch()
    ]);
  }

  async function handleDownload(version) {
    try {
      const downloadData = await getDocumentVersionDownloadUrl(id, version.id);
      const url = getPresignedUrl(downloadData);
      if (!url) throw new Error('Backend không trả về download URL.');
      const link = window.document.createElement('a');
      link.href = url;
      link.download = downloadData.fileName || version.fileName || 'document-version';
      link.rel = 'noopener noreferrer';
      window.document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  }

  async function handleRestore(version) {
    Modal.confirm({
      title: `Khôi phục phiên bản ${version.versionNumber}?`,
      content: 'Version hiện tại vẫn được giữ trong lịch sử. Backend sẽ xử lý lại và chỉ switch current sau khi thành công.',
      okText: 'Khôi phục',
      cancelText: 'Hủy',
      onOk: async () => {
        try {
          await restoreDocumentVersion(id, version.id);
          toast.success('Đã gửi yêu cầu khôi phục version.');
          await refreshVersions();
        } catch (error) {
          toast.error(getApiErrorMessage(error));
        }
      },
    });
  }

  function handleUploadFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setUploadFile(file);
    const versions = versionsQuery.data || [];
    const nextVersion = getNextVersionNumber(versions);
    uploadForm.resetFields();
    uploadForm.setFieldsValue({ versionNumber: nextVersion });
    setIsUploadModalVisible(true);
  }

  async function handlePreview(version) {
    try {
      const { url } = await getDocumentVersionPreviewUrl(id, version.id);
      window.open(url, '_blank');
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  }

  async function handleDelete(version) {
    Modal.confirm({
      title: `Xóa phiên bản ${version.versionNumber}?`,
      content: 'Bạn có chắc chắn muốn xóa vĩnh viễn phiên bản này? Hành động này không thể hoàn tác.',
      okText: 'Xóa',
      okType: 'danger',
      cancelText: 'Hủy',
      onOk: async () => {
        try {
          await deleteDocumentVersion(id, version.id);
          toast.success('Đã xóa phiên bản thành công.');
          await refreshVersions();
        } catch (error) {
          toast.error(getApiErrorMessage(error));
        }
      },
    });
  }

  async function submitUploadVersion(values) {
    if (!uploadFile) return;
    const { versionNumber, changelog } = values;

    setIsUploading(true);
    try {
      const initData = await initDocumentVersionUpload(id, {
        fileName: uploadFile.name,
        fileSize: uploadFile.size,
        contentType: uploadFile.type || 'application/octet-stream',
        versionNumber: versionNumber.trim(),
        changelog: changelog.trim(),
      });
      await uploadToPresignedUrl({
        uploadUrl: initData.uploadUrl,
        file: uploadFile,
        requiredHeaders: initData.requiredHeaders,
      });
      await completeDocumentVersionUpload(id, initData.versionId);
      toast.success('Version upload accepted và đang processing.');
      setIsUploadModalVisible(false);
      setUploadFile(null);
      await refreshVersions();
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setIsUploading(false);
    }
  }

  if (documentQuery.isLoading || versionsQuery.isLoading) {
    return <Spin fullscreen tip="Đang tải lịch sử phiên bản..." />;
  }

  if (documentQuery.isError || versionsQuery.isError) {
    return <Alert type="error" showIcon message={getApiErrorMessage(documentQuery.error || versionsQuery.error)} />;
  }

  return (
    <div className={styles.page}>

      <main className={styles.pageBody}>
        <input ref={fileInputRef} type="file" hidden onChange={handleUploadFile} />

        <div className={styles.canvas}>
          <div className={styles.container}>
            <nav className={styles.breadcrumbs}>
              <Link to="/">Home</Link><span>›</span><Link to="/documents">Tài liệu</Link><span>›</span><Link to={`/documents/${id}`}>{document?.title || document?.fileName || 'Chi tiết'}</Link><span>›</span><strong>Lịch sử phiên bản</strong>
            </nav>

            <section className={styles.documentHeader}>
              <div>
                <div className={styles.badgeRow}>
                  <span className={styles.codeBadge}>{document?.documentCode || document?.fileName || `#${id}`}</span>
                  <span className={styles.activeBadge}><CheckCircleOutlined />{document?.status || '—'}</span>
                </div>
                <h2>{document?.title || document?.fileName || 'Tài liệu'}</h2>
                <p>Lịch sử phiên bản</p>
              </div>
              <button 
                className={styles.primaryButton} 
                type="button" 
                onClick={() => {
                  if (hasPendingVersion) {
                    toast.info('Không thể tải lên khi đang có phiên bản chờ duyệt.');
                    return;
                  }
                  fileInputRef.current?.click();
                }} 
                disabled={isUploading}
                title={hasPendingVersion ? 'Không thể tải lên khi đang có phiên bản chờ duyệt' : ''}
              >
                <UploadOutlined />Tải lên phiên bản mới
              </button>
            </section>

            <section className={styles.filterBar}>
              <label className={styles.versionSearch}>
                <SearchOutlined />
                <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Tìm kiếm phiên bản hoặc người tải lên..." type="text" />
              </label>
              <button className={styles.filterButton} type="button"><FilterOutlined />Lọc</button>
            </section>

            <section className={styles.tablePanel}>
              <div className={styles.tableScroller}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Phiên bản</th>
                      <th>Người tải lên</th>
                      <th>Ngày tải lên</th>
                      <th>Ghi chú thay đổi</th>
                      <th>File</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {versions.map((item) => (
                      <tr key={item.id} className={item.current ? styles.currentRow : undefined}>
                        <td>
                          <div className={styles.versionCell}>
                            <strong>{item.versionNumber}</strong>
                            {item.current && <span><StarFilled />Hiện tại</span>}
                            {item.status === 'AWAITING_UPLOAD' && <Tag color="warning" style={{marginLeft: 8}}>Chờ tải lên</Tag>}
                            {item.status === 'PROCESSING' && <Tag color="blue" style={{marginLeft: 8}}>Đang xử lý</Tag>}
                            {item.status === 'EXTRACTION_FAILED' && <Tag color="error" style={{marginLeft: 8}}>Lỗi xử lý</Tag>}
                            {item.status === 'PENDING_APPROVAL' && <Tag color="gold" style={{marginLeft: 8}}>Chờ duyệt</Tag>}
                            {item.status === 'REJECTED' && <Tag color="red" style={{marginLeft: 8}}>Từ chối</Tag>}
                            {item.status === 'INDEXED' && <Tag color="green" style={{marginLeft: 8}}>Đã duyệt</Tag>}
                          </div>
                        </td>
                        <td>
                          <div className={styles.userCell}>
                            <span className={styles.tertiaryAvatar}>{initials(item.uploadedByName || item.uploadedBy)}</span>
                            <span>{item.uploadedByName || item.uploadedBy || '—'}</span>
                          </div>
                        </td>
                        <td className={styles.mutedCell}>{formatDateTime(item.createdAt)}</td>
                        <td className={styles.noteCell}>
                          {item.changelog || '—'}
                          {item.status === 'REJECTED' && item.rejectReason && (
                            <div style={{ color: 'red', marginTop: 4 }}>
                              <strong>Lý do từ chối:</strong> {item.rejectReason}
                            </div>
                          )}
                        </td>
                        <td className={styles.mutedCell}>{item.fileName || '—'} · {formatFileSize(item.fileSize)}</td>
                        <td>
                          <div className={styles.actionsCell}>
                            <button title="Download" type="button" onClick={() => handleDownload(item)} disabled={item.status !== 'INDEXED'}><DownloadOutlined /></button>
                            <button title="Xem trước" type="button" onClick={() => handlePreview(item)} disabled={item.status !== 'INDEXED'}><EyeOutlined /></button>
                            {!item.current && <button className={styles.restoreButton} title="Khôi phục" type="button" onClick={() => handleRestore(item)} disabled={item.status !== 'INDEXED'}><ReloadOutlined /></button>}
                            {!item.current && <button className={styles.deleteButton} title="Xóa" type="button" onClick={() => handleDelete(item)}><DeleteOutlined /></button>}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {versions.length === 0 && (
                      <tr><td colSpan={6} className={styles.mutedCell}>Chưa có phiên bản phù hợp.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      </main>

      <Modal
        title="Tải lên phiên bản mới"
        open={isUploadModalVisible}
        onCancel={() => {
          if (!isUploading) setIsUploadModalVisible(false);
        }}
        confirmLoading={isUploading}
        onOk={() => uploadForm.submit()}
        okText="Tải lên"
        cancelText="Hủy"
      >
        <p style={{ marginBottom: 16 }}>File đã chọn: <strong>{uploadFile?.name}</strong></p>
        <Form form={uploadForm} layout="vertical" onFinish={submitUploadVersion}>
          <Form.Item 
            label="Version Number" 
            name="versionNumber" 
            rules={[
              { required: true, message: 'Vui lòng nhập version number!' },
              { pattern: /^\d+(\.\d+){1,2}$/, message: 'Định dạng không hợp lệ (vd: 1.0, 1.0.1)' }
            ]}
          >
            <Input placeholder="Ví dụ: 1.3" />
          </Form.Item>
          <Form.Item 
            label="Ghi chú thay đổi (Changelog)" 
            name="changelog" 
            rules={[{ required: true, message: 'Vui lòng nhập ghi chú thay đổi!' }]}
          >
            <Input.TextArea placeholder="Nhập ghi chú thay đổi cho version này..." rows={4} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
