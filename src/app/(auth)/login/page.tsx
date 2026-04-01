'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import s from './login.module.scss';

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/auth/login', form);
      // Set cookie on current domain so Next.js middleware can read it
      if (res.data.access_token) {
        const maxAge = 7 * 24 * 60 * 60;
        document.cookie = `access_token=${res.data.access_token}; path=/; max-age=${maxAge}; secure; samesite=lax`;
      }
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={s.page}>
      <div className={s.wrapper}>
        <div className={s.brand}>
          <div className={s.brandIcon}>
            <svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 3c-1.5 2-4 4-4 7a4 4 0 108 0c0-3-2.5-5-4-7zM12 14v7m-3-3h6" />
            </svg>
          </div>
          <h1 className={s.brandTitle}>Nav Healing Herbs</h1>
          <p className={s.brandSub}>Sign in to your account</p>
        </div>

        <div className={s.card}>
          <form onSubmit={handleSubmit} className={s.form}>
            <div className={s.field}>
              <label>Username or Email</label>
              <input type="text" name="username" value={form.username} onChange={handleChange}
                placeholder="admin" required className={s.input} />
            </div>

            <div className={s.field}>
              <label>Password</label>
              <input type="password" name="password" value={form.password} onChange={handleChange}
                placeholder="••••••••" required className={s.input} />
            </div>

            {error && <div className={s.error}>{error}</div>}

            <button type="submit" disabled={loading} className={s.submitBtn}>
              {loading ? (
                <>
                  <svg className={s.spinner} fill="none" viewBox="0 0 24 24">
                    <circle className={s.track} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className={s.fill} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in...
                </>
              ) : 'Sign In'}
            </button>
          </form>
        </div>

        <p className={s.footer}>Nav Healing Herbs &copy; {new Date().getFullYear()}</p>
      </div>
    </div>
  );
}
