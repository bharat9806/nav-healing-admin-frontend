import axios from 'axios';

// Requests go to the same-origin /backend-api proxy (see next.config.ts).
// Auth uses an httpOnly cookie set by the backend — the JWT is never
// readable by JavaScript, so XSS cannot steal it.
const api = axios.create({
  baseURL: '/backend-api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
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
        window.location.replace('/login?force=1');
      }
    }

    return Promise.reject(error);
  },
);

export default api;
