import axios from 'axios';
import { getAccessToken, useAuthStore } from '../store/authStore.js';
import { unwrapApiResponse } from '../utils/response.js';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';

const axiosClient = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

const refreshClient = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

let refreshPromise = null;

axiosClient.interceptors.request.use((config) => {
  const accessToken = getAccessToken();
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

async function refreshSession() {
  const refreshResponse = await refreshClient.post('/auth/refresh');
  const authData = unwrapApiResponse(refreshResponse);
  useAuthStore.getState().setAccessToken(authData.accessToken);

  const userResponse = await refreshClient.get('/users/me', {
    headers: { Authorization: `Bearer ${authData.accessToken}` },
  });
  const user = unwrapApiResponse(userResponse);
  useAuthStore.getState().setUser(user);

  return authData.accessToken;
}

axiosClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;
    const isAuthEndpoint = originalRequest?.url?.startsWith('/auth/login') || originalRequest?.url?.startsWith('/auth/refresh');

    if (status !== 401 || originalRequest?._retry || isAuthEndpoint) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      if (!refreshPromise) {
        useAuthStore.getState().setRefreshing(true);
        refreshPromise = refreshSession().finally(() => {
          useAuthStore.getState().setRefreshing(false);
          refreshPromise = null;
        });
      }

      const accessToken = await refreshPromise;
      originalRequest.headers.Authorization = `Bearer ${accessToken}`;
      return axiosClient(originalRequest);
    } catch (refreshError) {
      useAuthStore.getState().clearSession();
      window.location.assign('/login');
      return Promise.reject(refreshError);
    }
  },
);

export default axiosClient;
