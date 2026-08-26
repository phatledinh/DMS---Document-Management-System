import dayjs from 'dayjs';

const STATUS_META = {
  AWAITING_UPLOAD: { label: 'Chờ upload', color: 'default' },
  PROCESSING: { label: 'Đang xử lý/OCR/preview', color: 'processing' },
  PENDING_APPROVAL: { label: 'Chờ duyệt', color: 'gold' },
  INDEXED: { label: 'Sẵn sàng', color: 'success' },
  EXTRACTION_FAILED: { label: 'Lỗi xử lý/OCR/preview', color: 'error' },
  REJECTED: { label: 'Bị từ chối', color: 'red' },
  ARCHIVED: { label: 'Lưu trữ', color: 'warning' },
  DELETED: { label: 'Đã xóa', color: 'default' },
};

export function formatFileSize(bytes) {
  if (bytes === null || bytes === undefined || bytes === '') return '—';
  const size = Number(bytes);
  if (!Number.isFinite(size)) return String(bytes);
  if (size === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB'];
  const unitIndex = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
  return `${(size / 1024 ** unitIndex).toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export function formatDateTime(value) {
  if (!value) return '—';
  const date = dayjs(value);
  return date.isValid() ? date.format('DD/MM/YYYY HH:mm') : String(value);
}

export function getDocumentStatusMeta(status) {
  return STATUS_META[status] || { label: status || 'Không rõ', color: 'default' };
}

export function normalizeDocument(document) {
  if (!document) return null;
  return {
    ...document,
    id: document.id ?? document.documentId,
    documentCode: document.documentCode ?? document.code,
    fileName: document.fileName ?? document.originalFileName,
    fileSize: document.fileSize ?? document.size,
    categoryName: document.categoryName ?? document.category?.name ?? document.category,
    departmentName: document.departmentName ?? document.department?.name ?? document.department,
    uploadedByName: document.uploadedByName ?? document.uploadedBy?.name ?? document.uploadedBy,
    createdAt: document.createdAt ?? document.uploadedAt,
  };
}

export function getPageContent(pageData) {
  return pageData?.content || pageData?.items || pageData?.data || [];
}
