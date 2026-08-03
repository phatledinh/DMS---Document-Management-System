import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Result } from 'antd';
import { useAuthStore } from '../../store/authStore.js';

function getUserRole(user) {
  return user?.role || user?.roles?.[0] || user?.authorities?.[0];
}

export default function ProtectedRoute({ roles }) {
  const location = useLocation();
  const accessToken = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);

  if (!accessToken || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (roles?.length && !roles.includes(getUserRole(user))) {
    return <Result status="403" title="403" subTitle="Bạn không có quyền truy cập màn hình này." />;
  }

  return <Outlet />;
}
