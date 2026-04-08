'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import api from '@/lib/api';
import { clearFrontendAuthCookie } from '@/lib/auth-cookie';
import { clearCurrentUserCache, fetchCurrentUser } from '@/lib/current-user';
import { User } from '@/types';
import s from './Sidebar.module.scss';

type PermissionKey =
  | 'canViewDashboard'
  | 'canManageProducts'
  | 'canManageProductSales'
  | 'canManageLeads'
  | 'canManageSales'
  | 'canManageUsers';

const allNavItems = [
  { label: 'Dashboard', href: '/dashboard', icon: <DashboardIcon />, permission: 'canViewDashboard' },
  { label: 'Products', href: '/products', icon: <ProductsIcon />, permission: 'canManageProducts' },
  { label: 'Product Sales', href: '/product-sales', icon: <ProductSalesIcon />, permission: 'canManageProductSales' },
  { label: 'Leads', href: '/leads', icon: <LeadsIcon />, permission: 'canManageLeads' },
  { label: 'Sales', href: '/sales', icon: <SalesIcon />, permission: 'canManageSales' },
  { label: 'Users', href: '/users', icon: <UsersIcon />, permission: 'canManageUsers' },
] satisfies Array<{
  label: string;
  href: string;
  icon: ReactNode;
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
    if (!user) return false;
    if (user.role === 'SUPER_ADMIN') return true;
    return user[item.permission] === true;
  });

  const handleLogout = async () => {
    clearCurrentUserCache();
    try {
      await api.post('/auth/logout');
    } catch {
      // If the backend is unreachable, still complete the local logout flow.
    } finally {
      clearFrontendAuthCookie();
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
        {!user ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={s.navSkeleton} />
          ))
        ) : (
          navItems.map((item) => {
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
          })
        )}
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

function IconShell({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

function DashboardIcon() {
  return (
    <IconShell>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </IconShell>
  );
}

function ProductsIcon() {
  return (
    <IconShell>
      <path d="M5 8.5 12 4l7 4.5" />
      <path d="M5 8.5V16l7 4 7-4V8.5" />
      <path d="M12 12 19 8.5" />
      <path d="M12 12 5 8.5" />
      <path d="M12 12v8" />
    </IconShell>
  );
}

function LeadsIcon() {
  return (
    <IconShell>
      <path d="M6 5h12" />
      <path d="M6 10h12" />
      <path d="M6 15h7" />
      <path d="M6 19h4" />
    </IconShell>
  );
}

function SalesIcon() {
  return (
    <IconShell>
      <path d="M4 7h16" />
      <path d="M4 12h10" />
      <path d="M4 17h16" />
      <circle cx="18" cy="12" r="2.5" />
    </IconShell>
  );
}

function ProductSalesIcon() {
  return (
    <IconShell>
      <path d="M7 7h10" />
      <path d="M7 12h6" />
      <path d="M7 17h10" />
      <path d="M17 10v6" />
      <path d="M14 13h6" />
    </IconShell>
  );
}

function UsersIcon() {
  return (
    <IconShell>
      <path d="M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </IconShell>
  );
}
