'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import s from './accept-invite.module.scss';

function AcceptInviteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [form, setForm] = useState({ username: '', password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) setError('Invalid invite link. Please contact your administrator.');
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) { setError('Passwords do not match'); return; }
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/accept-invite', { token, username: form.username, password: form.password });
      setSuccess(true);
      setTimeout(() => router.push('/dashboard'), 1500);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className={s.success}>
        <div className={s.successIcon}><span>✓</span></div>
        <h2 className={s.successTitle}>Account created!</h2>
        <p className={s.successSub}>Redirecting you to the dashboard...</p>
      </div>
    );
  }

  return (
    <>
      <div className={s.brand}>
        <div className={s.brandIcon}><span>N</span></div>
        <h1 className={s.brandTitle}>Set up your account</h1>
        <p className={s.brandSub}>Choose a username and password to get started</p>
      </div>

      <form onSubmit={handleSubmit} className={s.form}>
        {error && <div className={s.error}>{error}</div>}

        <div className={s.field}>
          <label>Username</label>
          <input type="text" value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
            required placeholder="e.g. johndoe" className={s.input} />
        </div>

        <div className={s.field}>
          <label>Password</label>
          <input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
            required minLength={6} placeholder="Minimum 6 characters" className={s.input} />
        </div>

        <div className={s.field}>
          <label>Confirm Password</label>
          <input type="password" value={form.confirmPassword} onChange={e => setForm(p => ({ ...p, confirmPassword: e.target.value }))}
            required placeholder="Repeat your password" className={s.input} />
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
