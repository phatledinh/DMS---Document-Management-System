import { useEffect } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { refresh } from '../api/authApi.js';
import { getCurrentUser } from '../api/userApi.js';
import AppLayout from '../components/Layout/AppLayout.jsx';
import PageLoading from '../components/PageLoading/PageLoading.jsx';
import ProtectedRoute from '../components/ProtectedRoute/ProtectedRoute.jsx';
import AuditLogsPage from '../features/auditLogs/pages/AuditLogsPage.jsx';
import ProcessingErrorsPage from '../features/auditLogs/pages/ProcessingErrorsPage.jsx';
import { LoginPage } from '../features/auth/index.js';
import CategoriesPage from '../features/categories/pages/CategoriesPage.jsx';
import DepartmentsPage from '../features/departments/pages/DepartmentsPage.jsx';
import DocumentDetailPage from '../features/documents/pages/DocumentDetailPage.jsx';
import DocumentHistoryPage from '../features/documents/pages/DocumentHistoryPage.jsx';
import DocumentTrashPage from '../features/documents/pages/DocumentTrashPage.jsx';
import DocumentsPage from '../features/documents/pages/DocumentsPage.jsx';
import EditDocumentPage from '../features/documents/pages/EditDocumentPage.jsx';
import UploadDocumentPage from '../features/documents/pages/UploadDocumentPage.jsx';
import HomePage from '../features/search/pages/HomePage.jsx';
import SearchPage from '../features/search/pages/SearchPage.jsx';
import TagsPage from '../features/tags/pages/TagsPage.jsx';
import UsersPage from '../features/users/pages/UsersPage.jsx';
import DashboardPage from '../pages/DashboardPage.jsx';
import NotFoundPage from '../pages/NotFoundPage.jsx';
import { useAuthStore } from '../store/authStore.js';

function AdminDocumentRedirect({ suffix }) {
  const { id } = useParams();
  return <Navigate to={`/admin/documents/${id}/${suffix}`} replace />;
}

export default function AppRouter() {
  const hasTriedBootstrap = useAuthStore((state) => state.hasTriedBootstrap);
  const setHasTriedBootstrap = useAuthStore((state) => state.setHasTriedBootstrap);
  const setSession = useAuthStore((state) => state.setSession);
  const clearSession = useAuthStore((state) => state.clearSession);

  useEffect(() => {
    let isMounted = true;

    async function bootstrapSession() {
      try {
        const authData = await refresh();
        useAuthStore.getState().setAccessToken(authData.accessToken);
        const user = authData.user || (await getCurrentUser());
        if (isMounted) {
          setSession({ accessToken: authData.accessToken, user });
        }
      } catch {
        if (isMounted) {
          clearSession();
        }
      } finally {
        if (isMounted) {
          setHasTriedBootstrap(true);
        }
      }
    }

    if (!hasTriedBootstrap) {
      bootstrapSession();
    }

    return () => {
      isMounted = false;
    };
  }, [clearSession, hasTriedBootstrap, setHasTriedBootstrap, setSession]);

  if (!hasTriedBootstrap) {
    return <PageLoading label="Đang khôi phục phiên đăng nhập..." />;
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<HomePage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="documents" element={<DocumentsPage />} />
          <Route path="documents/:id" element={<DocumentDetailPage />} />
        </Route>
      </Route>
      <Route element={<ProtectedRoute roles={['ADMIN']} />}>
        <Route path="/admin/dashboard" element={<DashboardPage />} />
        <Route path="/admin/documents" element={<DocumentsPage />} />
        <Route path="/admin/documents/upload" element={<UploadDocumentPage />} />
        <Route path="/admin/documents/:id/edit" element={<EditDocumentPage />} />
        <Route path="/admin/documents/:id/history" element={<DocumentHistoryPage />} />
        <Route path="/admin/trash" element={<DocumentTrashPage />} />
        <Route path="/audit-logs" element={<AuditLogsPage />} />
        <Route path="/audit-logs/processing-errors" element={<ProcessingErrorsPage />} />
        <Route path="/processing-errors" element={<ProcessingErrorsPage />} />
        <Route path="/categories" element={<CategoriesPage />} />
        <Route path="/departments" element={<DepartmentsPage />} />
        <Route path="/tags" element={<TagsPage />} />
        <Route path="/users" element={<UsersPage />} />
      </Route>
      <Route path="/documents/upload" element={<Navigate to="/admin/documents/upload" replace />} />
      <Route path="/documents/:id/edit" element={<AdminDocumentRedirect suffix="edit" />} />
      <Route path="/documents/:id/history" element={<AdminDocumentRedirect suffix="history" />} />
      <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

