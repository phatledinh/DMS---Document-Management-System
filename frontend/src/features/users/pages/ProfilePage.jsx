import { BankOutlined, LockOutlined, MailOutlined, PhoneOutlined, SaveOutlined, UserOutlined } from '@ant-design/icons';
import { Avatar, Breadcrumb, Button, Card, Col, Form, Input, Row, Space, Tag, Typography } from 'antd';
import { useAuthStore } from '../../../store/authStore.js';
import styles from './ProfilePage.module.css';

const fallbackProfile = {
  name: 'Nguyễn Văn A',
  email: 'user@company.com',
  phone: '0901234567',
  department: 'Phòng Kỹ thuật',
  role: 'USER',
  address: '',
  nationality: 'Việt Nam',
  ethnicity: 'Kinh',
  religion: 'Không',
  bank: '',
  accountNumber: '',
};

export default function ProfilePage() {
  const currentUser = useAuthStore((state) => state.user);
  const profile = { ...fallbackProfile, ...currentUser };
  const displayName = profile.name || profile.email || fallbackProfile.name;
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
              <Typography.Text className={styles.email}>{profile.email}</Typography.Text>
              <div>
                <Tag color="blue" className={styles.profileTag}>
                  {profile.department} · {profile.role}
                </Tag>
              </div>
            </div>
          </section>

          <Form layout="vertical" initialValues={profile} className={styles.form}>
            <section className={styles.section}>
              <Typography.Title level={4} className={styles.sectionTitle}>
                Thông tin cá nhân
              </Typography.Title>
              <Row gutter={[16, 16]}>
                <Col xs={24} md={12}>
                  <Form.Item label="Họ tên" name="name">
                    <Input prefix={<UserOutlined />} placeholder="Nhập họ tên" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="Email" name="email">
                    <Input prefix={<MailOutlined />} suffix={<LockOutlined />} readOnly />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="Số điện thoại" name="phone">
                    <Input prefix={<PhoneOutlined />} placeholder="Nhập số điện thoại" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="Phòng ban" name="department">
                    <Input suffix={<LockOutlined />} readOnly />
                  </Form.Item>
                </Col>
              </Row>
            </section>

            <section className={styles.section}>
              <Typography.Title level={4} className={styles.sectionTitle}>
                Thông tin bổ sung
              </Typography.Title>
              <Row gutter={[16, 16]}>
                <Col xs={24}>
                  <Form.Item label="Địa chỉ" name="address">
                    <Input placeholder="Nhập địa chỉ của bạn" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item label="Quốc tịch" name="nationality">
                    <Input />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item label="Dân tộc" name="ethnicity">
                    <Input />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item label="Tôn giáo" name="religion">
                    <Input />
                  </Form.Item>
                </Col>
              </Row>
            </section>

            <section className={styles.section}>
              <Typography.Title level={4} className={styles.sectionTitle}>
                Thông tin thanh toán
              </Typography.Title>
              <Row gutter={[16, 16]}>
                <Col xs={24} md={12}>
                  <Form.Item label="Ngân hàng" name="bank">
                    <Input prefix={<BankOutlined />} placeholder="Tên ngân hàng" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="Số tài khoản" name="accountNumber">
                    <Input placeholder="Số tài khoản ngân hàng" />
                  </Form.Item>
                </Col>
              </Row>
            </section>

            <div className={styles.actions}>
              <Space>
                <Button>Cancel</Button>
                <Button type="primary" icon={<SaveOutlined />}>
                  Lưu thay đổi
                </Button>
              </Space>
            </div>
          </Form>
        </Card>
      </div>
    </main>
  );
}