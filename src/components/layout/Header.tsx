'use client';

import { useEffect, useState } from 'react';
import { fetchCurrentUser } from '@/lib/current-user';
import { User } from '@/types';
import { useTheme } from '@/components/theme/ThemeProvider';
import s from './Header.module.scss';

export default function Header({ title, onMenuClick }: { title?: string; onMenuClick?: () => void }) {
  const [user, setUser] = useState<User | null>(null);
  const { resolvedTheme, toggleTheme } = useTheme();

  useEffect(() => {
    fetchCurrentUser().then(setUser).catch(() => {});
  }, []);

  const roleCls = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN': return s.roleSuperAdmin;
      case 'ADMIN':       return s.roleAdmin;
      default:            return s.roleTeamMember;
    }
  };

  return (
    <header className={s.header}>
      <div className={s.left}>
        {onMenuClick && (
          <button
            type="button"
            className={s.menuBtn}
            onClick={onMenuClick}
            aria-label="Toggle menu"
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        )}
        <h1 className={s.title}>{title || 'Dashboard'}</h1>
      </div>
      <div className={s.right}>
        <button
          type="button"
          className={s.themeToggle}
          onClick={toggleTheme}
          aria-label={resolvedTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          title={resolvedTheme === 'dark' ? 'Light theme' : 'Dark theme'}
        >
          {resolvedTheme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>
        {user && (
          <>
            <div className={s.userInfo}>
              <p className={s.username}>{user.username}</p>
              <span className={`${s.roleBadge} ${roleCls(user.role)}`}>
                {user.role.replace(/_/g, ' ')}
              </span>
            </div>
            <div className={s.avatar}>
              <span>{user.username.charAt(0).toUpperCase()}</span>
            </div>
          </>
        )}
      </div>
    </header>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2.5" />
      <path d="M12 19.5V22" />
      <path d="M4.93 4.93 6.7 6.7" />
      <path d="M17.3 17.3 19.07 19.07" />
      <path d="M2 12h2.5" />
      <path d="M19.5 12H22" />
      <path d="M4.93 19.07 6.7 17.3" />
      <path d="M17.3 6.7 19.07 4.93" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>
  );
}
