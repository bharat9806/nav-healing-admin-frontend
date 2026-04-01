'use client';

import { useEffect, useState } from 'react';
import { fetchCurrentUser } from '@/lib/current-user';
import { User } from '@/types';
import s from './Header.module.scss';

export default function Header({ title }: { title?: string }) {
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
      <h1 className={s.title}>{title || 'Dashboard'}</h1>
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
