'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { fetchCurrentUser } from '@/lib/current-user';
import { User, Lead } from '@/types';
import s from './dashboard.module.scss';

interface DashboardStats {
  totalProducts: number;
  activeProducts: number;
  totalLeads: number;
  newLeads: number;
  totalUsers: number;
}

const statusCls = (status: string) => {
  switch (status) {
    case 'NEW':       return s.badgeNew;
    case 'CONTACTED': return s.badgeContacted;
    case 'CONVERTED': return s.badgeConverted;
    case 'CLOSED':    return s.badgeClosed;
    default:          return s.badgeClosed;
  }
};

const roleCls = (role: string) => {
  switch (role) {
    case 'SUPER_ADMIN': return s.roleSuperAdmin;
    case 'ADMIN':       return s.roleAdmin;
    default:            return s.roleTeamMember;
  }
};

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentLeads, setRecentLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchCurrentUser(), api.get('/dashboard/stats'), api.get('/leads?limit=5')])
      .then(([me, statsRes, leadsRes]) => {
        setUser(me);
        setStats(statsRes.data);
        setRecentLeads(leadsRes.data.data?.slice(0, 5) || leadsRes.data.slice(0, 5));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  };

  if (loading) {
    return (
      <div className={s.page}>
        <div className={s.skeletonBanner} />
        <div className={s.skeletonGrid}>
          {[...Array(5)].map((_, i) => <div key={i} className={s.skeletonCard} />)}
        </div>
      </div>
    );
  }

  return (
    <div className={s.page}>
      {/* Welcome Banner */}
      <div className={s.banner}>
        <h2 className={s.bannerTitle}>{greeting()}, {user?.username || 'Admin'}</h2>
        <p className={s.bannerDate}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
        {user && (
          <span className={`${s.rolePill} ${roleCls(user.role)}`}>
            {user.role.replace(/_/g, ' ')}
          </span>
        )}
      </div>

      {/* Stat Cards */}
      {stats && (
        <div className={s.statsGrid}>
          <StatCard label="Total Products"  value={stats.totalProducts}  colorCls={s.colorEmerald} />
          <StatCard label="Active Products" value={stats.activeProducts} colorCls={s.colorGreen} />
          <StatCard label="Total Leads"     value={stats.totalLeads}     colorCls={s.colorBlue} />
          <StatCard label="New Leads"       value={stats.newLeads}       colorCls={s.colorAmber} />
          <StatCard label="Total Users"     value={stats.totalUsers}     colorCls={s.colorViolet} />
        </div>
      )}

      <div className={s.bottomGrid}>
        {/* Recent Leads */}
        <div className={s.panel}>
          <div className={s.panelHeader}>
            <h3 className={s.panelTitle}>Recent Leads</h3>
            <Link href="/leads" className={s.panelLink}>View all</Link>
          </div>
          {recentLeads.length === 0 ? (
            <p className={s.emptyText}>No leads yet</p>
          ) : (
            recentLeads.map((lead) => (
              <div key={lead.id} className={s.leadRow}>
                <div>
                  <p className={s.leadName}>{lead.name}</p>
                  <p className={s.leadSub}>{lead.diseases} &middot; {lead.items?.length || 0} products</p>
                </div>
                <span className={statusCls(lead.status)}>{lead.status}</span>
              </div>
            ))
          )}
        </div>

        {/* Quick Actions */}
        <div className={s.panel}>
          <h3 className={s.panelTitle}>Quick Actions</h3>
          <div className={s.actionList}>
            <Link href="/products" className={s.actionItem}>
              <span className={`${s.actionIcon} ${s.iconEmerald}`}>🌿</span>
              Manage Products
            </Link>
            <Link href="/leads" className={s.actionItem}>
              <span className={`${s.actionIcon} ${s.iconBlue}`}>📋</span>
              Manage Leads
            </Link>
            <Link href="/users" className={s.actionItem}>
              <span className={`${s.actionIcon} ${s.iconViolet}`}>◎</span>
              Manage Users
            </Link>
          </div>
        </div>
      </div>

      {/* System Status */}
      <div className={s.statusBar}>
        <span className={s.statusDot}>System Online</span>
        <span>Nav Healing Herbs v1.0 &middot; {user?.email}</span>
      </div>
    </div>
  );
}

function StatCard({ label, value, colorCls }: { label: string; value: number; colorCls: string }) {
  return (
    <div className={s.statCard}>
      <p className={s.statLabel}>{label}</p>
      <p className={`${s.statValue} ${colorCls}`}>{value}</p>
    </div>
  );
}
