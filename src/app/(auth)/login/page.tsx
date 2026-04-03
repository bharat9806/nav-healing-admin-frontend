'use client';

import { isAxiosError } from 'axios';
import { useState } from 'react';
import api from '@/lib/api';
import { setFrontendAuthCookie } from '@/lib/auth-cookie';
import { clearCurrentUserCache } from '@/lib/current-user';
import s from './login.module.scss';

type LoginMode = 'password' | 'otp';

export default function LoginPage() {
  const [mode, setMode] = useState<LoginMode>('password');
  const [passwordForm, setPasswordForm] = useState({ userCode: '', password: '' });
  const [otpForm, setOtpForm] = useState({ userCode: '', otp: '' });
  const [otpSent, setOtpSent] = useState(false);
  const [info, setInfo] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPasswordForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
    setInfo('');
  };

  const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setOtpForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
    setInfo('');
  };

  const completeLogin = (accessToken?: string) => {
    if (accessToken) {
      setFrontendAuthCookie(accessToken);
    }
    clearCurrentUserCache();
    window.location.replace('/dashboard');
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setInfo('');

    try {
      const response = await api.post<{ access_token?: string }>('/auth/login', passwordForm);
      completeLogin(response.data.access_token);
    } catch (error) {
      const message = isAxiosError<{ message?: string }>(error)
        ? error.response?.data?.message
        : undefined;
      setError(message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setInfo('');

    try {
      const response = await api.post<{ message?: string }>('/auth/request-otp', {
        userCode: otpForm.userCode,
      });
      setOtpSent(true);
      setInfo(response.data.message || 'OTP sent successfully');
    } catch (error) {
      const message = isAxiosError<{ message?: string }>(error)
        ? error.response?.data?.message
        : undefined;
      setError(message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setInfo('');

    try {
      const response = await api.post<{ access_token?: string }>('/auth/verify-otp', otpForm);
      completeLogin(response.data.access_token);
    } catch (error) {
      const message = isAxiosError<{ message?: string }>(error)
        ? error.response?.data?.message
        : undefined;
      setError(message || 'Invalid or expired OTP');
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
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 3c-1.5 2-4 4-4 7a4 4 0 108 0c0-3-2.5-5-4-7zM12 14v7m-3-3h6"
              />
            </svg>
          </div>
          <h1 className={s.brandTitle}>Nav Healing Herbs</h1>
          <p className={s.brandSub}>Use your user code. SUPER_ADMIN uses password, others sign in with OTP.</p>
        </div>

        <div className={s.card}>
          <div className={s.modeSwitch}>
            <button
              type="button"
              onClick={() => { setMode('password'); setError(''); setInfo(''); }}
              className={`${s.modeBtn} ${mode === 'password' ? s.modeBtnActive : ''}`}
            >
              Password
            </button>
            <button
              type="button"
              onClick={() => { setMode('otp'); setError(''); setInfo(''); }}
              className={`${s.modeBtn} ${mode === 'otp' ? s.modeBtnActive : ''}`}
            >
              Email OTP
            </button>
          </div>

          {mode === 'password' ? (
            <form onSubmit={handlePasswordSubmit} className={s.form}>
              <div className={s.field}>
                <label>User Code</label>
                <input
                  type="text"
                  name="userCode"
                  value={passwordForm.userCode}
                  onChange={handlePasswordChange}
                  placeholder="NH-SA-0001"
                  required
                  className={s.input}
                />
              </div>

              <div className={s.field}>
                <label>Password</label>
                <input
                  type="password"
                  name="password"
                  value={passwordForm.password}
                  onChange={handlePasswordChange}
                  placeholder="********"
                  required
                  className={s.input}
                />
              </div>

              {error && <div className={s.error}>{error}</div>}
              {info && <div className={s.info}>{info}</div>}

              <button type="submit" disabled={loading} className={s.submitBtn}>
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          ) : (
            <form onSubmit={otpSent ? handleVerifyOtp : handleRequestOtp} className={s.form}>
              <div className={s.field}>
                <label>User Code</label>
                <input
                  type="text"
                  name="userCode"
                  value={otpForm.userCode}
                  onChange={handleOtpChange}
                  placeholder="NH-TM-0001"
                  required
                  className={s.input}
                />
              </div>

              {otpSent && (
                <div className={s.field}>
                  <label>OTP</label>
                  <input
                    type="text"
                    name="otp"
                    value={otpForm.otp}
                    onChange={handleOtpChange}
                    placeholder="123456"
                    required
                    maxLength={6}
                    className={s.input}
                  />
                </div>
              )}

              {error && <div className={s.error}>{error}</div>}
              {info && <div className={s.info}>{info}</div>}

              <button type="submit" disabled={loading} className={s.submitBtn}>
                {loading ? (otpSent ? 'Verifying...' : 'Sending OTP...') : (otpSent ? 'Verify OTP' : 'Send OTP')}
              </button>

              {otpSent && (
                <button
                  type="button"
                  onClick={() => {
                    setOtpSent(false);
                    setOtpForm((prev) => ({ ...prev, otp: '' }));
                    setError('');
                    setInfo('');
                  }}
                  className={s.secondaryBtn}
                >
                  Change User Code
                </button>
              )}
            </form>
          )}
        </div>

        <p className={s.footer}>Nav Healing Herbs &copy; {new Date().getFullYear()}</p>
      </div>
    </div>
  );
}
