import { SafetyCertificateOutlined, SearchOutlined, ThunderboltOutlined } from '@ant-design/icons';
import LoginForm from '../components/LoginForm.jsx';
import styles from './LoginPage.module.css';

export default function LoginPage() {
  return (
    <div className={styles.page}>
      <section className={styles.brandingPanel} aria-label="Giới thiệu DMS">
        <div className={styles.brandingContent}>
          <div className={styles.logoRow}>
            <div className={styles.logoMark}>D</div>
            <span className={styles.logoText}>DMS</span>
          </div>

          <h1 className={styles.title}>
            Hệ thống quản lý tài liệu
            <br />
            doanh nghiệp
          </h1>
          <p className={styles.description}>
            Tìm kiếm toàn văn, phân quyền theo danh mục và phòng ban, quản lý phiên bản cùng nhật ký truy cập đầy đủ.
          </p>

          <ul className={styles.featureList}>
            <li className={styles.featureItem}>
              <span className={styles.featureIcon}>
                <ThunderboltOutlined />
              </span>
              <span>Tìm kiếm thông minh với gợi ý tức thời</span>
            </li>
            <li className={styles.featureItem}>
              <span className={styles.featureIcon}>
                <SafetyCertificateOutlined />
              </span>
              <span>An toàn lưu trữ & tìm kiếm</span>
            </li>
          </ul>
        </div>

        <div className={styles.copyright}>© 2026 DMS Platform</div>
        <SearchOutlined className={styles.decorIcon} />
        <div className={styles.decorTop} />
        <div className={styles.decorBottom} />
      </section>

      <main className={styles.loginPanel}>
        <div className={styles.formShell}>
          <div className={styles.loginHeader}>
            <h2 className={styles.loginTitle}>Đăng nhập</h2>
            <p className={styles.loginSubtitle}>Sử dụng tài khoản nội bộ được cấp bởi quản trị viên.</p>
          </div>
          <LoginForm />
        </div>
      </main>
    </div>
  );
}
