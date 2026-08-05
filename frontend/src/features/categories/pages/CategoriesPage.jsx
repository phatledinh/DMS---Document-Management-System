import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DeleteOutlined,
  DownOutlined,
  EditOutlined,
  FolderFilled,
  FolderOpenFilled,
  PlusOutlined,
  RightOutlined,
  UpOutlined,
} from '@ant-design/icons';
import { Button, Form, Input, Modal, Switch, TreeSelect } from 'antd';
import { toast } from 'react-toastify';
import {
  createCategory,
  deleteCategory,
  getCategories,
  updateCategory,
} from '../../../api/categoryApi.js';
import { getApiErrorMessage } from '../../../utils/response.js';
import styles from './CategoriesPage.module.css';

function normalizeList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.content)) return data.content;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

function buildCategoryTree(categories) {
  const byId = new Map(categories.map((category) => [category.id, { ...category, children: [] }]));
  const roots = [];

  byId.forEach((category) => {
    if (category.parentId && byId.has(category.parentId)) {
      byId.get(category.parentId).children.push(category);
    } else {
      roots.push(category);
    }
  });

  return roots;
}

function buildTreeSelectData(tree, excludeId = null) {
  return tree
    .filter((node) => node.id !== excludeId)
    .map((node) => ({
      title: node.name,
      value: node.id,
      children: node.children?.length > 0 ? buildTreeSelectData(node.children, excludeId) : [],
    }));
}

function collectAllIds(tree) {
  const ids = new Set();
  function walk(nodes) {
    for (const node of nodes) {
      if (node.children?.length > 0) {
        ids.add(node.id);
        walk(node.children);
      }
    }
  }
  walk(tree);
  return ids;
}

