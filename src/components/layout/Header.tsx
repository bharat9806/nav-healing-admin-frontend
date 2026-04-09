'use client';

import { useEffect, useState } from 'react';
import { fetchCurrentUser } from '@/lib/current-user';
import { User } from '@/types';
import s from './Header.module.scss';

export default function Header({ title, onMenuClick }: { title?: string; onMenuClick?: () => void }) {
  const [user, setUser] = useState<User | null>(null);

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
