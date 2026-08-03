import { useState } from 'react';
import {
  DeleteOutlined,
  PlusOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { Button, Form, Input, Modal } from 'antd';
import { toast } from 'react-toastify';
import styles from './DepartmentsPage.module.css';


const initialDepartments = [
  { id: 1, name: 'Phòng Kỹ thuật', code: 'DEPT-TECH', description: 'Quản lý hạ tầng và phát triển phần mềm' },
  { id: 2, name: 'Phòng Nhân sự', code: 'DEPT-HR', description: 'Quản lý nhân sự và tuyển dụng, đào tạo' },
  { id: 3, name: 'Phòng Kế toán', code: 'DEPT-ACC', description: 'Quản lý tài chính, kế toán và thuế' },
  { id: 4, name: 'Ban Giám đốc', code: 'DEPT-BOD', description: 'Ban lãnh đạo công ty' },
];

export default function DepartmentsPage() {
  const [form] = Form.useForm();
  const [departments, setDepartments] = useState(initialDepartments);
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);

  function closeCreateModal() {
    setCreateModalOpen(false);
    form.resetFields();
  }

  function handleCreateDepartment(values) {
    const nextId = Math.max(...departments.map((department) => department.id), 0) + 1;
    setDepartments((current) => [
      ...current,
      {
        id: nextId,
        name: values.name.trim(),
        code: values.code.trim().toUpperCase(),
        description: values.description?.trim() || '—',
      },
    ]);
    toast.success('Đã thêm phòng ban mới');
    closeCreateModal();
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
              <button className={styles.primaryButton} type="button" onClick={() => setCreateModalOpen(true)}><PlusOutlined />Thêm phòng ban</button>
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
                    {departments.map((department) => (
                      <tr key={department.code}>
                        <td>{department.id}</td>
                        <td><strong>{department.name}</strong></td>
                        <td className={styles.codeCell}>{department.code}</td>
                        <td className={styles.descriptionCell}>{department.description}</td>
                        <td><span className={styles.statusBadge}><span />Active</span></td>
                        <td>
                          <div className={styles.rowActions}>
                            <button title="Edit" type="button"><SettingOutlined /></button>
                            <button title="Delete" type="button"><DeleteOutlined /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <footer className={styles.pagination}>
                <span>Showing 1 to 4 of 4 entries</span>
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

      <Modal
        title="Thêm phòng ban"
        open={isCreateModalOpen}
        onCancel={closeCreateModal}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleCreateDepartment}>
          <Form.Item name="name" label="Tên phòng ban" rules={[{ required: true, message: 'Vui lòng nhập tên phòng ban.' }]}>
            <Input placeholder="Ví dụ: Phòng Kinh doanh" />
          </Form.Item>
          <Form.Item name="code" label="Mã phòng" rules={[{ required: true, message: 'Vui lòng nhập mã phòng.' }]}>
            <Input placeholder="Ví dụ: DEPT-SALES" />
          </Form.Item>
          <Form.Item name="description" label="Mô tả">
            <Input.TextArea rows={3} placeholder="Nhập mô tả ngắn cho phòng ban" />
          </Form.Item>
          <div className={styles.modalActions}>
            <Button onClick={closeCreateModal}>Hủy</Button>
            <Button type="primary" htmlType="submit" icon={<PlusOutlined />}>
              Thêm phòng ban
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