function TreeNode({ item, isLast, level = 0, expandedIds, onToggle, onAddChild, onEdit, onDelete }) {
  const hasChildren = item.children?.length > 0;
  const isExpanded = expandedIds.has(item.id);

  return (
    <div className={`${styles.treeNode} ${isLast ? styles.lastNode : ''}`}>
      <div className={styles.nodeRow}>
        {level > 0 && <div className={styles.childConnector} />}
        <div className={styles.nodeMain}>
          {hasChildren ? (
            <button
              type="button"
              className={styles.chevronButton}
              onClick={() => onToggle(item.id)}
              title={isExpanded ? 'Thu gọn' : 'Mở rộng'}
            >
              {isExpanded ? <DownOutlined className={styles.chevron} /> : <RightOutlined className={styles.chevron} />}
            </button>
          ) : (
            <span className={styles.chevronPlaceholder}>›</span>
          )}
          {hasChildren && isExpanded
            ? <FolderOpenFilled className={item.isActive ? styles.folderPrimary : styles.folderIcon} />
            : <FolderFilled className={item.isActive ? styles.folderPrimary : styles.folderIcon} />
          }
          <strong>{item.name}</strong>
          <span>({item.slug})</span>
          {hasChildren && <span className={styles.childCount}>{item.children.length}</span>}
        </div>
        <div className={styles.nodeActions}>
          <button title="Thêm danh mục con" type="button" onClick={() => onAddChild(item)}><PlusOutlined /></button>
          <button title="Sửa" type="button" onClick={() => onEdit(item)}><EditOutlined /></button>
          <button title="Xóa" type="button" onClick={() => onDelete(item)}><DeleteOutlined /></button>
        </div>
      </div>
      {hasChildren && isExpanded && (
        <div className={styles.children}>
          {item.children.map((child, index) => (
            <TreeNode
              key={child.id}
              item={child}
              isLast={index === item.children.length - 1}
              level={level + 1}
              expandedIds={expandedIds}
              onToggle={onToggle}
              onAddChild={onAddChild}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CategoriesPage() {
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [categories, setCategories] = useState([]);
  const [isLoading, setLoading] = useState(false);
  const [isSubmitting, setSubmitting] = useState(false);
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [expandedIds, setExpandedIds] = useState(new Set());

  const categoryTree = useMemo(() => buildCategoryTree(categories), [categories]);

  const handleToggle = useCallback((id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  function expandAll() {
    setExpandedIds(collectAllIds(categoryTree));
  }

  function collapseAll() {
    setExpandedIds(new Set());
  }

  async function loadCategories() {
    setLoading(true);
    try {
      const data = await getCategories({ activeOnly: false });
      setCategories(normalizeList(data));
    } catch (error) {
      toast.error(getApiErrorMessage(error));
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCategories();
  }, []);

  function closeCreateModal() {
    setCreateModalOpen(false);
    form.resetFields();
  }

  function closeEditModal() {
    setEditModalOpen(false);
    setEditingCategory(null);
    editForm.resetFields();
  }

  function openCreateModal(parentId = null) {
    form.setFieldsValue({ parentId, isActive: true });
    setCreateModalOpen(true);
  }

  function openEditModal(category) {
    setEditingCategory(category);
    editForm.setFieldsValue({
      parentId: category.parentId,
      name: category.name,
      slug: category.slug,
      description: category.description,
      icon: category.icon,
      sortOrder: category.sortOrder,
      isActive: category.isActive,
    });
    setEditModalOpen(true);
  }

  function toPayload(values) {
    return {
      parentId: values.parentId || null,
      name: values.name.trim(),
      slug: values.slug?.trim() || null,
      description: values.description?.trim() || null,
      icon: values.icon?.trim() || null,
      sortOrder: Number(values.sortOrder || 0),
      isActive: values.isActive ?? true,
    };
  }

  async function handleCreateCategory(values) {
    setSubmitting(true);
    try {
      await createCategory(toPayload(values));
      toast.success('Đã thêm danh mục mới');
      closeCreateModal();
      await loadCategories();
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdateCategory(values) {
    if (!editingCategory) return;
    setSubmitting(true);
    try {
      await updateCategory(editingCategory.id, toPayload(values));
      toast.success('Đã cập nhật danh mục');
      closeEditModal();
      await loadCategories();
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  function handleDeleteCategory(category) {
    Modal.confirm({
      title: 'Xác nhận xóa',
      content: `Bạn có chắc chắn muốn xóa danh mục "${category.name}"?`,
      okText: 'Xóa',
      okType: 'danger',
      cancelText: 'Hủy',
      onOk: async () => {
        try {
          await deleteCategory(category.id);
          toast.success('Đã xóa danh mục');
          await loadCategories();
        } catch (error) {
          toast.error(getApiErrorMessage(error));
        }
      },
    });
  }

  function renderCategoryForm(targetForm, onFinish, submitText) {
    const treeData = buildTreeSelectData(categoryTree, editingCategory?.id);

    return (
      <Form form={targetForm} layout="vertical" onFinish={onFinish} initialValues={{ isActive: true, sortOrder: 0 }}>
        <Form.Item name="name" label="Tên danh mục" rules={[{ required: true, message: 'Vui lòng nhập tên danh mục.' }]}>
          <Input placeholder="Ví dụ: Quy trình nội bộ" />
        </Form.Item>
        <Form.Item name="slug" label="Slug">
          <Input placeholder="Tự tạo nếu bỏ trống" />
        </Form.Item>
        <Form.Item name="parentId" label="Danh mục cha">
          <TreeSelect
            allowClear
            showSearch
            treeDefaultExpandAll
            placeholder="Không chọn nếu là danh mục gốc"
            treeData={treeData}
            treeLine
            filterTreeNode={(input, node) =>
              node.title.toLowerCase().includes(input.toLowerCase())
            }
          />
        </Form.Item>
        <Form.Item name="description" label="Mô tả">
          <Input.TextArea rows={3} placeholder="Nhập mô tả ngắn cho danh mục" />
        </Form.Item>
        <Form.Item name="icon" label="Icon">
          <Input placeholder="Ví dụ: Folder" />
        </Form.Item>
        <Form.Item name="sortOrder" label="Thứ tự sắp xếp">
          <Input type="number" min={0} />
        </Form.Item>
        <Form.Item name="isActive" label="Trạng thái" valuePropName="checked">
          <Switch checkedChildren="Hoạt động" unCheckedChildren="Không hoạt động" />
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
                <h2>QUẢN LÝ DANH MỤC</h2>
                <p>Quản lý cấu trúc và phân loại tài liệu trong hệ thống.</p>
              </div>
              <button className={styles.primaryButton} type="button" onClick={() => openCreateModal()}><PlusOutlined />Thêm mới</button>
            </section>

            <section className={styles.treePanel}>
              <div className={styles.treeHeader}>
                <h3>Cấu trúc danh mục</h3>
                <div>
                  <button title="Mở rộng tất cả" type="button" onClick={expandAll}><DownOutlined /></button>
                  <button title="Thu gọn tất cả" type="button" onClick={collapseAll}><UpOutlined /></button>
                </div>
              </div>
              <div className={styles.treeContent}>
                {isLoading && <div>Đang tải danh mục...</div>}
                {!isLoading && categoryTree.length === 0 && <div>Chưa có danh mục nào</div>}
                {!isLoading && categoryTree.map((item, index) => (
                  <TreeNode
                    key={item.id}
                    item={item}
                    isLast={index === categoryTree.length - 1}
                    expandedIds={expandedIds}
                    onToggle={handleToggle}
                    onAddChild={(category) => openCreateModal(category.id)}
                    onEdit={openEditModal}
                    onDelete={handleDeleteCategory}
                  />
                ))}
              </div>
            </section>
          </div>
        </div>
      </main>

      <Modal title="Thêm danh mục mới" open={isCreateModalOpen} onCancel={closeCreateModal} footer={null} destroyOnClose>
        {renderCategoryForm(form, handleCreateCategory, 'Thêm danh mục')}
      </Modal>

      <Modal title="Cập nhật danh mục" open={isEditModalOpen} onCancel={closeEditModal} footer={null} destroyOnClose>
        {renderCategoryForm(editForm, handleUpdateCategory, 'Cập nhật')}
      </Modal>
    </div>
  );
}
