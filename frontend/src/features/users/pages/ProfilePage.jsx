import { KeyOutlined, LockOutlined, MailOutlined, PhoneOutlined, UserOutlined } from '@ant-design/icons';
import { useEffect, useMemo, useState } from 'react';
import { Avatar, Breadcrumb, Button, Card, Col, Form, Input, Row, Tag, Typography } from 'antd';
import { toast } from 'react-toastify';
import { getDepartments } from '../../../api/departmentApi.js';
import { getCurrentUser, updateUser } from '../../../api/userApi.js';
import { useAuthStore } from '../../../store/authStore.js';
import { getApiErrorMessage } from '../../../utils/response.js';
import styles from './ProfilePage.module.css';

function normalizeList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.content)) return data.content;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

export default function ProfilePage() {
  const currentUser = useAuthStore((state) => state.user);
  const setCurrentUser = useAuthStore((state) => state.setUser);
  const [passwordForm] = Form.useForm();
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [departments, setDepartments] = useState([]);
  const departmentById = useMemo(
    () => new Map(departments.map((department) => [department.id, department])),
    [departments],
  );
  const departmentIds = useMemo(() => {
    if (Array.isArray(currentUser?.departmentIds) && currentUser.departmentIds.length > 0) {
      return currentUser.departmentIds;
    }
    if (Array.isArray(currentUser?.departments) && currentUser.departments.length > 0) {
      return currentUser.departments.map((d) => d.id).filter(Boolean);
    }
    return currentUser?.departmentId ? [currentUser.departmentId] : [];
  }, [currentUser]);

  const departmentText = departmentIds.length > 0
    ? departmentIds.map((departmentId) => departmentById.get(departmentId)?.name || departmentId).join(', ')
    : '—';
  const displayName = currentUser?.name || currentUser?.email || '—';

  useEffect(() => {
    async function loadProfileData() {
      try {
        const [user, departmentData] = await Promise.all([
          getCurrentUser(),
          getDepartments(),
        ]);
        setCurrentUser(user);
        setDepartments(normalizeList(departmentData));
      } catch (error) {
        toast.error(getApiErrorMessage(error));
      }
    }

    loadProfileData();
  }, [setCurrentUser]);

  async function handlePasswordChange(values) {
    if (!currentUser?.id) {
      toast.error('Không thể xác định người dùng hiện tại');
      return;
    }

    setIsChangingPassword(true);
    try {
      await updateUser(currentUser.id, { password: values.newPassword });
      passwordForm.resetFields();
      toast.success('Đã đổi mật khẩu thành công');
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setIsChangingPassword(false);
    }
  }
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <Breadcrumb
          className={styles.breadcrumb}
          items={[{ title: 'Home' }, { title: 'Profile cá nhân' }]}
        />

        <Card className={styles.profileCard} styles={{ body: { padding: 0 } }}>
          <section className={styles.profileHeader}>
            <Avatar size={96} className={styles.avatar} icon={!initials && <UserOutlined />}>
              {initials}
            </Avatar>
            <div className={styles.identity}>
              <Typography.Title level={2} className={styles.name}>
                {displayName}
              </Typography.Title>
              <Typography.Text className={styles.email}>{currentUser?.email || '—'}</Typography.Text>
              <div>
                <Tag color="blue" className={styles.profileTag}>
                  {departmentText} · {currentUser?.role || 'USER'}
                </Tag>
              </div>
            </div>
          </section>

          <div className={styles.form}>
            <Form layout="vertical">
              <section className={styles.section}>
                <Typography.Title level={4} className={styles.sectionTitle}>
                  Thông tin cá nhân
                </Typography.Title>
                <Row gutter={[16, 16]}>
                  <Col xs={24} md={12}>
                    <Form.Item label="Họ tên">
                      <Input prefix={<UserOutlined />} value={currentUser?.name || ''} readOnly />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item label="Email">
                      <Input prefix={<MailOutlined />} suffix={<LockOutlined />} value={currentUser?.email || ''} readOnly />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item label="Số điện thoại">
                      <Input prefix={<PhoneOutlined />} value={currentUser?.phone || ''} readOnly />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item label="Phòng ban">
                      <Input suffix={<LockOutlined />} value={departmentText} readOnly />
                    </Form.Item>
                  </Col>
                </Row>
              </section>
            </Form>

            <section className={styles.section}>
              <Typography.Title level={4} className={styles.sectionTitle}>
                Đổi mật khẩu
              </Typography.Title>
              <Typography.Paragraph className={styles.helperText}>
                Mật khẩu mới sẽ được áp dụng cho lần đăng nhập tiếp theo.
              </Typography.Paragraph>
              <Form form={passwordForm} layout="vertical" onFinish={handlePasswordChange} className={styles.passwordForm}>
                <Row gutter={[16, 16]}>
                  <Col xs={24} md={12}>
                    <Form.Item
                      label="Mật khẩu mới"
                      name="newPassword"
                      rules={[
                        { required: true, message: 'Vui lòng nhập mật khẩu mới.' },
                        { min: 8, message: 'Mật khẩu mới phải có ít nhất 8 ký tự.' },
                      ]}
                    >
                      <Input.Password prefix={<KeyOutlined />} placeholder="Nhập mật khẩu mới" autoComplete="new-password" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item
                      label="Xác nhận mật khẩu mới"
                      name="confirmPassword"
                      dependencies={['newPassword']}
                      rules={[
                        { required: true, message: 'Vui lòng xác nhận mật khẩu mới.' },
                        ({ getFieldValue }) => ({
                          validator(_, value) {
                            if (!value || getFieldValue('newPassword') === value) {
                              return Promise.resolve();
                            }
                            return Promise.reject(new Error('Mật khẩu xác nhận không khớp.'));
                          },
                        }),
                      ]}
                    >
                      <Input.Password prefix={<LockOutlined />} placeholder="Nhập lại mật khẩu mới" autoComplete="new-password" />
                    </Form.Item>
                  </Col>
                </Row>
                <div className={styles.passwordActions}>
                  <Button type="primary" htmlType="submit" loading={isChangingPassword} icon={<KeyOutlined />}>
                    Đổi mật khẩu
                  </Button>
                </div>
              </Form>
            </section>
          </div>
        </Card>
      </div>
    </main>
  );
}
