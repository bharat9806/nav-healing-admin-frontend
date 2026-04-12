import axios from 'axios';
import { clearFrontendAuthCookie, getFrontendAuthToken } from '@/lib/auth-cookie';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = getFrontendAuthToken();

  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      const requestUrl = String(error.config?.url ?? '');
      const isAuthSubmit =
        requestUrl.includes('/auth/login') ||
        requestUrl.includes('/auth/accept-invite') ||
        requestUrl.includes('/auth/login-method') ||
        requestUrl.includes('/auth/request-otp') ||
        requestUrl.includes('/auth/verify-otp');
      const isOnLoginPage = window.location.pathname.startsWith('/login');

      if (!isAuthSubmit && !isOnLoginPage) {
        clearFrontendAuthCookie();
        window.location.replace('/login?force=1');
      }
    }

    return Promise.reject(error);
  },
);

export default api;
