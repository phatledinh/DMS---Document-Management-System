import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LoginForm from './LoginForm.jsx';

const loginMutation = {
  mutate: vi.fn(),
  isPending: false,
  isError: false,
  error: null,
};

vi.mock('../hooks/useAuthActions.js', () => ({
  useLoginAction: () => loginMutation,
}));

vi.mock('../../../utils/response.js', () => ({
  getApiErrorMessage: (error) => error?.message || 'Có lỗi xảy ra',
}));

describe('LoginForm', () => {
  beforeEach(() => {
    loginMutation.mutate.mockClear();
    loginMutation.isPending = false;
    loginMutation.isError = false;
    loginMutation.error = null;
  });

  it('submits email and password through the login action', async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText('Email'), 'admin@dms.com');
    await user.type(screen.getByLabelText('Mật khẩu'), 'admin');
    await user.click(screen.getByRole('button', { name: /đăng nhập/i }));

    expect(loginMutation.mutate).toHaveBeenCalledWith({ email: 'admin@dms.com', password: 'admin' });
  });

  it('shows invalid credential errors from the login action', () => {
    loginMutation.isError = true;
    loginMutation.error = new Error('Invalid email or password');

    render(<LoginForm />);

    expect(screen.getByText('Invalid email or password')).toBeInTheDocument();
  });
});
