import {
  BarChartOutlined,
  DashboardOutlined,
  DeleteOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  HistoryOutlined,
  HomeOutlined,
  LogoutOutlined,
  SearchOutlined,
  ShopOutlined,
  TagsOutlined,
  TeamOutlined,
  UploadOutlined,
  UserOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { Button, Flex, Layout, Menu, Typography } from 'antd';
import { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { logout } from '../../api/authApi.js';
import { useAuthStore } from '../../store/authStore.js';
import styles from './AppLayout.module.css';

const { Header, Sider, Content } = Layout;

function getSelectedMenuKey(pathname) {
  if (pathname.startsWith('/admin/documents/upload')) return '/admin/documents/upload';
  if (pathname.startsWith('/admin/documents')) return '/admin/documents';
  if (pathname.startsWith('/audit-logs/processing-errors')) return '/processing-errors';
  if (pathname.startsWith('/documents')) return '/documents';
  if (pathname === '/') return '/';
  return pathname;
}

export default function AppLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);
  const [headerSearch, setHeaderSearch] = useState('');

  const baseMenuItems = [
    { key: '/', icon: <HomeOutlined />, label: 'Trang chủ' },
    { key: '/search', icon: <SearchOutlined />, label: 'Tìm kiếm tài liệu' },
    { key: '/documents', icon: <FolderOpenOutlined />, label: 'Tài liệu' },
    { key: '/profile', icon: <UserOutlined />, label: 'Hồ sơ' },
  ];

  const adminMenuItems = [
    { key: '/admin/dashboard', icon: <DashboardOutlined />, label: 'Dashboard' },
    { key: '/admin/documents', icon: <FileTextOutlined />, label: 'Quản lý tài liệu' },
    { key: '/admin/documents/upload', icon: <UploadOutlined />, label: 'Upload tài liệu' },
    { key: '/admin/trash', icon: <DeleteOutlined />, label: 'Thùng rác' },
    { key: '/analytics', icon: <BarChartOutlined />, label: 'Analytics' },
    { key: '/categories', icon: <FolderOpenOutlined />, label: 'Danh mục' },
    { key: '/departments', icon: <ShopOutlined />, label: 'Phòng ban' },
    { key: '/tags', icon: <TagsOutlined />, label: 'Tags' },
    { key: '/users', icon: <TeamOutlined />, label: 'Users' },
    { key: '/audit-logs', icon: <HistoryOutlined />, label: 'Audit Logs' },
    { key: '/processing-errors', icon: <WarningOutlined />, label: 'Lỗi xử lý' },
  ];

  const menuItems = user?.role === 'ADMIN' ? [...baseMenuItems, ...adminMenuItems] : baseMenuItems;
  const selectedKey = getSelectedMenuKey(location.pathname);

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

  function handleHeaderSearchSubmit(e) {
    if (e) e.preventDefault();
    const q = headerSearch.trim();
    if (q) {
      navigate(`/search?q=${encodeURIComponent(q)}`);
    } else {
      navigate('/search');
    }
  }

  return (
    <Layout className={styles.shell}>
      {user?.role === 'ADMIN' && (
        <Sider width={240} className={styles.sidebar}>
          <div className={styles.brand} onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
            Deep Trust DMS
          </div>
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[selectedKey]}
            items={menuItems}
            onClick={({ key }) => navigate(key)}
          />
        </Sider>
      )}
      <Layout>
        <Header className={styles.header}>
          <Flex align="center" justify="space-between" style={{ width: '100%' }}>
            <Flex align="center" gap={24}>
              <div className={styles.brandInline} onClick={() => navigate('/')} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && navigate('/')}>
                <span className="material-symbols-outlined" style={{ fontVariationSettings: '"FILL" 1', color: '#005bbf', fontSize: 22 }}>security</span>
                <span className={styles.brandText}>Deep Trust</span>
              </div>
              {/* Integrated Search Bar (like mockup) */}
              <form className={styles.headerSearchForm} onSubmit={handleHeaderSearchSubmit}>
                <span className="material-symbols-outlined" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#5f6368', fontSize: 20, pointerEvents: 'none' }}>search</span>
                <input
                  className={styles.headerSearchInput}
                  type="text"
                  placeholder="Tìm kiếm tài liệu, mã, tags..."
                  value={headerSearch}
                  onChange={(e) => setHeaderSearch(e.target.value)}
                />
                {headerSearch && (
                  <button type="button" className={styles.headerSearchClear} onClick={() => setHeaderSearch('')}>
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>clear</span>
                  </button>
                )}
              </form>
            </Flex>
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
          {children || <Outlet />}
        </Content>
      </Layout>
    </Layout>
  );
}
