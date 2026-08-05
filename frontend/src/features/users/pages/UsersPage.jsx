import { useEffect, useMemo, useState } from "react";
import {
  CheckCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  LockOutlined,
  PlusOutlined,
  SearchOutlined,
  UnlockOutlined,
} from "@ant-design/icons";
import { Button, Form, Input, Modal, Select } from "antd";
import { toast } from "react-toastify";
import { getDepartments } from "../../../api/departmentApi.js";
import { createUser, deleteUser, getUsers, updateUser } from "../../../api/userApi.js";
import { getApiErrorMessage } from "../../../utils/response.js";
import styles from "./UsersPage.module.css";

const roleOptions = [
  { label: "Admin", value: "ADMIN" },
  { label: "User", value: "USER" },
];

const statusOptions = [
  { label: "Hoạt động", value: "ACTIVE" },
  { label: "Không hoạt động", value: "INACTIVE" },
  { label: "Bị khóa", value: "BANNED" },
];

function getInitials(name = "") {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  return words.slice(-2).map((word) => word[0]).join("").toUpperCase();
}

function normalizeList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.content)) return data.content;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

function formatDateTime(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function UsersPage() {
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [isLoadingUsers, setLoadingUsers] = useState(false);
  const [isSubmitting, setSubmitting] = useState(false);
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  const departmentById = useMemo(
    () => new Map(departments.map((department) => [department.id, department])),
    [departments],
  );

  const departmentOptions = useMemo(
    () => departments.map((department) => ({
      label: department.name,
      value: department.id,
    })),
    [departments],
  );

  async function loadUsers() {
    setLoadingUsers(true);
    try {
      const data = await getUsers();
      setUsers(normalizeList(data));
    } catch (error) {
      if (![404, 405].includes(error.response?.status)) {
        toast.error(getApiErrorMessage(error));
      }
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    async function loadDepartments() {
      try {
        const data = await getDepartments();
        setDepartments(normalizeList(data));
      } catch (error) {
        toast.error(getApiErrorMessage(error));
      }
    }

    loadDepartments();
  }, []);

  function closeCreateModal() {
    setCreateModalOpen(false);
    form.resetFields();
  }

  function closeEditModal() {
    setEditModalOpen(false);
    setEditingUser(null);
    editForm.resetFields();
  }

  async function handleCreateUser(values) {
    setSubmitting(true);
    try {
      await createUser({
        name: values.name.trim(),
        email: values.email.trim(),
        password: values.password,
        phone: values.phone?.trim() || null,
        avatar: values.avatar?.trim() || null,
        role: values.role,
        departmentId: values.departmentId || null,
        status: values.status,
      });
      toast.success("Đã thêm người dùng mới");
      closeCreateModal();
      await loadUsers();
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdateUser(values) {
    if (!editingUser) return;
    setSubmitting(true);
    try {
      await updateUser(editingUser.id, {
        name: values.name.trim(),
        password: values.password || null,
        phone: values.phone?.trim() || null,
        departmentId: values.departmentId || null,
        role: values.role,
        status: values.status,
      });
      toast.success("Đã cập nhật người dùng");
      closeEditModal();
      await loadUsers();
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  function openEditModal(user) {
    setEditingUser(user);
    editForm.setFieldsValue({
      name: user.name,
      phone: user.phone,
      departmentId: user.departmentId,
      role: user.role || "USER",
      status: user.status || "ACTIVE",
    });
    setEditModalOpen(true);
  }

  function handleToggleLock(user) {
    const nextStatus = user.status === "BANNED" ? "ACTIVE" : "BANNED";
    Modal.confirm({
      title: user.status === "BANNED" ? "Mở khóa người dùng" : "Khóa người dùng",
      content: `Bạn có chắc chắn muốn ${user.status === "BANNED" ? "mở khóa" : "khóa"} người dùng "${user.name}"?`,
      okText: user.status === "BANNED" ? "Mở khóa" : "Khóa",
      cancelText: "Hủy",
      onOk: async () => {
        try {
          await updateUser(user.id, { status: nextStatus });
          toast.success(user.status === "BANNED" ? "Đã mở khóa người dùng" : "Đã khóa người dùng");
          await loadUsers();
        } catch (error) {
          toast.error(getApiErrorMessage(error));
        }
      },
    });
  }

  function handleDeleteUser(user) {
    Modal.confirm({
      title: "Xác nhận xóa",
      content: `Bạn có chắc chắn muốn xóa người dùng "${user.name}"?`,
      okText: "Xóa",
      okType: "danger",
      cancelText: "Hủy",
      onOk: async () => {
        try {
          await deleteUser(user.id);
          toast.success("Đã xóa người dùng");
          await loadUsers();
        } catch (error) {
          toast.error(getApiErrorMessage(error));
        }
      },
    });
  }

  function getDepartmentName(departmentId) {
    return departmentById.get(departmentId)?.name || "—";
  }

  return (
    <div className={styles.page}>
      <main className={styles.pageBody}>
        <div className={styles.canvas}>
          <div className={styles.container}>
            <section className={styles.pageHeader}>
              <div>
                <h2>QUẢN LÝ USERS</h2>
                <p>
                  Quản lý danh sách người dùng và phân quyền truy cập trong hệ
                  thống.
                </p>
              </div>
              <button
                className={styles.primaryButton}
                type="button"
                onClick={() => setCreateModalOpen(true)}
              >
                <PlusOutlined />
                Thêm người dùng
              </button>
            </section>

            <section className={styles.filterPanel}>
              <label className={styles.filterSearch}>
                <SearchOutlined />
                <input
                  placeholder="Tìm kiếm theo tên, email, sđt..."
                  type="text"
                />
              </label>
              <div className={styles.filtersGrid}>
                <select defaultValue="">
                  <option value="">Tất cả Vai trò</option>
                  {roleOptions.map((role) => (
                    <option key={role.value} value={role.value}>{role.label}</option>
                  ))}
                </select>
                <select defaultValue="">
                  <option value="">Tất cả Phòng ban</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>{department.name}</option>
                  ))}
                </select>
                <select defaultValue="">
                  <option value="">Tất cả Trạng thái</option>
                  {statusOptions.map((status) => (
                    <option key={status.value} value={status.value}>{status.label}</option>
                  ))}
                </select>
              </div>
            </section>

            <section className={styles.tablePanel}>
              <div className={styles.tableScroller}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Họ tên</th>
                      <th>Email</th>
                      <th>Số điện thoại</th>
                      <th>Phòng ban</th>
                      <th>Vai trò</th>
                      <th>Trạng thái</th>
                      <th>Đăng nhập cuối</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!isLoadingUsers && users.length === 0 && (
                      <tr>
                        <td colSpan={9} className={styles.emptyCell}>
                          Chưa có người dùng để hiển thị
                        </td>
                      </tr>
                    )}
                    {isLoadingUsers && (
                      <tr>
                        <td colSpan={9} className={styles.emptyCell}>
                          Đang tải danh sách người dùng...
                        </td>
                      </tr>
                    )}
                    {!isLoadingUsers && users.map((user, index) => {
                      const isActive = user.status === "ACTIVE";
                      const isLocked = user.status === "BANNED";

                      return (
                        <tr key={user.id || user.email}>
                          <td>{index + 1}</td>
                          <td>
                            <div className={styles.userCell}>
                              <span className={styles.userAvatar}>
                                {getInitials(user.name)}
                              </span>
                              <strong>{user.name || "—"}</strong>
                            </div>
                          </td>
                          <td>{user.email || "—"}</td>
                          <td className={styles.monoCell}>{user.phone || "—"}</td>
                          <td>{getDepartmentName(user.departmentId)}</td>
                          <td>
                            <span
                              className={
                                user.role === "ADMIN"
                                  ? styles.adminRole
                                  : styles.userRole
                              }
                            >
                              {user.role || "USER"}
                            </span>
                          </td>
                          <td>
                            <span
                              className={
                                isActive
                                  ? styles.activeStatus
                                  : styles.inactiveStatus
                              }
                            >
                              {isActive ? <CheckCircleOutlined /> : "×"}
                              {statusOptions.find((status) => status.value === user.status)?.label || user.status || "—"}
                            </span>
                          </td>
                          <td>{formatDateTime(user.lastLogin)}</td>
                          <td>
                            <div className={styles.rowActions}>
                              <button title="Sửa" type="button" onClick={() => openEditModal(user)}>
                                <EditOutlined />
                              </button>
                              <button title={isLocked ? "Mở khóa" : "Khóa"} type="button" onClick={() => handleToggleLock(user)}>
                                {isLocked ? <UnlockOutlined /> : <LockOutlined />}
                              </button>
                              <button title="Xóa" type="button" onClick={() => handleDeleteUser(user)}>
                                <DeleteOutlined />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <footer className={styles.pagination}>
                <span>
                  Hiển thị <strong>{users.length ? 1 : 0}</strong> đến{" "}
                  <strong>{users.length}</strong> trong <strong>{users.length}</strong>{" "}
                  người dùng
                </span>
                <div>
                  <button type="button" disabled>‹</button>
                  <button className={styles.currentPage} type="button">
                    1
                  </button>
                  <button type="button" disabled>›</button>
                </div>
              </footer>
            </section>
          </div>
        </div>
      </main>

      <Modal
        title="Thêm người dùng"
        open={isCreateModalOpen}
        onCancel={closeCreateModal}
        footer={null}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ role: "USER", status: "ACTIVE" }}
          onFinish={handleCreateUser}
        >
          <Form.Item name="name" label="Họ tên" rules={[{ required: true, message: "Vui lòng nhập họ tên." }]}>
            <Input placeholder="Ví dụ: Nguyễn Văn A" />
          </Form.Item>
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: "Vui lòng nhập email." },
              { type: "email", message: "Email không hợp lệ." },
            ]}
          >
            <Input placeholder="user@company.com" />
          </Form.Item>
          <Form.Item name="password" label="Mật khẩu" rules={[{ required: true, message: "Vui lòng nhập mật khẩu." }]}>
            <Input.Password placeholder="Nhập mật khẩu" />
          </Form.Item>
          <Form.Item name="phone" label="Số điện thoại">
            <Input placeholder="Ví dụ: 0901234567" />
          </Form.Item>
          <Form.Item name="avatar" label="Avatar URL">
            <Input placeholder="https://example.com/avatar.png" />
          </Form.Item>
          <Form.Item name="departmentId" label="Phòng ban">
            <Select allowClear placeholder="Chọn phòng ban" options={departmentOptions} />
          </Form.Item>
          <Form.Item name="role" label="Vai trò" rules={[{ required: true, message: "Vui lòng chọn vai trò." }]}>
            <Select options={roleOptions} />
          </Form.Item>
          <Form.Item name="status" label="Trạng thái" rules={[{ required: true, message: "Vui lòng chọn trạng thái." }]}>
            <Select options={statusOptions} />
          </Form.Item>
          <div className={styles.modalActions}>
            <Button onClick={closeCreateModal}>Hủy</Button>
            <Button type="primary" htmlType="submit" icon={<PlusOutlined />} loading={isSubmitting}>
              Thêm người dùng
            </Button>
          </div>
        </Form>
      </Modal>

      <Modal title="Cập nhật người dùng" open={isEditModalOpen} onCancel={closeEditModal} footer={null} destroyOnClose>
        <Form form={editForm} layout="vertical" onFinish={handleUpdateUser}>
          <Form.Item name="name" label="Họ tên" rules={[{ required: true, message: "Vui lòng nhập họ tên." }]}>
            <Input placeholder="Ví dụ: Nguyễn Văn A" />
          </Form.Item>
          <Form.Item name="password" label="Mật khẩu mới">
            <Input.Password placeholder="Bỏ trống nếu không đổi mật khẩu" />
          </Form.Item>
          <Form.Item name="phone" label="Số điện thoại">
            <Input placeholder="Ví dụ: 0901234567" />
          </Form.Item>
          <Form.Item name="departmentId" label="Phòng ban">
            <Select allowClear placeholder="Chọn phòng ban" options={departmentOptions} />
          </Form.Item>
          <Form.Item name="role" label="Vai trò" rules={[{ required: true, message: "Vui lòng chọn vai trò." }]}>
            <Select options={roleOptions} />
          </Form.Item>
          <Form.Item name="status" label="Trạng thái" rules={[{ required: true, message: "Vui lòng chọn trạng thái." }]}>
            <Select options={statusOptions} />
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
