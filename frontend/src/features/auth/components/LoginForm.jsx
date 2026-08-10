import { EyeInvisibleOutlined, EyeOutlined, LockOutlined, MailOutlined } from '@ant-design/icons';
import { Alert, Button, Input } from 'antd';
import { useState } from 'react';
import { useLoginAction } from '../hooks/useAuthActions.js';
import { getApiErrorMessage } from '../../../utils/response.js';
import styles from './LoginForm.module.css';

export default function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [formValues, setFormValues] = useState({ email: '', password: '' });
  const loginMutation = useLoginAction();

  function handleChange(event) {
    const { name, value } = event.target;
    setFormValues((current) => ({ ...current, [name]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    loginMutation.mutate(formValues);
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      {loginMutation.isError && (
        <Alert type="error" showIcon message={getApiErrorMessage(loginMutation.error)} className={styles.errorAlert} />
      )}
      <div className={styles.field}>
        <label className={styles.label} htmlFor="email">
          Email
        </label>
        <div className={styles.inputShell}>
          <MailOutlined className={styles.leftIcon} />
          <Input
            id="email"
            name="email"
            placeholder="ten@company.com"
            type="email"
            className={styles.input}
            value={formValues.email}
            onChange={handleChange}
            autoComplete="email"
            required
          />
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
            value={formValues.password}
            onChange={handleChange}
            autoComplete="current-password"
            required
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

      <Button type="primary" htmlType="submit" block size="large" className={styles.submitButton} loading={loginMutation.isPending}>
        Đăng nhập
      </Button>

      <div className={styles.forgotRow}>
        <a href="#" className={styles.forgotLink}>
          Quên mật khẩu?
        </a>
      </div>
    </form>
  );
}
