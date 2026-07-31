import { EyeInvisibleOutlined, EyeOutlined, LockOutlined, LoginOutlined, MailOutlined } from '@ant-design/icons';
import { Button, Checkbox, Input } from 'antd';
import { useState } from 'react';
import styles from './LoginForm.module.css';

export default function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form className={styles.form} action="#" method="post">
      <div className={styles.field}>
        <label className={styles.label} htmlFor="email">
          Email
        </label>
        <div className={styles.inputShell}>
          <MailOutlined className={styles.leftIcon} />
          <Input id="email" name="email" placeholder="email@company.com" type="email" className={styles.input} />
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="password">
          Mật khẩu
        </label>
        <div className={styles.inputShell}>
          <LockOutlined className={styles.leftIcon} />
          <Input
            id="password"
            name="password"
            placeholder="••••••••"
            type={showPassword ? 'text' : 'password'}
            className={styles.input}
          />
          <button
            className={styles.visibilityButton}
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          >
            {showPassword ? <EyeInvisibleOutlined className={styles.visibilityIcon} /> : <EyeOutlined className={styles.visibilityIcon} />}
          </button>
        </div>
      </div>

      <div className={styles.row}>
        <Checkbox className={styles.checkbox}>Ghi nhớ đăng nhập</Checkbox>
        <a href="#" className={styles.forgotLink}>
          Quên mật khẩu?
        </a>
      </div>

      <Button type="primary" htmlType="submit" block size="large" className={styles.submitButton} icon={<LoginOutlined />}>
        ĐĂNG NHẬP
      </Button>
    </form>
  );
}
