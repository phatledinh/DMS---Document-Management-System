import {
  BarChartOutlined,
  BellOutlined,
  DashboardOutlined,
  DeleteOutlined,
  DownOutlined,
  FileDoneOutlined,
  FileProtectOutlined,
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
} from "@ant-design/icons";
import { Avatar, Button, Dropdown, Flex, Layout, Menu } from "antd";
import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { logout } from "../../api/authApi.js";
import { useAuthStore } from "../../store/authStore.js";
import styles from "./AppLayout.module.css";

const { Header, Sider, Content } = Layout;

function getSelectedMenuKey(pathname) {
  if (pathname.startsWith("/admin/upload-admin")) return "/admin/upload-admin";
  if (pathname.startsWith("/admin/approvals")) return "/admin/approvals";
  if (pathname.startsWith("/admin/documents-admin"))
    return "/admin/documents-admin";
  if (pathname.startsWith("/admin/documents/upload"))
    return "/admin/upload-admin";
  if (pathname.startsWith("/admin/documents")) return "/admin/documents-admin";
  if (pathname.startsWith("/audit-logs/processing-errors"))
    return "/processing-errors";
  if (pathname.startsWith("/documents")) return "/documents";
  if (pathname === "/") return "/";
  return pathname;
}

export default function AppLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);
  const [headerSearch, setHeaderSearch] = useState("");

  const baseMenuItems = [
    { key: "/", icon: <HomeOutlined />, label: "Trang chủ" },
    { key: "/search", icon: <SearchOutlined />, label: "Tìm kiếm tài liệu" },
    { key: "/documents", icon: <FolderOpenOutlined />, label: "Tài liệu" },
    { key: "/profile", icon: <UserOutlined />, label: "Hồ sơ" },
  ];

  const adminMenuItems = [
    {
      key: "/admin/dashboard-admin",
      icon: <DashboardOutlined />,
      label: "Dashboard",
    },
    {
      key: "/admin/documents-admin",
      icon: <FileTextOutlined />,
      label: "Quản lý tài liệu",
    },
    {
      key: "/admin/upload-admin",
      icon: <UploadOutlined />,
      label: "Upload tài liệu",
    },
    {
      key: "/admin/approvals",
      icon: <FileProtectOutlined />,
      label: "Duyệt file",
    },
    {
      key: "/processing-errors",
      icon: <WarningOutlined />,
      label: "Tài liệu lỗi xử lý",
    },
    { key: "/categories", icon: <FolderOpenOutlined />, label: "Danh mục" },
    { key: "/departments", icon: <ShopOutlined />, label: "Phòng ban" },
    { key: "/tags", icon: <TagsOutlined />, label: "Tags" },
    { key: "/users", icon: <TeamOutlined />, label: "Người dùng" },
    {
      key: "/audit-logs",
      icon: <HistoryOutlined />,
      label: "Audit & Access log",
    },
    { key: "/analytics", icon: <BarChartOutlined />, label: "Analytics" },
    { key: "/admin/trash", icon: <DeleteOutlined />, label: "Thùng rác" },
  ];

  const isAdmin = user?.role === "ADMIN";
  const menuItems = isAdmin ? adminMenuItems : baseMenuItems;
  const selectedKey = getSelectedMenuKey(location.pathname);
  const displayName =
    user?.name || user?.fullName || user?.email || "Người dùng";
  const displayEmail = user?.email || "user@company.com";
  const displayDepartment =
    user?.departmentName ||
    user?.department ||
    user?.departmentCode ||
    "Phòng Kỹ thuật";
  const displayRole = user?.role || "USER";
  const userInitial = displayName.trim().charAt(0).toUpperCase() || "U";
  const userMenuLinks = [
    { key: "search", label: "Tìm kiếm", icon: <SearchOutlined />, path: "/" },
    {
      key: "dashboard",
      label: "Dashboard cá nhân",
      icon: <DashboardOutlined />,
      path: "/dashboard",
    },
    {
      key: "my-documents",
      label: "Tài liệu của tôi",
      icon: <FolderOpenOutlined />,
      path: "/documents",
    },
    {
      key: "my-versions",
      label: "Version của tôi",
      icon: <FileDoneOutlined />,
      path: "/versions",
    },
    {
      key: "my-categories",
      label: "Danh mục của tôi",
      icon: <TagsOutlined />,
      path: "/categories-user",
    },
    {
      key: "history",
      label: "Lịch sử thao tác",
      icon: <HistoryOutlined />,
      path: "/history",
    },
    {
      key: "profile",
      label: "Hồ sơ cá nhân",
      icon: <UserOutlined />,
      path: "/profile",
    },
  ];

  async function handleLogout() {
    try {
      await logout();
    } catch {
      toast.warn("Không thể gọi logout server, phiên cục bộ đã được xóa");
    } finally {
      clearSession();
      navigate("/login", { replace: true });
    }
  }

  function handleHeaderSearchSubmit(e) {
    if (e) e.preventDefault();
    const q = headerSearch.trim();
    if (q) {
      navigate(`/search?q=${encodeURIComponent(q)}`);
    } else {
      navigate("/search");
    }
  }

  return (
    <Layout className={`${styles.shell} ${isAdmin ? styles.adminShell : ""}`}>
      {isAdmin && (
        <Sider width={240} className={styles.sidebar}>
          <div
            className={styles.brand}
            onClick={() => navigate("/")}
            style={{ cursor: "pointer" }}
          >
            DMS Quản trị
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
          <Flex
            align="center"
            justify="space-between"
            className={styles.headerInner}
          >
            <Flex align="center" gap={24} className={styles.headerLeft}>
              <div
                className={styles.brandInline}
                onClick={() => navigate("/")}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && navigate("/")}
              >
                <span className={styles.brandMark}>D</span>
                <span className={styles.brandText}>DMS</span>
              </div>
              <form
                className={styles.headerSearchForm}
                onSubmit={handleHeaderSearchSubmit}
              >
                <SearchOutlined className={styles.headerSearchIcon} />
                <input
                  className={styles.headerSearchInput}
                  type="text"
                  aria-label="Tìm kiếm tài liệu"
                  placeholder="Tìm kiếm tài liệu, mã tài liệu, tag..."
                  value={headerSearch}
                  onChange={(e) => setHeaderSearch(e.target.value)}
                />
                {headerSearch && (
                  <button
                    type="button"
                    className={styles.headerSearchClear}
                    onClick={() => setHeaderSearch("")}
                    aria-label="Xóa tìm kiếm"
                  >
                    ×
                  </button>
                )}
              </form>
            </Flex>
            <Flex align="center" gap={10} className={styles.headerActions}>
              <Button
                type="text"
                shape="circle"
                className={styles.notificationButton}
                icon={<BellOutlined />}
                aria-label="Thông báo"
              />
              {isAdmin ? (
                <>
                  <Avatar size={38} className={styles.userAvatar}>
                    {userInitial}
                  </Avatar>
                  <Button
                    icon={<LogoutOutlined />}
                    className={styles.logoutButton}
                    onClick={handleLogout}
                  >
                    Đăng xuất
                  </Button>
                </>
              ) : (
                <Dropdown
                  trigger={["click"]}
                  placement="bottomRight"
                  dropdownRender={() => (
                    <div className={styles.userDropdown}>
                      <div className={styles.userDropdownHeader}>
                        <Avatar size={42} className={styles.userAvatar}>
                          {userInitial}
                        </Avatar>
                        <div>
                          <div className={styles.userDropdownName}>
                            {displayName}
                          </div>
                          <div className={styles.userDropdownEmail}>
                            {displayEmail}
                          </div>
                          <div className={styles.userDropdownMeta}>
                            {displayDepartment} · {displayRole}
                          </div>
                        </div>
                      </div>
                      <div className={styles.userDropdownSectionTitle}>
                        KHU VỰC NGƯỜI DÙNG
                      </div>
                      <div className={styles.userDropdownMenu}>
                        {userMenuLinks.map((item) => (
                          <button
                            key={item.key}
                            type="button"
                            className={styles.userDropdownItem}
                            onClick={() => navigate(item.path)}
                          >
                            {item.icon}
                            <span>{item.label}</span>
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        className={`${styles.userDropdownItem} ${styles.userDropdownLogout}`}
                        onClick={handleLogout}
                      >
                        <LogoutOutlined />
                        <span>Đăng xuất</span>
                      </button>
                    </div>
                  )}
                >
                  <button type="button" className={styles.userPill}>
                    <Avatar size={32} className={styles.userAvatar}>
                      {userInitial}
                    </Avatar>
                    <span className={styles.userPillName}>{displayName}</span>
                    <DownOutlined className={styles.userPillChevron} />
                  </button>
                </Dropdown>
              )}
            </Flex>
          </Flex>
        </Header>
        <Content className={styles.content}>{children || <Outlet />}</Content>
      </Layout>
    </Layout>
  );
}
