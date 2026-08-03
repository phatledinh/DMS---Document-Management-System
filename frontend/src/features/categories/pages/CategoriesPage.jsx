import { useState } from 'react';
import {
  DownOutlined,
  FolderOpenFilled,
  MoreOutlined,
  PlusOutlined,
  UpOutlined,
} from '@ant-design/icons';
import { Button, Form, Input, Modal, Select } from 'antd';
import { toast } from 'react-toastify';
import styles from './CategoriesPage.module.css';


const initialCategoryTree = [
  {
    name: 'Quy trình ISO',
    count: '25 tài liệu',
    expanded: true,
    children: [
      { name: 'ISO 9001 - Chất lượng', count: '10' },
      { name: 'ISO 14001 - Môi trường', count: '8', selected: true },
      { name: 'ISO 45001 - An toàn', count: '7' },
    ],
  },
  {
    name: 'Biểu mẫu',
    count: '50 tài liệu',
    expanded: true,
    children: [
      { name: 'Biểu mẫu nhân sự', count: '20' },
      { name: 'Biểu mẫu kế toán', count: '15' },
      { name: 'Biểu mẫu kỹ thuật', count: '15' },
    ],
  },
  { name: 'SOP', count: '30 tài liệu' },
  { name: 'Hướng dẫn', count: '20 tài liệu' },
];

function TreeNode({ item, isLast }) {
  return (
    <div className={`${styles.treeNode} ${isLast ? styles.lastNode : ''}`}>
      <div className={styles.nodeRow}>
        <div className={styles.nodeMain}>
          {item.expanded ? <DownOutlined className={styles.chevron} /> : <span className={styles.chevronPlaceholder}>›</span>}
          <FolderOpenFilled className={item.selected ? styles.folderPrimary : styles.folderIcon} />
          <strong>{item.name}</strong>
          <span>({item.count})</span>
        </div>
        <div className={styles.nodeActions}>
          <button type="button"><PlusOutlined /></button>
          <button type="button"><MoreOutlined /></button>
        </div>
      </div>
      {item.children && (
        <div className={styles.children}>
          {item.children.map((child, index) => (
            <div key={child.name} className={`${styles.childRow} ${child.selected ? styles.childSelected : ''}`}>
              <div className={styles.childConnector} />
              <span className={styles.childChevron}>›</span>
              <FolderOpenFilled className={child.selected ? styles.folderPrimary : styles.folderMuted} />
              <span className={child.selected ? styles.childSelectedText : undefined}>{child.name}</span>
              <small>({child.count})</small>
              <button type="button"><MoreOutlined /></button>
              {index === item.children.length - 1 && <div className={styles.lastChildMask} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CategoriesPage() {
  const [form] = Form.useForm();
  const [categoryTree, setCategoryTree] = useState(initialCategoryTree);
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);

  function closeCreateModal() {
    setCreateModalOpen(false);
    form.resetFields();
  }

  function handleCreateCategory(values) {
    const newCategory = {
      name: values.name.trim(),
      count: '0 tài liệu',
      description: values.description?.trim(),
    };

    if (values.parentName) {
      setCategoryTree((current) => current.map((category) => {
        if (category.name !== values.parentName) return category;
        return {
          ...category,
          expanded: true,
          children: [...(category.children || []), { ...newCategory, count: '0' }],
        };
      }));
    } else {
      setCategoryTree((current) => [...current, newCategory]);
    }

    toast.success('Đã thêm danh mục mới');
    closeCreateModal();
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
              <button className={styles.primaryButton} type="button" onClick={() => setCreateModalOpen(true)}><PlusOutlined />Thêm mới</button>
            </section>

            <section className={styles.treePanel}>
              <div className={styles.treeHeader}>
                <h3>Cấu trúc danh mục</h3>
                <div>
                  <button title="Mở rộng tất cả" type="button"><DownOutlined /></button>
                  <button title="Thu gọn tất cả" type="button"><UpOutlined /></button>
                </div>
              </div>
              <div className={styles.treeContent}>
                {categoryTree.map((item, index) => (
                  <TreeNode key={item.name} item={item} isLast={index === categoryTree.length - 1} />
                ))}
              </div>
            </section>
          </div>
        </div>
      </main>

      <Modal
        title="Thêm danh mục mới"
        open={isCreateModalOpen}
        onCancel={closeCreateModal}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleCreateCategory}>
          <Form.Item
            name="name"
            label="Tên danh mục"
            rules={[{ required: true, message: 'Vui lòng nhập tên danh mục.' }]}
          >
            <Input placeholder="Ví dụ: Quy trình nội bộ" />
          </Form.Item>
          <Form.Item name="parentName" label="Danh mục cha">
            <Select
              allowClear
              placeholder="Không chọn nếu là danh mục gốc"
              options={categoryTree.map((category) => ({ label: category.name, value: category.name }))}
            />
          </Form.Item>
          <Form.Item name="description" label="Mô tả">
            <Input.TextArea rows={3} placeholder="Nhập mô tả ngắn cho danh mục" />
          </Form.Item>
          <div className={styles.modalActions}>
            <Button onClick={closeCreateModal}>Hủy</Button>
            <Button type="primary" htmlType="submit" icon={<PlusOutlined />}>
              Thêm danh mục
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
