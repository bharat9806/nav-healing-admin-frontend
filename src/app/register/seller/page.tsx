'use client';

import { isAxiosError } from 'axios';
import Link from 'next/link';
import { useState } from 'react';
import api from '@/lib/api';
import s from './seller-register.module.scss';

type SellerRegisterResponse = {
  email: string;
  username: string;
  userCode?: string;
  role?: string;
};

type FormState = {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
};

const initialForm: FormState = {
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
};

export default function SellerRegisterPage() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [registeredSeller, setRegisteredSeller] =
    useState<SellerRegisterResponse | null>(null);

  const updateField = (key: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError('');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setSaving(true);

    try {
      const response = await api.post<SellerRegisterResponse>('/auth/register', {
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
        role: 'TEAM_MEMBER',
      });

      setRegisteredSeller(response.data);
      setForm(initialForm);
    } catch (err) {
      const message = isAxiosError<{ message?: string | string[] }>(err)
        ? err.response?.data?.message
        : undefined;

      setError(
        Array.isArray(message)
          ? message.join(', ')
          : message || 'Could not register seller',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className={s.page}>
      <section className={s.shell}>
        <div className={s.brandPanel}>
          <div className={s.brandMark}>N</div>
          <p className={s.kicker}>Seller registration</p>
          <h1 className={s.title}>Create a seller account</h1>
          <p className={s.copy}>
            Add the seller details below. The system will create a team-member
            account and generate a user code for login.
          </p>
        </div>

        <div className={s.formPanel}>
          {registeredSeller ? (
            <div className={s.successBox}>
              <span className={s.successIcon}>✓</span>
              <h2>Seller registered</h2>
              <p>
                {registeredSeller.username} can sign in with the generated user
                code.
              </p>
              {registeredSeller.userCode && (
                <div className={s.codeBox}>
                  <span>User Code</span>
                  <strong>{registeredSeller.userCode}</strong>
                </div>
              )}
              <div className={s.actions}>
                <button
                  type="button"
                  className={s.secondaryBtn}
                  onClick={() => setRegisteredSeller(null)}
                >
                  Register Another
                </button>
                <Link href="/login" className={s.primaryLink}>
                  Go to Login
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className={s.form}>
              <div className={s.formHead}>
                <h2>Seller details</h2>
                <p>Use a valid email because non-admin users log in by OTP.</p>
              </div>

              {error && <div className={s.error}>{error}</div>}

              <div className={s.field}>
                <label htmlFor="username">Seller Name</label>
                <input
                  id="username"
                  type="text"
                  value={form.username}
                  onChange={(event) => updateField('username', event.target.value)}
                  minLength={3}
                  maxLength={50}
                  required
                  className={s.input}
                  autoComplete="name"
                />
              </div>

              <div className={s.field}>
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(event) => updateField('email', event.target.value)}
                  required
                  className={s.input}
                  autoComplete="email"
                />
              </div>

              <div className={s.grid}>
                <div className={s.field}>
                  <label htmlFor="password">Password</label>
                  <input
                    id="password"
                    type="password"
                    value={form.password}
                    onChange={(event) => updateField('password', event.target.value)}
                    minLength={8}
                    required
                    className={s.input}
                    autoComplete="new-password"
                  />
                </div>

                <div className={s.field}>
                  <label htmlFor="confirmPassword">Confirm Password</label>
                  <input
                    id="confirmPassword"
                    type="password"
                    value={form.confirmPassword}
                    onChange={(event) =>
                      updateField('confirmPassword', event.target.value)
                    }
                    minLength={8}
                    required
                    className={s.input}
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <button type="submit" disabled={saving} className={s.submitBtn}>
                {saving ? 'Creating...' : 'Create Seller'}
              </button>

              <Link href="/login" className={s.loginLink}>
                Already have a user code? Sign in
              </Link>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
