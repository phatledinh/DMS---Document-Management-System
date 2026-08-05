import { useEffect, useState } from 'react';
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { Button, Form, Input, Modal, Switch } from 'antd';
import { toast } from 'react-toastify';
import {
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment
} from '../../../api/departmentApi.js';
import { getApiErrorMessage } from '../../../utils/response.js';
import styles from './DepartmentsPage.module.css';

export default function DepartmentsPage() {
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  
  const [departments, setDepartments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState(null);

  async function loadDepartments() {
    setIsLoading(true);
    try {
      const data = await getDepartments();
      // Ensure we extract array properly if backend wraps it
      const list = Array.isArray(data) ? data : (data?.content || data?.items || []);
      setDepartments(list);
    } catch (error) {
      toast.error(getApiErrorMessage(error) || 'Lỗi khi tải danh sách phòng ban');
      setDepartments([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadDepartments();
  }, []);

  function closeCreateModal() {
    setCreateModalOpen(false);
    form.resetFields();
  }

  function closeEditModal() {
    setEditModalOpen(false);
    setEditingDepartment(null);
    editForm.resetFields();
  }

  async function handleCreateDepartment(values) {
    setIsSubmitting(true);
    try {
      await createDepartment({
        name: values.name.trim(),
        code: values.code.trim().toUpperCase(),
        description: values.description?.trim() || '',
        isActive: values.isActive ?? true,
      });
      toast.success('Đã thêm phòng ban mới');
      closeCreateModal();
      await loadDepartments();
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUpdateDepartment(values) {
    if (!editingDepartment) return;
    setIsSubmitting(true);
    try {
      await updateDepartment(editingDepartment.id, {
        name: values.name.trim(),
        code: values.code.trim().toUpperCase(),
        description: values.description?.trim() || '',
        isActive: values.isActive,
      });
      toast.success('Đã cập nhật phòng ban');
      closeEditModal();
      await loadDepartments();
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleDeleteClick(department) {
    Modal.confirm({
      title: 'Xác nhận xóa',
      content: `Bạn có chắc chắn muốn xóa phòng ban "${department.name}"?`,
      okText: 'Xóa',
      okType: 'danger',
      cancelText: 'Hủy',
      onOk: async () => {
        try {
          await deleteDepartment(department.id);
          toast.success('Đã xóa phòng ban');
          await loadDepartments();
        } catch (error) {
          toast.error(getApiErrorMessage(error));
        }
      },
    });
  }

  function handleEditClick(department) {
    setEditingDepartment(department);
    editForm.setFieldsValue({
      name: department.name,
      code: department.code,
      description: department.description,
      isActive: department.isActive,
    });
    setEditModalOpen(true);
  }

  return (
    <div className={styles.page}>
      <main className={styles.pageBody}>
        <div className={styles.canvas}>
          <div className={styles.container}>
            <section className={styles.pageHeader}>
              <div>
                <h1>Quản lý phòng ban</h1>
                <p>Quản lý danh sách các phòng ban và bộ phận trong tổ chức.</p>
              </div>
              <button className={styles.primaryButton} type="button" onClick={() => setCreateModalOpen(true)}>
                <PlusOutlined /> Thêm phòng ban
              </button>
            </section>

            <section className={styles.tablePanel}>
              <div className={styles.tableScroller}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Tên phòng ban</th>
                      <th>Mã phòng</th>
                      <th>Mô tả</th>
                      <th>Trạng thái</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading && (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>
                          Đang tải dữ liệu...
                        </td>
                      </tr>
                    )}
                    {!isLoading && departments.length === 0 && (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>
                          Chưa có phòng ban nào
                        </td>
                      </tr>
                    )}
                    {!isLoading && departments.map((department, index) => (
                      <tr key={department.id || department.code}>
                        <td>{index + 1}</td>
                        <td><strong>{department.name}</strong></td>
                        <td className={styles.codeCell}>{department.code}</td>
                        <td className={styles.descriptionCell}>{department.description || '—'}</td>
                        <td>
                          <span className={department.isActive ? styles.statusBadge : `${styles.statusBadge} ${styles.inactive}`}>
                            <span />{department.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td>
                          <div className={styles.rowActions}>
                            <button title="Sửa" type="button" onClick={() => handleEditClick(department)}>
                              <EditOutlined />
                            </button>
                            <button title="Xóa" type="button" onClick={() => handleDeleteClick(department)}>
                              <DeleteOutlined />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <footer className={styles.pagination}>
                <span>Hiển thị <strong>{departments.length ? 1 : 0}</strong> đến <strong>{departments.length}</strong> trong <strong>{departments.length}</strong> phòng ban</span>
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

      {/* CREATE MODAL */}
      <Modal
        title="Thêm phòng ban"
        open={isCreateModalOpen}
        onCancel={closeCreateModal}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleCreateDepartment} initialValues={{ isActive: true }}>
          <Form.Item name="name" label="Tên phòng ban" rules={[{ required: true, message: 'Vui lòng nhập tên phòng ban.' }]}>
            <Input placeholder="Ví dụ: Phòng Kinh doanh" />
          </Form.Item>
          <Form.Item name="code" label="Mã phòng" rules={[{ required: true, message: 'Vui lòng nhập mã phòng.' }]}>
            <Input placeholder="Ví dụ: DEPT-SALES" />
          </Form.Item>
          <Form.Item name="description" label="Mô tả">
            <Input.TextArea rows={3} placeholder="Nhập mô tả ngắn cho phòng ban" />
          </Form.Item>
          <Form.Item name="isActive" label="Trạng thái" valuePropName="checked">
            <Switch checkedChildren="Hoạt động" unCheckedChildren="Không hoạt động" />
          </Form.Item>
          <div className={styles.modalActions}>
            <Button onClick={closeCreateModal}>Hủy</Button>
            <Button type="primary" htmlType="submit" icon={<PlusOutlined />} loading={isSubmitting}>
              Thêm phòng ban
            </Button>
          </div>
        </Form>
      </Modal>

      {/* EDIT MODAL */}
      <Modal
        title="Cập nhật phòng ban"
        open={isEditModalOpen}
        onCancel={closeEditModal}
        footer={null}
        destroyOnClose
      >
        <Form form={editForm} layout="vertical" onFinish={handleUpdateDepartment}>
          <Form.Item name="name" label="Tên phòng ban" rules={[{ required: true, message: 'Vui lòng nhập tên phòng ban.' }]}>
            <Input placeholder="Ví dụ: Phòng Kinh doanh" />
          </Form.Item>
          <Form.Item name="code" label="Mã phòng" rules={[{ required: true, message: 'Vui lòng nhập mã phòng.' }]}>
            <Input placeholder="Ví dụ: DEPT-SALES" />
          </Form.Item>
          <Form.Item name="description" label="Mô tả">
            <Input.TextArea rows={3} placeholder="Nhập mô tả ngắn cho phòng ban" />
          </Form.Item>
          <Form.Item name="isActive" label="Trạng thái" valuePropName="checked">
            <Switch checkedChildren="Hoạt động" unCheckedChildren="Không hoạt động" />
          </Form.Item>
          <div className={styles.modalActions}>
            <Button onClick={closeEditModal}>Hủy</Button>
            <Button type="primary" htmlType="submit" icon={<EditOutlined />} loading={isSubmitting}>
              Cập nhật
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
