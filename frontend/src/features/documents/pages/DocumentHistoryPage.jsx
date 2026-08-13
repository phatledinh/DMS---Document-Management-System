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
} from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { Alert, Modal, Spin } from 'antd';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  completeDocumentVersionUpload,
  getDocumentById,
  getDocumentVersionDownloadUrl,
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

function initials(value) {
  const text = String(value || 'U').trim();
  return text.slice(0, 2).toUpperCase();
}

export default function DocumentHistoryPage() {
  const { slug } = useParams();
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const documentQuery = useQuery({
    queryKey: ['documents', slug],
    queryFn: () => getDocumentById(id),
    enabled: Boolean(id),
  });
  const versionsQuery = useQuery({
    queryKey: ['documentVersions', id],
    queryFn: () => getDocumentVersions(id),
    enabled: Boolean(id),
  });

  const document = normalizeDocument(documentQuery.data);
  const versions = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const rows = Array.isArray(versionsQuery.data) ? versionsQuery.data : [];
    if (!term) return rows;
    return rows.filter((item) => [item.versionNumber, item.fileName, item.changelog, item.uploadedBy]
      .some((value) => String(value || '').toLowerCase().includes(term)));
  }, [searchTerm, versionsQuery.data]);

  async function refreshVersions() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['documents', slug] }),
      queryClient.invalidateQueries({ queryKey: ['documentVersions', id] }),
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

  async function handleUploadFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const versionNumber = window.prompt('Nhập version number mới, ví dụ 1.3');
    if (!versionNumber?.trim()) return;
    const changelog = window.prompt('Nhập ghi chú thay đổi cho version này');
    if (!changelog?.trim()) return;

    setIsUploading(true);
    try {
      const initData = await initDocumentVersionUpload(id, {
        fileName: file.name,
        fileSize: file.size,
        contentType: file.type || 'application/octet-stream',
        versionNumber: versionNumber.trim(),
        changelog: changelog.trim(),
      });
      await uploadToPresignedUrl({
        uploadUrl: initData.uploadUrl,
        file,
        requiredHeaders: initData.requiredHeaders,
      });
      await completeDocumentVersionUpload(id, initData.versionId);
      toast.success('Version upload accepted và đang processing.');
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
              <Link to="/">Home</Link><span>›</span><Link to="/documents">Tài liệu</Link><span>›</span><Link to={`/documents/`}>{document?.title || document?.fileName || 'Chi tiết'}</Link><span>›</span><strong>Lịch sử phiên bản</strong>
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
              <button className={styles.primaryButton} type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
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
                          </div>
                        </td>
                        <td>
                          <div className={styles.userCell}>
                            <span className={styles.tertiaryAvatar}>{initials(item.uploadedBy)}</span>
                            <span>{item.uploadedBy || '—'}</span>
                          </div>
                        </td>
                        <td className={styles.mutedCell}>{formatDateTime(item.createdAt)}</td>
                        <td className={styles.noteCell}>{item.changelog || '—'}</td>
                        <td className={styles.mutedCell}>{item.fileName || '—'} · {formatFileSize(item.fileSize)}</td>
                        <td>
                          <div className={styles.actionsCell}>
                            <button title="Download" type="button" onClick={() => handleDownload(item)} disabled={item.status !== 'INDEXED'}><DownloadOutlined /></button>
                            {!item.current && <button className={styles.restoreButton} title="Khôi phục" type="button" onClick={() => handleRestore(item)} disabled={item.status !== 'INDEXED'}><ReloadOutlined /></button>}
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
    </div>
  );
}
