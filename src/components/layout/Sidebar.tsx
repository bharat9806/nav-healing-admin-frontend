'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { clearFrontendAuthCookie } from '@/lib/auth-cookie';
import { clearCurrentUserCache, fetchCurrentUser } from '@/lib/current-user';
import { User } from '@/types';
import s from './Sidebar.module.scss';

type PermissionKey =
  | 'canViewDashboard'
  | 'canManageProducts'
  | 'canManageLeads'
  | 'canManageUsers';

const allNavItems = [
  { label: 'Dashboard', href: '/dashboard', icon: '[]', permission: 'canViewDashboard' },
  { label: 'Products', href: '/products', icon: '[P]', permission: 'canManageProducts' },
  { label: 'Leads', href: '/leads', icon: '[L]', permission: 'canManageLeads' },
  { label: 'Users', href: '/users', icon: '[U]', permission: 'canManageUsers' },
] satisfies Array<{
  label: string;
  href: string;
  icon: string;
  permission: PermissionKey;
}>;

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    fetchCurrentUser().then(setUser).catch(() => {});
  }, []);

  const navItems = allNavItems.filter((item) => {
    if (!user) return true;
    if (user.role === 'SUPER_ADMIN') return true;
    return user[item.permission] === true;
  });

  const handleLogout = async () => {
    clearCurrentUserCache();
    clearFrontendAuthCookie();
    try {
      await api.post('/auth/logout');
    } finally {
      router.push('/login?force=1');
    }
  };

  return (
    <aside className={s.sidebar}>
      <div className={s.brand}>
        <div className={s.brandIcon}>
          <span>N</span>
        </div>
        <span className={s.brandName}>Nav Healing</span>
      </div>

      <nav className={s.nav}>
        {navItems.map((item) => {
          const isActive = item.href === '/dashboard'
            ? pathname === item.href
            : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${s.navItem} ${isActive ? s.navItemActive : ''}`}
            >
              <span className={s.icon}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className={s.footer}>
        <button onClick={handleLogout} className={s.logoutBtn}>
          <span>{'<-'}</span>
          Logout
        </button>
      </div>
    </aside>
  );
}
