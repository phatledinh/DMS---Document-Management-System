import { useEffect, useState } from 'react';
import {
  AppstoreOutlined,
  DeleteOutlined,
  EditOutlined,
  FilterOutlined,
  PlusOutlined,
  TagsOutlined,
} from '@ant-design/icons';
import { Button, Form, Input, Modal } from 'antd';
import { toast } from 'react-toastify';
import {
  createTag,
  deleteTag,
  getTags,
  updateTag,
} from '../../../api/tagApi.js';
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
  const [isLoading, setLoading] = useState(false);
  const [isSubmitting, setSubmitting] = useState(false);
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [editingTag, setEditingTag] = useState(null);

  const filteredTags = tags.filter((tag) => {
    const keyword = filterText.trim().toLowerCase();
    if (!keyword) return true;
    return tag.name?.toLowerCase().includes(keyword) || tag.slug?.toLowerCase().includes(keyword);
  });

  async function loadTags() {
    setLoading(true);
    try {
      const data = await getTags();
      setTags(normalizeList(data));
    } catch (error) {
      toast.error(getApiErrorMessage(error));
      setTags([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTags();
  }, []);

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
                <h2>QUẢN LÝ TAGS</h2>
                <p>Quản lý danh sách các thẻ phân loại tài liệu trong hệ thống.</p>
              </div>
              <button className={styles.primaryButton} type="button" onClick={() => setCreateModalOpen(true)}><PlusOutlined />Thêm tag mới</button>
            </section>

            <section className={styles.tablePanel}>
              <div className={styles.toolbar}>
                <label className={styles.filterBox}>
                  <FilterOutlined />
                  <input placeholder="Lọc theo tên hoặc slug..." type="text" value={filterText} onChange={(event) => setFilterText(event.target.value)} />
                </label>
                <div className={styles.pageSize}>Hiển thị:<select defaultValue="10"><option>10</option><option>20</option><option>50</option></select><span>/ trang</span></div>
              </div>

              <div className={styles.tableScroller}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Tên Tag</th>
                      <th>Slug</th>
                      <th>Số Tài Liệu</th>
                      <th>Ngày Tạo</th>
                      <th>Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading && (
                      <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>Đang tải tags...</td></tr>
                    )}
                    {!isLoading && filteredTags.length === 0 && (
                      <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>Chưa có tag nào</td></tr>
                    )}
                    {!isLoading && filteredTags.map((tag, index) => (
                      <tr key={tag.id || tag.slug}>
                        <td>{index + 1}</td>
                        <td><span className={`${styles.tagPill} ${styles.primary}`}><TagsOutlined />{tag.name}</span></td>
                        <td className={styles.slugCell}>{tag.slug}</td>
                        <td className={styles.countCell}><span>{tag.documentCount ?? 0}</span></td>
                        <td className={styles.dateCell}>{formatDate(tag.createdAt)}</td>
                        <td>
                          <div className={styles.rowActions}>
                            <button title="Chỉnh sửa" type="button" onClick={() => openEditModal(tag)}><EditOutlined /></button>
                            <button title="Xóa" type="button" onClick={() => handleDeleteTag(tag)}><DeleteOutlined /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <footer className={styles.pagination}>
                <span>Hiển thị <strong>{filteredTags.length ? 1 : 0}</strong> đến <strong>{filteredTags.length}</strong> trong <strong>{filteredTags.length}</strong> tags</span>
                <div>
                  <button type="button" disabled>‹</button>
                  <button className={styles.currentPage} type="button">1</button>
                  <button type="button" disabled>›</button>
                </div>
              </footer>
            </section>
          </div>
        </div>
      </main>

      <Modal title="Thêm tag mới" open={isCreateModalOpen} onCancel={closeCreateModal} footer={null} destroyOnClose>
        {renderTagForm(form, handleCreateTag, 'Thêm tag')}
      </Modal>

      <Modal title="Cập nhật tag" open={isEditModalOpen} onCancel={closeEditModal} footer={null} destroyOnClose>
        {renderTagForm(editForm, handleUpdateTag, 'Cập nhật')}
      </Modal>
    </div>
  );
}
