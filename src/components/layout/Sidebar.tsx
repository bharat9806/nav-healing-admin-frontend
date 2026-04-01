'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { User } from '@/types';
import s from './Sidebar.module.scss';

const allNavItems = [
  { label: 'Dashboard', href: '/dashboard', icon: '▦', permission: 'canViewDashboard' },
  { label: 'Products',  href: '/products',  icon: '🌿', permission: 'canManageProducts' },
  { label: 'Leads',     href: '/leads',     icon: '📋', permission: 'canManageLeads' },
  { label: 'Users',     href: '/users',     icon: '◎',  permission: 'canManageUsers' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    api.get('/auth/me').then((res) => setUser(res.data)).catch(() => {});
  }, []);

  const navItems = allNavItems.filter((item) => {
    if (!user) return true;
    if (user.role === 'SUPER_ADMIN') return true;
    return (user as any)[item.permission] === true;
  });

  const handleLogout = async () => {
    try { await api.post('/auth/logout'); } finally { router.push('/login'); }
  };

  return (
    <aside className={s.sidebar}>
      <div className={s.brand}>
        <div className={s.brandIcon}><span>N</span></div>
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
          <span>⇤</span>
          Logout
        </button>
      </div>
    </aside>
  );
}
