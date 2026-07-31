import {
  DashboardOutlined,
  FolderOpenOutlined,
  HomeOutlined,
  LogoutOutlined,
  SearchOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Button, Flex, Layout, Menu, Typography } from 'antd';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { logout } from '../../api/authApi.js';
import { useAuthStore } from '../../store/authStore.js';
import styles from './AppLayout.module.css';

const { Header, Sider, Content } = Layout;

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);

  if (location.pathname === '/admin/dashboard') {
    return <Outlet />;
  }

  const menuItems = [
    { key: '/', icon: <HomeOutlined />, label: 'Trang chủ' },
    { key: '/search', icon: <SearchOutlined />, label: 'Tìm kiếm tài liệu' },
    { key: '/documents', icon: <FolderOpenOutlined />, label: 'Tài liệu' },
    ...(user?.role === 'ADMIN'
      ? [{ key: '/admin/dashboard', icon: <DashboardOutlined />, label: 'Dashboard' }]
      : []),
  ];

  async function handleLogout() {
    try {
      await logout();
    } catch {
      toast.warn('Không thể gọi logout server, phiên cục bộ đã được xóa');
    } finally {
      clearSession();
      navigate('/login', { replace: true });
    }
  }

  return (
    <Layout className={styles.shell}>
      <Sider width={240} className={styles.sidebar}>
        <div className={styles.brand} onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          Deep Trust DMS
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header className={styles.header}>
          <Flex align="center" justify="space-between">
            <Typography.Title level={4} className={styles.title}>
              Hệ thống Quản lý Tài liệu
            </Typography.Title>
            <Flex align="center" gap={12}>
              <UserOutlined />
              <Typography.Text>{user?.name || user?.email}</Typography.Text>
              <Button icon={<LogoutOutlined />} onClick={handleLogout}>
                Đăng xuất
              </Button>
            </Flex>
          </Flex>
        </Header>
        <Content className={styles.content}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
