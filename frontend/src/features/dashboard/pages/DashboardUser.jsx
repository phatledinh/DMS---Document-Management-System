import {
  DownloadOutlined,
  EyeOutlined,
  FileDoneOutlined,
  FileTextOutlined,
  HistoryOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  UploadOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { Alert, Empty, Skeleton } from 'antd';
import { useAuthStore } from '../../../store/authStore.js';
import { getApiErrorMessage } from '../../../utils/response.js';
import { useUserDashboard } from '../hooks/useUserDashboard.js';
import styles from './DashboardUser.module.css';

const metricIcons = {
  uploads: <UploadOutlined />,
  previews: <EyeOutlined />,
  downloads: <DownloadOutlined />,
  denied: <WarningOutlined />,
};

const metricTones = {
  uploads: 'primary',
  previews: 'cyan',
  downloads: 'green',
  denied: 'orange',
};

const activityTones = {
  denied: 'danger',
  allowed: 'success',
};

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function MetricCard({ label, value, detail, icon, tone }) {
  return (
    <article className={styles.metricCard}>
      <div>
        <p>{label}</p>
        <h2>{value}</h2>
        <span>{detail}</span>
      </div>
      <span className={`${styles.metricIcon} ${styles[tone]}`}>{icon}</span>
    </article>
  );
}

function SectionCard({ title, action, children, className = '' }) {
  return (
    <section className={`${styles.sectionCard} ${className}`}>
      <div className={styles.sectionHeader}>
        <h3>{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function StatusPill({ status, tone }) {
  return (
    <span className={`${styles.statusPill} ${styles[tone]}`}>
      <i />
      {status}
    </span>
  );
}

function DocumentList({ documents }) {
  if (!documents.length) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có tài liệu liên quan" />;
  }

  return (
    <div className={styles.documentList}>
      {documents.map((doc) => (
        <article className={styles.documentItem} key={doc.id}>
          <span className={styles.documentIcon}><FileTextOutlined /></span>
          <div className={styles.itemMain}>
            <strong>{doc.title}</strong>
            <span>{[doc.documentCode, doc.categoryName].filter(Boolean).join(' · ')}</span>
          </div>
          <StatusPill status={doc.status} tone={doc.status === 'INDEXED' ? 'success' : 'info'} />
        </article>
      ))}
    </div>
  );
}

function PermissionList({ groups }) {
  if (!groups.length) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có quyền theo danh mục" />;
  }

  return (
    <div className={styles.permissionList}>
      {groups.map((group) => (
        <article className={styles.permissionItem} key={group.categoryId}>
          <strong>{group.categoryName}</strong>
          <div className={styles.permissionPills}>
            {group.permissions.map((permission) => (
              <span className={styles.permissionPill} key={permission}>{permission}</span>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}

function ActivityTimeline({ activities }) {
  if (!activities.length) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có hoạt động gần đây" />;
  }

  return (
    <div className={styles.timeline}>
      {activities.map((activity) => (
        <article className={styles.timelineItem} key={activity.id}>
          <span className={`${styles.timelineDot} ${styles[activityTones[activity.resultType] || 'success']}`} />
          <strong>{activity.action}</strong>
          <span>{activity.detail}</span>
          <time>{formatDate(activity.createdAt)}</time>
        </article>
      ))}
    </div>
  );
}

function getDisplayName(user) {
  return user?.name || user?.fullName || user?.email || 'Người dùng';
}

export default function DashboardUser() {
  const user = useAuthStore((state) => state.user);
  const dashboardQuery = useUserDashboard();
  const dashboard = dashboardQuery.data;
  const displayName = getDisplayName(user);
  const department = Array.isArray(user?.departments) && user.departments.length > 0
    ? user.departments.map(d => d.name || d.departmentName).filter(Boolean).join(', ')
    : (user?.departmentName || user?.department || user?.departmentCode || 'Phòng ban của bạn');
  const role = user?.role || 'USER';
  const metrics = (dashboard?.metrics || []).map((metric) => ({
    ...metric,
    icon: metricIcons[metric.key] || <FileDoneOutlined />,
    tone: metricTones[metric.key] || 'primary',
  }));

  return (
    <main className={styles.page}>
      <header className={styles.heroHeader}>
        <div>
          <span className={styles.eyebrow}>MH20</span>
          <h1>Xin chào, {displayName}</h1>
          <p>Tổng quan hoạt động và quyền truy cập của bạn.</p>
        </div>
        <div className={styles.profileSummary}>
          <span><SafetyCertificateOutlined /> {department}</span>
          <span><FileDoneOutlined /> {role}</span>
        </div>
      </header>

      {dashboardQuery.isError && <Alert type="error" showIcon message={getApiErrorMessage(dashboardQuery.error)} />}

      {dashboardQuery.isLoading ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : (
        <>
          <section className={styles.metricsGrid} aria-label="Thống kê cá nhân">
            {metrics.map((card) => (
              <MetricCard key={card.key} {...card} />
            ))}
          </section>

          <section className={styles.contentGrid}>
            <SectionCard
              title="Tài liệu liên quan gần đây"
              className={styles.documentsPanel}
              action={<span className={styles.sectionAction}><SearchOutlined /> Gợi ý theo quyền truy cập</span>}
            >
              <DocumentList documents={dashboard?.recentDocuments || []} />
            </SectionCard>

            <aside className={styles.sideRail}>
              <SectionCard title="Quyền theo danh mục">
                <PermissionList groups={dashboard?.permissionGroups || []} />
              </SectionCard>
              <SectionCard title="Hoạt động gần đây" action={<HistoryOutlined className={styles.headerIcon} />}>
                <ActivityTimeline activities={dashboard?.recentActivities || []} />
              </SectionCard>
            </aside>
          </section>
        </>
      )}
    </main>
  );
}
