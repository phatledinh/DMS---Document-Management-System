import { useState } from 'react';
import {
  AppstoreOutlined,
  DeleteOutlined,
  EditOutlined,
  FilterOutlined,
  PlusOutlined,
  TagsOutlined,
  SettingOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { Button, Form, Input, Modal, Select } from 'antd';
import { toast } from 'react-toastify';
import styles from './TagsPage.module.css';


const initialTags = [
  { id: 1, name: 'ISO 9001', slug: 'iso-9001', count: 142, createdAt: '12/10/2023', tone: 'primary', icon: <TagsOutlined /> },
  { id: 2, name: 'Quy Trình', slug: 'quy-trinh', count: 85, createdAt: '15/10/2023', tone: 'success', icon: <AppstoreOutlined /> },
  { id: 3, name: 'Kỹ Thuật', slug: 'ky-thuat', count: 210, createdAt: '18/10/2023', tone: 'tertiary', icon: <SettingOutlined /> },
  { id: 4, name: 'Nhân Sự', slug: 'nhan-su', count: 56, createdAt: '20/10/2023', tone: 'warning', icon: <TeamOutlined /> },
  { id: 5, name: 'Quan Trọng', slug: 'quan-trong', count: 24, createdAt: '22/10/2023', tone: 'danger', icon: <PlusOutlined /> },
];

function slugify(value) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function TagsPage() {
  const [form] = Form.useForm();
  const [tags, setTags] = useState(initialTags);
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);

  function closeCreateModal() {
    setCreateModalOpen(false);
    form.resetFields();
  }

  function handleCreateTag(values) {
    const nextId = Math.max(...tags.map((tag) => tag.id), 0) + 1;
    const name = values.name.trim();
    setTags((current) => [
      ...current,
      {
        id: nextId,
        name,
        slug: values.slug?.trim() || slugify(name),
        count: 0,
        createdAt: new Date().toLocaleDateString('vi-VN'),
        tone: values.tone,
        icon: <TagsOutlined />,
      },
    ]);
    toast.success('Đã thêm tag mới');
    closeCreateModal();
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
                  <input placeholder="Lọc theo tên hoặc slug..." type="text" />
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
                    {tags.map((tag) => (
                      <tr key={tag.slug}>
                        <td>{tag.id}</td>
                        <td><span className={`${styles.tagPill} ${styles[tag.tone]}`}>{tag.icon}{tag.name}</span></td>
                        <td className={styles.slugCell}>{tag.slug}</td>
                        <td className={styles.countCell}><span>{tag.count}</span></td>
                        <td className={styles.dateCell}>{tag.createdAt}</td>
                        <td>
                          <div className={styles.rowActions}>
                            <button title="Chỉnh sửa" type="button"><EditOutlined /></button>
                            <button title="Xóa" type="button"><DeleteOutlined /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <footer className={styles.pagination}>
                <span>Hiển thị 1-5 trong số 24 tags</span>
                <div>
                  <button type="button" disabled>‹</button>
                  <button className={styles.currentPage} type="button">1</button>
                  <button type="button">2</button>
                  <button type="button">3</button>
                  <span>...</span>
                  <button type="button">5</button>
                  <button type="button">›</button>
                </div>
              </footer>
            </section>
          </div>
        </div>
      </main>

      <Modal
        title="Thêm tag mới"
        open={isCreateModalOpen}
        onCancel={closeCreateModal}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleCreateTag} initialValues={{ tone: 'primary' }}>
          <Form.Item name="name" label="Tên tag" rules={[{ required: true, message: 'Vui lòng nhập tên tag.' }]}>
            <Input placeholder="Ví dụ: Quan trọng" />
          </Form.Item>
          <Form.Item name="slug" label="Slug">
            <Input placeholder="Tự tạo nếu bỏ trống" />
          </Form.Item>
          <Form.Item name="tone" label="Màu hiển thị" rules={[{ required: true, message: 'Vui lòng chọn màu hiển thị.' }]}>
            <Select
              options={[
                { label: 'Xanh dương', value: 'primary' },
                { label: 'Xanh lá', value: 'success' },
                { label: 'Tím', value: 'tertiary' },
                { label: 'Vàng', value: 'warning' },
                { label: 'Đỏ', value: 'danger' },
              ]}
            />
          </Form.Item>
          <div className={styles.modalActions}>
            <Button onClick={closeCreateModal}>Hủy</Button>
            <Button type="primary" htmlType="submit" icon={<PlusOutlined />}>
              Thêm tag
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
