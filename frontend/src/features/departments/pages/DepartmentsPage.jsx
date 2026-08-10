import { useEffect, useMemo, useState } from 'react';
import {
  ApartmentOutlined,
  DeleteOutlined,
  EditOutlined,
  MailOutlined,
  PlusOutlined,
  SearchOutlined,
  SlidersOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { Button, Form, Input, Modal, Switch } from 'antd';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment
} from '../../../api/departmentApi.js';
import { getUsers } from '../../../api/userApi.js';
import { getApiErrorMessage } from '../../../utils/response.js';
import styles from './DepartmentsPage.module.css';

function normalizeList(data) {
  return Array.isArray(data) ? data : (data?.content || data?.items || []);
}

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'U';
  return parts.slice(-2).map((part) => part.charAt(0).toUpperCase()).join('');
}

export default function DepartmentsPage() {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();

  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState(null);

  async function loadDepartments() {
    setIsLoading(true);
    try {
      const data = await getDepartments();
      const list = normalizeList(data);
      setDepartments(list);
      setSelectedDepartmentId((currentId) => {
        if (currentId && list.some((department) => department.id === currentId)) return currentId;
        return list[0]?.id || null;
      });
    } catch (error) {
      toast.error(getApiErrorMessage(error) || 'Lỗi khi tải danh sách phòng ban');
      setDepartments([]);
      setSelectedDepartmentId(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadUsers() {
    setIsLoadingUsers(true);
    try {
      const data = await getUsers();
      setUsers(normalizeList(data));
    } catch (error) {
      toast.error(getApiErrorMessage(error) || 'Lỗi khi tải danh sách người dùng');
      setUsers([]);
    } finally {
      setIsLoadingUsers(false);
    }
  }

  useEffect(() => {
    loadDepartments();
    loadUsers();
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

  const usersByDepartmentId = useMemo(() => {
    return users.reduce((map, user) => {
      if (!user.departmentId) return map;
      const key = String(user.departmentId);
      const current = map.get(key) || [];
      current.push(user);
      map.set(key, current);
      return map;
    }, new Map());
  }, [users]);

  const filteredDepartments = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    if (!keyword) return departments;
    return departments.filter((department) => [department.name, department.code, department.description]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(keyword)));
  }, [departments, searchTerm]);

  const selectedDepartment = useMemo(() => {
    return departments.find((department) => department.id === selectedDepartmentId) || filteredDepartments[0] || null;
  }, [departments, filteredDepartments, selectedDepartmentId]);

  const selectedMembers = selectedDepartment ? usersByDepartmentId.get(String(selectedDepartment.id)) || [] : [];
  const isBusy = isLoading || isLoadingUsers;

  return (
    <div className={styles.page}>
      <main className={styles.pageBody}>
        <div className={styles.canvas}>
          <div className={styles.container}>
            <section className={styles.pageHeader}>
              <div>
                <h1>Quản lý phòng ban</h1>
                <p>Quyền truy cập tài liệu được cấp theo phòng ban trên từng danh mục.</p>
              </div>
              <button className={styles.primaryButton} type="button" onClick={() => setCreateModalOpen(true)}>
                <PlusOutlined /> Thêm phòng ban
              </button>
            </section>

            <section className={styles.searchPanel}>
              <SearchOutlined className={styles.searchIcon} />
              <input
                className={styles.searchInput}
                type="search"
                placeholder="Tìm phòng ban..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </section>

            <section className={styles.managementGrid}>
              <div className={styles.departmentList}>
                {isLoading && <div className={styles.emptyState}>Đang tải phòng ban...</div>}
                {!isLoading && filteredDepartments.length === 0 && (
                  <div className={styles.emptyState}>Không tìm thấy phòng ban phù hợp</div>
                )}
                {!isLoading && filteredDepartments.map((department) => {
                  const members = usersByDepartmentId.get(String(department.id)) || [];
                  const isSelected = selectedDepartment?.id === department.id;
                  return (
                    <button
                      key={department.id || department.code}
                      type="button"
                      className={isSelected ? `${styles.departmentCard} ${styles.departmentCardActive}` : styles.departmentCard}
                      onClick={() => setSelectedDepartmentId(department.id)}
                    >
                      <span className={styles.departmentIcon}><ApartmentOutlined /></span>
                      <span className={styles.departmentContent}>
                        <span className={styles.departmentName}>{department.name}</span>
                        <span className={styles.departmentMeta}>{members.length} người dùng · {department.code}</span>
                      </span>
                      <span className={styles.cardActions}>
                        <span
                          role="button"
                          tabIndex={0}
                          title="Sửa"
                          className={styles.iconAction}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleEditClick(department);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.stopPropagation();
                              handleEditClick(department);
                            }
                          }}
                        >
                          <SlidersOutlined />
                        </span>
                        <span
                          role="button"
                          tabIndex={0}
                          title="Xóa"
                          className={styles.iconAction}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDeleteClick(department);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.stopPropagation();
                              handleDeleteClick(department);
                            }
                          }}
                        >
                          <DeleteOutlined />
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <aside className={styles.membersPanel}>
                {selectedDepartment ? (
                  <>
                    <div className={styles.membersHeader}>
                      <span className={styles.membersIcon}><TeamOutlined /></span>
                      <div>
                        <h2>{selectedDepartment.name}</h2>
                        <p>{selectedMembers.length} thành viên hiển thị</p>
                      </div>
                    </div>
                    <div className={styles.memberList}>
                      {isBusy && <div className={styles.emptyState}>Đang tải thành viên...</div>}
                      {!isBusy && selectedMembers.length === 0 && (
                        <div className={styles.emptyState}>Phòng ban này chưa có thành viên</div>
                      )}
                      {!isBusy && selectedMembers.map((member) => (
                        <button
                          key={member.id}
                          type="button"
                          className={styles.memberCard}
                          onClick={() => navigate(`/users?editUserId=${encodeURIComponent(member.id)}`)}
                        >
                          <span className={styles.memberAvatar}>{getInitials(member.name)}</span>
                          <span className={styles.memberInfo}>
                            <strong>{member.name || member.email}</strong>
                            <span>{member.role === 'ADMIN' ? 'Quản trị viên' : 'Nhân viên'}</span>
                          </span>
                          <span className={styles.memberEmail}>
                            <MailOutlined />
                            {member.email}
                          </span>
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className={styles.emptyState}>Chọn một phòng ban để xem thành viên</div>
                )}
              </aside>
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
