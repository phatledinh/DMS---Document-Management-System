import { useMutation } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import { login } from '../../../api/authApi.js';
import { getCurrentUser } from '../../../api/userApi.js';
import { useAuthStore } from '../../../store/authStore.js';
import { getApiErrorMessage } from '../../../utils/response.js';

export function useLoginAction() {
  const navigate = useNavigate();
  const location = useLocation();
  const setSession = useAuthStore((state) => state.setSession);

  return useMutation({
    mutationFn: async (payload) => {
      const authData = await login(payload);
      useAuthStore.getState().setAccessToken(authData.accessToken);
      const user = authData.user || await getCurrentUser();
      return { authData, user };
    },
    onSuccess: ({ authData, user }) => {
      setSession({ accessToken: authData.accessToken, user });
      const redirectTo = location.state?.from?.pathname || (user?.role === 'ADMIN' ? '/admin/dashboard' : '/');
      navigate(redirectTo, { replace: true });
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error));
    },
  });
}
