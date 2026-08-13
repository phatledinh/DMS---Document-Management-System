import { useEffect, useMemo, useState } from 'react';
import {
  DeleteOutlined,
  EditOutlined,
  FileTextOutlined,
  PlusOutlined,
  SearchOutlined,
  TagsOutlined,
} from '@ant-design/icons';
import { Button, Form, Input, Modal } from 'antd';
import { toast } from 'react-toastify';
import { searchDocuments } from '../../../api/searchApi.js';
import {
  createTag,
  deleteTag,
  getTags,
  updateTag,
} from '../../../api/tagApi.js';
import { formatDateTime, formatFileSize, getPageContent, normalizeDocument } from '../../documents/utils/documentFormatters.js';
import { getApiErrorMessage } from '../../../utils/response.js';
import styles from './TagsPage.module.css';

function normalizeList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.content)) return data.content;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('vi-VN').format(new Date(value));
}

export default function TagsPage() {
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [tags, setTags] = useState([]);
  const [filterText, setFilterText] = useState('');
  const [selectedTagId, setSelectedTagId] = useState(null);
  const [relatedDocuments, setRelatedDocuments] = useState([]);
  const [relatedTotal, setRelatedTotal] = useState(0);
  const [isLoading, setLoading] = useState(false);
  const [isLoadingDocuments, setLoadingDocuments] = useState(false);
  const [isSubmitting, setSubmitting] = useState(false);
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [editingTag, setEditingTag] = useState(null);

  const filteredTags = useMemo(() => {
    const keyword = filterText.trim().toLowerCase();
    if (!keyword) return tags;
    return tags.filter((tag) => tag.name?.toLowerCase().includes(keyword) || tag.slug?.toLowerCase().includes(keyword));
  }, [filterText, tags]);

  const selectedTag = useMemo(() => {
    return tags.find((tag) => tag.id === selectedTagId) || filteredTags[0] || null;
  }, [filteredTags, selectedTagId, tags]);

  async function loadTags() {
    setLoading(true);
    try {
      const data = await getTags();
      const list = normalizeList(data);
      setTags(list);
      setSelectedTagId((currentId) => {
        if (currentId && list.some((tag) => tag.id === currentId)) return currentId;
        return list[0]?.id || null;
      });
    } catch (error) {
      toast.error(getApiErrorMessage(error));
      setTags([]);
      setSelectedTagId(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTags();
  }, []);

  useEffect(() => {
    if (!selectedTag?.id) {
      setRelatedDocuments([]);
      setRelatedTotal(0);
      return;
    }

    async function loadRelatedDocuments() {
      setLoadingDocuments(true);
      try {
        const data = await searchDocuments({ tagIds: selectedTag.id, page: 0, size: 5, sort: 'created_at_desc' });
        setRelatedDocuments(getPageContent(data).map((item) => normalizeDocument(item.document || item)).filter(Boolean));
        setRelatedTotal(data?.totalElements ?? data?.total ?? getPageContent(data).length);
      } catch {
        setRelatedDocuments([]);
        setRelatedTotal(0);
      } finally {
        setLoadingDocuments(false);
      }
    }

    loadRelatedDocuments();
  }, [selectedTag?.id]);

  function closeCreateModal() {
    setCreateModalOpen(false);
    form.resetFields();
  }

  function closeEditModal() {
    setEditModalOpen(false);
    setEditingTag(null);
    editForm.resetFields();
  }

  function openEditModal(tag) {
    setEditingTag(tag);
    editForm.setFieldsValue({ name: tag.name, slug: tag.slug });
    setEditModalOpen(true);
  }

  function toPayload(values) {
    return {
      name: values.name.trim(),
      slug: values.slug?.trim() || null,
    };
  }

  async function handleCreateTag(values) {
    setSubmitting(true);
    try {
      await createTag(toPayload(values));
      toast.success('Đã thêm tag mới');
      closeCreateModal();
      await loadTags();
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdateTag(values) {
    if (!editingTag) return;
    setSubmitting(true);
    try {
      await updateTag(editingTag.id, toPayload(values));
      toast.success('Đã cập nhật tag');
      closeEditModal();
      await loadTags();
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  function handleDeleteTag(tag) {
    Modal.confirm({
      title: 'Xác nhận xóa',
      content: `Bạn có chắc chắn muốn xóa tag "${tag.name}"?`,
      okText: 'Xóa',
      okType: 'danger',
      cancelText: 'Hủy',
      onOk: async () => {
        try {
          await deleteTag(tag.id);
          toast.success('Đã xóa tag');
          await loadTags();
        } catch (error) {
          toast.error(getApiErrorMessage(error));
        }
      },
    });
  }

  function renderTagForm(targetForm, onFinish, submitText) {
    return (
      <Form form={targetForm} layout="vertical" onFinish={onFinish}>
        <Form.Item name="name" label="Tên tag" rules={[{ required: true, message: 'Vui lòng nhập tên tag.' }]}>
          <Input placeholder="Ví dụ: Quan trọng" />
        </Form.Item>
        <Form.Item name="slug" label="Slug">
          <Input placeholder="Tự tạo nếu bỏ trống" />
        </Form.Item>
        <div className={styles.modalActions}>
          <Button onClick={submitText === 'Cập nhật' ? closeEditModal : closeCreateModal}>Hủy</Button>
          <Button type="primary" htmlType="submit" icon={<PlusOutlined />} loading={isSubmitting}>{submitText}</Button>
        </div>
      </Form>
    );
  }

  return (
    <div className={styles.page}>
      <main className={styles.pageBody}>
        <div className={styles.canvas}>
          <div className={styles.container}>
            <section className={styles.pageHeader}>
              <div>
                <h1>Quản lý tags</h1>
                <p>Phân loại tài liệu bằng các thẻ chủ đề, trạng thái và nghiệp vụ.</p>
              </div>
              <button className={styles.primaryButton} type="button" onClick={() => setCreateModalOpen(true)}>
                <PlusOutlined /> Thêm tag mới
              </button>
            </section>

            <section className={styles.searchPanel}>
              <SearchOutlined className={styles.searchIcon} />
              <input placeholder="Tìm tag theo tên hoặc slug..." type="search" value={filterText} onChange={(event) => setFilterText(event.target.value)} />
            </section>

            <section className={styles.managementGrid}>
              <div className={styles.itemList}>
                {isLoading && <div className={styles.emptyState}>Đang tải tags...</div>}
                {!isLoading && filteredTags.length === 0 && <div className={styles.emptyState}>Không tìm thấy tag phù hợp</div>}
                {!isLoading && filteredTags.map((tag) => {
                  const isSelected = selectedTag?.id === tag.id;
                  return (
                    <button key={tag.id || tag.slug} type="button" className={isSelected ? `${styles.itemCard} ${styles.itemCardActive}` : styles.itemCard} onClick={() => setSelectedTagId(tag.id)}>
                      <span className={styles.itemIcon}><TagsOutlined /></span>
                      <span className={styles.itemContent}>
                        <span className={styles.itemName}>{tag.name}</span>
                        <span className={styles.itemMeta}>#{tag.slug || 'chua-co-slug'} · {tag.documentCount ?? 0} tài liệu</span>
                      </span>
                      <span className={styles.cardActions}>
                        <span role="button" tabIndex={0} title="Sửa" className={styles.iconAction} onClick={(event) => { event.stopPropagation(); openEditModal(tag); }} onKeyDown={(event) => { if (event.key === 'Enter') { event.stopPropagation(); openEditModal(tag); } }}><EditOutlined /></span>
                        <span role="button" tabIndex={0} title="Xóa" className={styles.iconAction} onClick={(event) => { event.stopPropagation(); handleDeleteTag(tag); }} onKeyDown={(event) => { if (event.key === 'Enter') { event.stopPropagation(); handleDeleteTag(tag); } }}><DeleteOutlined /></span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <aside className={styles.detailPanel}>
                {selectedTag ? (
                  <>
                    <div className={styles.detailHeader}>
                      <span className={styles.detailIcon}><TagsOutlined /></span>
                      <div>
                        <h2>{selectedTag.name}</h2>
                        <p>#{selectedTag.slug || 'chua-co-slug'}</p>
                      </div>
                    </div>
                    <div className={styles.detailStats}>
                      <div><strong>{relatedTotal || selectedTag.documentCount || 0}</strong><span>Tài liệu</span></div>
                      <div><strong>{formatDate(selectedTag.createdAt)}</strong><span>Ngày tạo</span></div>
                    </div>
                    <div className={styles.relatedHeader}>Tài liệu gắn tag này</div>
                    <div className={styles.documentList}>
                      {isLoadingDocuments && <div className={styles.emptyState}>Đang tải tài liệu...</div>}
                      {!isLoadingDocuments && relatedDocuments.length === 0 && <div className={styles.emptyState}>Chưa có tài liệu liên quan</div>}
                      {!isLoadingDocuments && relatedDocuments.map((doc) => (
                        <div className={styles.documentCard} key={doc.id}>
                          <FileTextOutlined />
                          <div>
                            <strong>{doc.title || doc.fileName}</strong>
                            <span>{doc.documentCode || '—'} · {formatFileSize(doc.fileSize)} · {formatDateTime(doc.updatedAt || doc.createdAt)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className={styles.emptyState}>Chọn một tag để xem chi tiết</div>
                )}
              </aside>
            </section>
          </div>
        </div>
      </main>

      <Modal title="Thêm tag mới" open={isCreateModalOpen} onCancel={closeCreateModal} footer={null} destroyOnHidden>
        {renderTagForm(form, handleCreateTag, 'Thêm tag')}
      </Modal>

      <Modal title="Cập nhật tag" open={isEditModalOpen} onCancel={closeEditModal} footer={null} destroyOnHidden>
        {renderTagForm(editForm, handleUpdateTag, 'Cập nhật')}
      </Modal>
    </div>
  );
}
