import { LockOutlined } from '@ant-design/icons';
import { Typography } from 'antd';
import LoginForm from '../components/LoginForm.jsx';
import styles from './LoginPage.module.css';

export default function LoginPage() {
  return (
    <div className={styles.page}>
      <div className={styles.backdrop} />
      <div className={styles.cardShell}>
        <div className={styles.card}>
          <div className={styles.header}>
            <div className={styles.brandRow}>
              <LockOutlined className={styles.brandIcon} />
              <Typography.Title level={1} className={styles.brandTitle}>
                Deep Trust
              </Typography.Title>
            </div>
            <Typography.Text className={styles.subtitle}>Hệ thống Quản lý Tài liệu</Typography.Text>
          </div>
          <LoginForm />
        </div>
        <footer className={styles.footer}>
          <Typography.Text className={styles.footerText}>
            © 2026 Deep Trust DMS. Tất cả các quyền được bảo lưu.
          </Typography.Text>
          <div className={styles.footerLinks}>
            <a href="#">Hỗ trợ kỹ thuật</a>
            <span>|</span>
            <a href="#">Chính sách bảo mật</a>
          </div>
        </footer>
      </div>
    </div>
  );
}
