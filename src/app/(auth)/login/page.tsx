'use client';

import { isAxiosError } from 'axios';
import { useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import { setFrontendAuthCookie } from '@/lib/auth-cookie';
import { clearCurrentUserCache } from '@/lib/current-user';
import s from './login.module.scss';

type Step = 'userCode' | 'password' | 'otp';

const OTP_COOLDOWN_SECONDS = 60;

export default function LoginPage() {
  const [step, setStep] = useState<Step>('userCode');
  const [userCode, setUserCode] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [emailHint, setEmailHint] = useState('');
  const [info, setInfo] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  const startResendCooldown = () => {
    setResendCooldown(OTP_COOLDOWN_SECONDS);
    cooldownRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const completeLogin = (accessToken?: string) => {
    if (accessToken) {
      setFrontendAuthCookie(accessToken);
    }
    clearCurrentUserCache();
    window.location.replace('/dashboard');
  };

  const handleResolveStep = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setInfo('');

    try {
      const response = await api.post<{ method: 'password' | 'otp'; emailHint?: string }>(
        '/auth/login-method',
        { userCode },
      );

      if (response.data.method === 'password') {
        setStep('password');
        setInfo('Enter your password to continue.');
      } else {
        setStep('otp');
        setEmailHint(response.data.emailHint || '');
        try {
          const otpResponse = await api.post<{ message?: string }>('/auth/request-otp', { userCode });
          setInfo(otpResponse.data.message || 'OTP sent successfully');
          startResendCooldown();
        } catch (otpErr) {
          const otpMsg = isAxiosError<{ message?: string }>(otpErr)
            ? otpErr.response?.data?.message
            : undefined;
          setError(otpMsg || 'Could not send OTP email. Use the Resend button to try again.');
        }
      }
    } catch (error) {
      const message = isAxiosError<{ message?: string }>(error)
        ? error.response?.data?.message
        : undefined;
      setError(message || 'Invalid user code');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setInfo('');

    try {
      const response = await api.post<{ access_token?: string }>('/auth/login', {
        userCode,
        password,
      });
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

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setInfo('');

    try {
      const response = await api.post<{ access_token?: string }>('/auth/verify-otp', {
        userCode,
        otp,
      });
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

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || loading) return;
    setLoading(true);
    setError('');
    setInfo('');
    try {
      const otpResponse = await api.post<{ message?: string }>('/auth/request-otp', { userCode });
      setInfo(otpResponse.data.message || 'OTP resent successfully');
      startResendCooldown();
    } catch (err) {
      const message = isAxiosError<{ message?: string }>(err)
        ? err.response?.data?.message
        : undefined;
      setError(message || 'Failed to resend OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetFlow = () => {
    setStep('userCode');
    setPassword('');
    setOtp('');
    setInfo('');
    setError('');
    setEmailHint('');
    setResendCooldown(0);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
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
          <p className={s.brandSub}>Enter your user code. We’ll guide you to password or OTP automatically.</p>
        </div>

        <div className={s.card}>
          {step === 'userCode' && (
            <form onSubmit={handleResolveStep} className={s.form}>
              <div className={s.field}>
                <label>User Code</label>
                <input
                  type="text"
                  value={userCode}
                  onChange={(e) => {
                    setUserCode(e.target.value.toUpperCase());
                    setError('');
                    setInfo('');
                  }}
                  placeholder="Enter your user code"
                  required
                  className={s.input}
                />
              </div>

              {error && <div className={s.error}>{error}</div>}
              {info && <div className={s.info}>{info}</div>}

              <button type="submit" disabled={loading} className={s.submitBtn}>
                {loading ? 'Checking...' : 'Continue'}
              </button>
            </form>
          )}

          {step === 'password' && (
            <form onSubmit={handlePasswordLogin} className={s.form}>
              <div className={s.field}>
                <label>User Code</label>
                <input type="text" value={userCode} disabled className={s.input} />
              </div>
              <div className={s.field}>
                <label>Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                    setInfo('');
                  }}
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
              <button type="button" onClick={resetFlow} className={s.secondaryBtn}>
                Change User Code
              </button>
            </form>
          )}

          {step === 'otp' && (
            <form onSubmit={handleVerifyOtp} className={s.form}>
              <div className={s.field}>
                <label>User Code</label>
                <input type="text" value={userCode} disabled className={s.input} />
              </div>
              {emailHint && (
                <div className={s.info}>OTP sent to <strong>{emailHint}</strong> — expires in 10 minutes.</div>
              )}
              <div className={s.field}>
                <label>OTP</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  value={otp}
                  onChange={(e) => {
                    setOtp(e.target.value.replace(/\D/g, ''));
                    setError('');
                    setInfo('');
                  }}
                  placeholder="123456"
                  required
                  maxLength={6}
                  autoComplete="one-time-code"
                  className={s.input}
                />
              </div>

              {error && <div className={s.error}>{error}</div>}
              {info && <div className={s.info}>{info}</div>}

              <button type="submit" disabled={loading} className={s.submitBtn}>
                {loading ? 'Verifying...' : 'Verify OTP'}
              </button>
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={resendCooldown > 0 || loading}
                className={s.secondaryBtn}
              >
                {resendCooldown > 0 ? `Resend OTP in ${resendCooldown}s` : 'Resend OTP'}
              </button>
              <button type="button" onClick={resetFlow} className={s.secondaryBtn}>
                Change User Code
              </button>
            </form>
          )}
        </div>

        <p className={s.footer}>Nav Healing Herbs &copy; {new Date().getFullYear()}</p>
      </div>
    </div>
  );
}
