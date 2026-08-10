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
import { Empty } from 'antd';
import { useAuthStore } from '../../../store/authStore.js';
import styles from './DashboardUser.module.css';

const metricCards = [
  {
    label: 'Tài liệu đã upload',
    value: '14',
    detail: '+3 trong 30 ngày',
    icon: <UploadOutlined />,
    tone: 'primary',
  },
  {
    label: 'Lượt xem gần đây',
    value: '126',
    detail: '30 ngày qua',
    icon: <EyeOutlined />,
    tone: 'cyan',
  },
  {
    label: 'Lượt tải',
    value: '48',
    detail: '30 ngày qua',
    icon: <DownloadOutlined />,
    tone: 'green',
  },
  {
    label: 'Thao tác bị từ chối',
    value: '3',
    detail: 'Thiếu quyền',
    icon: <WarningOutlined />,
    tone: 'orange',
  },
];

const recentDocuments = [
  { title: 'Quy trình ISO 9001 — Kiểm soát chất lượng', meta: 'SOP-QA-001 · ISO', status: 'Sẵn sàng', tone: 'success' },
  { title: 'Biểu mẫu đăng ký nhân sự mới', meta: 'HR-FRM-014 · Biểu mẫu', status: 'Sẵn sàng', tone: 'success' },
  { title: 'Báo cáo tài chính Quý 2 / 2026', meta: 'FIN-RPT-Q2 · Báo cáo', status: 'Đang xử lý', tone: 'info' },
  { title: 'Chính sách an toàn thông tin nội bộ', meta: 'IT-POL-003 · Chính sách', status: 'Sẵn sàng', tone: 'success' },
];

const permissionGroups = [
  { category: 'ISO', permissions: ['VIEW', 'DOWNLOAD'] },
  { category: 'Biểu mẫu', permissions: ['VIEW', 'DOWNLOAD', 'UPLOAD'] },
  { category: 'Báo cáo', permissions: ['VIEW'] },
];

const recentActivities = [
  { action: 'DOWNLOAD', detail: 'Chính sách an toàn thông tin nội bộ', time: '07/08/2026 09:12', tone: 'danger' },
  { action: 'PREVIEW', detail: 'Quy trình ISO 9001 — Kiểm soát chất lượng', time: '07/08/2026 08:40', tone: 'success' },
  { action: 'SEARCH', detail: 'Từ khoá: “biểu mẫu nhân sự”', time: '06/08/2026 16:05', tone: 'success' },
  { action: 'UPLOAD', detail: 'Biểu mẫu đăng ký nhân sự mới', time: '05/08/2026 11:22', tone: 'success' },
];

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
        <article className={styles.documentItem} key={doc.title}>
          <span className={styles.documentIcon}><FileTextOutlined /></span>
          <div className={styles.itemMain}>
            <strong>{doc.title}</strong>
            <span>{doc.meta}</span>
          </div>
          <StatusPill status={doc.status} tone={doc.tone} />
        </article>
      ))}
    </div>
  );
}

function PermissionList({ groups }) {
  return (
    <div className={styles.permissionList}>
      {groups.map((group) => (
        <article className={styles.permissionItem} key={group.category}>
          <strong>{group.category}</strong>
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
  return (
    <div className={styles.timeline}>
      {activities.map((activity) => (
        <article className={styles.timelineItem} key={`${activity.action}-${activity.time}`}>
          <span className={`${styles.timelineDot} ${styles[activity.tone]}`} />
          <strong>{activity.action}</strong>
          <span>{activity.detail}</span>
          <time>{activity.time}</time>
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
  const displayName = getDisplayName(user);
  const department = user?.departmentName || user?.department || user?.departmentCode || 'Phòng ban của bạn';
  const role = user?.role || 'USER';

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

      <section className={styles.metricsGrid} aria-label="Thống kê cá nhân">
        {metricCards.map((card) => (
          <MetricCard key={card.label} {...card} />
        ))}
      </section>

      <section className={styles.contentGrid}>
        <SectionCard
          title="Tài liệu liên quan gần đây"
          className={styles.documentsPanel}
          action={<span className={styles.sectionAction}><SearchOutlined /> Gợi ý theo quyền truy cập</span>}
        >
          <DocumentList documents={recentDocuments} />
        </SectionCard>

        <aside className={styles.sideRail}>
          <SectionCard title="Quyền theo danh mục">
            <PermissionList groups={permissionGroups} />
          </SectionCard>
          <SectionCard title="Hoạt động gần đây" action={<HistoryOutlined className={styles.headerIcon} />}>
            <ActivityTimeline activities={recentActivities} />
          </SectionCard>
        </aside>
      </section>
    </main>
  );
}
