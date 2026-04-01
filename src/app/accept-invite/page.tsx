'use client';

import { isAxiosError } from 'axios';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { setFrontendAuthCookie } from '@/lib/auth-cookie';
import { clearCurrentUserCache } from '@/lib/current-user';
import s from './accept-invite.module.scss';

function AcceptInviteForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [form, setForm] = useState({ username: '', password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Invalid invite link. Please contact your administrator.');
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await api.post<{ access_token?: string }>('/auth/accept-invite', {
        token,
        username: form.username,
        password: form.password,
      });

      if (response.data.access_token) {
        setFrontendAuthCookie(response.data.access_token);
      }
      clearCurrentUserCache();
      setSuccess(true);
      setTimeout(() => window.location.replace('/dashboard'), 1500);
    } catch (error) {
      const message = isAxiosError<{ message?: string }>(error)
        ? error.response?.data?.message
        : undefined;

      setError(message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className={s.success}>
        <div className={s.successIcon}>
          <span>OK</span>
        </div>
        <h2 className={s.successTitle}>Account created!</h2>
        <p className={s.successSub}>Redirecting you to the dashboard...</p>
      </div>
    );
  }

  return (
    <>
      <div className={s.brand}>
        <div className={s.brandIcon}>
          <span>N</span>
        </div>
        <h1 className={s.brandTitle}>Set up your account</h1>
        <p className={s.brandSub}>Choose a username and password to get started</p>
      </div>

      <form onSubmit={handleSubmit} className={s.form}>
        {error && <div className={s.error}>{error}</div>}

        <div className={s.field}>
          <label>Username</label>
          <input
            type="text"
            value={form.username}
            onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
            required
            placeholder="e.g. johndoe"
            className={s.input}
          />
        </div>

        <div className={s.field}>
          <label>Password</label>
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
            required
            minLength={6}
            placeholder="Minimum 6 characters"
            className={s.input}
          />
        </div>

        <div className={s.field}>
          <label>Confirm Password</label>
          <input
            type="password"
            value={form.confirmPassword}
            onChange={(e) => setForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
            required
            placeholder="Repeat your password"
            className={s.input}
          />
        </div>

        <button type="submit" disabled={loading || !token} className={s.submitBtn}>
          {loading ? 'Setting up...' : 'Create Account'}
        </button>
      </form>
    </>
  );
}

export default function AcceptInvitePage() {
  return (
    <div className={s.page}>
      <div className={s.card}>
        <Suspense fallback={<div style={{ color: '#9ca3af', textAlign: 'center' }}>Loading...</div>}>
          <AcceptInviteForm />
        </Suspense>
      </div>
    </div>
  );
}
