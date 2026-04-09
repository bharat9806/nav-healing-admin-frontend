'use client';

import { useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import s from './layout.module.scss';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className={s.shell}>
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div className={s.backdrop} onClick={() => setSidebarOpen(false)} />
      )}

      <div className={`${s.sidebarWrap} ${sidebarOpen ? s.sidebarOpen : ''}`}>
        <Sidebar onNavigate={() => setSidebarOpen(false)} />
      </div>

      <div className={s.content}>
        <Header onMenuClick={() => setSidebarOpen((o) => !o)} />
        <main className={s.main}>
          {children}
        </main>
      </div>
    </div>
  );
}
