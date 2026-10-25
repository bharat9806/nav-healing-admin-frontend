'use client';

import { useEffect, useState } from 'react';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Legend, Tooltip,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Bar, ComposedChart, Area,
} from 'recharts';
import api from '@/lib/api';
import LoadError from '@/components/ui/LoadError';
import s from './analytics.module.scss';

// ── API payload ───────────────────────────────────────────────────────────────
interface Analytics {
  statusBreakdown: { status: string; count: number }[];
  deliveryBreakdown: { deliveryStatus: string; count: number }[];
  timeline: { month: string; leads: number; delivered: number; revenue: number }[];
  topProducts: { name: string; units: number; leads: number }[];
  salesTimeline: { month: string; sales: number; revenue: number }[];
  topMedicines: { name: string; units: number; patients: number }[];
  expenseTimeline: { month: string; expenses: number; revenue: number }[];
  expensesByCategory: { category: string; total: number; count: number }[];
}

// ── Colors (match app palette) ────────────────────────────────────────────────
const EMERALD = 'var(--status-success)';
const BLUE    = 'var(--status-info)';
const AMBER   = 'var(--status-warning)';
const VIOLET  = 'var(--status-special)';
const RED     = 'var(--status-danger)';
const SLATE   = 'var(--status-neutral)';

const TOOLTIP_STYLE = {
  backgroundColor: 'var(--shell-card-bg)',
  border: '1px solid var(--shell-border)',
  borderRadius: 8,
  color: 'var(--shell-text-primary)',
  fontSize: 12,
};

// ── Lead status → readable buckets (15 raw statuses is too many for a pie) ───
const STATUS_BUCKETS: { label: string; color: string; statuses: string[] }[] = [
  { label: 'New',         color: BLUE,    statuses: ['NEW'] },
  { label: 'In Progress', color: AMBER,   statuses: ['CONTACTED', 'CALL_BACK', 'FOLLOW_UP_1', 'FOLLOW_UP_2', 'FOLLOW_UP_3', 'HTU'] },
  { label: 'Converted',   color: EMERALD, statuses: ['CONVERTED'] },
  { label: 'Unreachable', color: SLATE,   statuses: ['NOT_PICK', 'SWITCH_OFF', 'NOT_REACHABLE', 'HANG_UP'] },
  { label: 'Rejected',    color: RED,     statuses: ['NOT_INTERESTED', 'OTHER_TREATMENT', 'DNC'] },
  { label: 'Closed',      color: VIOLET,  statuses: ['CLOSED'] },
];

const DELIVERY_META: Record<string, { label: string; color: string }> = {
  DELIVERED: { label: 'Delivered', color: EMERALD },
  RTO:       { label: 'RTO',       color: RED },
  CANCELLED: { label: 'Cancelled', color: SLATE },
  NONE:      { label: 'Pending',   color: AMBER },
};

const monthLabel = (m: string) => {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo - 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
};

// Leaderboard-style list — full names stay readable regardless of length.
function RankList({ rows, unit, violet }: {
  rows: { name: string; value: number; meta: string }[];
  unit: string;
  violet?: boolean;
}) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className={s.rankList}>
      {rows.map((r, i) => (
        <div key={r.name} className={s.rankRow}>
          <span className={s.rankNum}>{i + 1}</span>
          <div className={s.rankBody}>
            <div className={s.rankHead}>
              <span className={s.rankName}>{r.name}</span>
              <span className={s.rankMeta}>
                <span className={s.rankValue}>{r.value}</span> {unit} · {r.meta}
              </span>
            </div>
            <div className={s.rankTrack}>
              <div
                className={`${s.rankFill} ${violet ? s.rankFillViolet : ''}`}
                style={{ width: `${(r.value / max) * 100}%` }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState(12);

  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    api.get('/analytics')
      .then((res) => { if (active) setData(res.data); })
      .catch(() => { if (active) setData(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refresh]);

  if (loading) {
    return (
      <div className={s.page}>
        <div className={s.grid}>
          {[...Array(4)].map((_, i) => <div key={i} className={s.skeleton} />)}
        </div>
      </div>
    );
  }

  if (!data) return <div className={s.page}><LoadError message="Unable to load analytics. Check your connection and try again." onRetry={() => { setLoading(true); setRefresh((value) => value + 1); }} /></div>;

  const statusData = STATUS_BUCKETS
    .map((b) => ({
      name: b.label,
      color: b.color,
      value: data.statusBreakdown
        .filter((r) => b.statuses.includes(r.status))
        .reduce((sum, r) => sum + r.count, 0),
    }))
    .filter((d) => d.value > 0);

  const deliveryData = data.deliveryBreakdown
    .map((r) => ({
      name: DELIVERY_META[r.deliveryStatus]?.label ?? r.deliveryStatus,
      color: DELIVERY_META[r.deliveryStatus]?.color ?? SLATE,
      value: r.count,
    }))
    .filter((d) => d.value > 0);

  const timeline = data.timeline.slice(-months).map((t) => ({ ...t, label: monthLabel(t.month) }));
  const products = data.topProducts;
  const salesTimeline = data.salesTimeline.slice(-months).map((t) => ({ ...t, label: monthLabel(t.month) }));
  const medicines = data.topMedicines;
  const expenseTimeline = data.expenseTimeline.slice(-months).map((t) => ({
    ...t,
    profit: t.revenue - t.expenses,
    label: monthLabel(t.month),
  }));
  const PIE_COLORS = [EMERALD, BLUE, AMBER, VIOLET, RED, SLATE, 'var(--status-special)', 'var(--status-info)', 'var(--accent-earth)', 'var(--status-success)'];
  const categories = data.expensesByCategory.map((c, i) => ({
    name: c.category,
    value: c.total,
    color: PIE_COLORS[i % PIE_COLORS.length],
  }));
  const inr = (v: number) => `₹${Number(v).toLocaleString('en-IN')}`;

  return (
    <div className={s.page}>
      <div>
        <h2 className={s.pageTitle}>Analytics</h2>
        <p className={s.pageSub}>Monthly charts show the selected period. Lead and delivery totals cover all records.</p>
      </div>

      <div className={s.periodControl}><label htmlFor="analytics-period">Monthly chart period</label><select id="analytics-period" value={months} onChange={(e) => setMonths(Number(e.target.value))}><option value={3}>Last 3 months</option><option value={6}>Last 6 months</option><option value={12}>Last 12 months</option></select></div>
      <div className={s.grid}>
        {/* 1 · Lead status breakdown */}
        <div className={s.panel}>
          <h3 className={s.panelTitle}>Lead Status Breakdown</h3>
          <p className={s.panelSub}>All leads, grouped by call outcome</p>
          {statusData.length === 0 ? <p className={s.emptyText}>No leads yet</p> : (
            <div className={s.chartWrap}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" innerRadius="45%" outerRadius="75%" paddingAngle={2} strokeWidth={0} label={(e: any) => `${e.name} (${e.value})`}>
                    {statusData.map((d) => <Cell key={d.name} fill={d.color} />)}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* 2 · Delivery outcomes */}
        <div className={s.panel}>
          <h3 className={s.panelTitle}>Delivery Outcomes</h3>
          <p className={s.panelSub}>Delivered vs RTO vs Cancelled — watch the RTO rate</p>
          {deliveryData.length === 0 ? <p className={s.emptyText}>No orders yet</p> : (
            <div className={s.chartWrap}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={deliveryData} dataKey="value" nameKey="name" innerRadius="45%" outerRadius="75%" paddingAngle={2} strokeWidth={0} label={(e: any) => `${e.name} (${e.value})`}>
                    {deliveryData.map((d) => <Cell key={d.name} fill={d.color} />)}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* 3 · Leads & deliveries over time (+ revenue) */}
        <div className={s.panel}>
          <h3 className={s.panelTitle}>Leads, Deliveries &amp; Revenue Over Time</h3>
          <p className={s.panelSub}>Monthly trend — revenue (₹) on the right axis</p>
          <div className={s.chartWrap}>
            <ResponsiveContainer>
              <LineChart data={timeline} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--shell-border)" />
                <XAxis dataKey="label" tick={{ fill: SLATE, fontSize: 11 }} />
                <YAxis yAxisId="left" allowDecimals={false} tick={{ fill: SLATE, fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: SLATE, fontSize: 11 }} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value: any, name: any) => (name === 'Revenue (₹)' ? [`₹${Number(value).toLocaleString('en-IN')}`, name] : [value, name])} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line yAxisId="left" type="monotone" dataKey="leads" name="New Leads" stroke={BLUE} strokeWidth={2} dot={false} />
                <Line yAxisId="left" type="monotone" dataKey="delivered" name="Delivered" stroke={EMERALD} strokeWidth={2} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="revenue" name="Revenue (₹)" stroke={AMBER} strokeWidth={2} dot={false} strokeDasharray="6 3" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 4 · Top products */}
        <div className={s.panel}>
          <h3 className={s.panelTitle}>Top Products</h3>
          <p className={s.panelSub}>Units ordered via leads (excluding cancelled &amp; RTO)</p>
          {products.length === 0 ? <p className={s.emptyText}>No product data yet</p> : (
            <RankList
              rows={products.map((p) => ({ name: p.name, value: p.units, meta: `${p.leads} lead${p.leads === 1 ? '' : 's'}` }))}
              unit="units"
            />
          )}
        </div>

        {/* 5 · Sales module — month-wise */}
        <div className={s.panel}>
          <h3 className={s.panelTitle}>Clinic Sales — Monthly</h3>
          <p className={s.panelSub}>Sales revenue (bars) and number of sales (line)</p>
          <div className={s.chartWrap}>
            <ResponsiveContainer>
              <ComposedChart data={salesTimeline} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--shell-border)" />
                <XAxis dataKey="label" tick={{ fill: SLATE, fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fill: SLATE, fontSize: 11 }} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)} />
                <YAxis yAxisId="right" orientation="right" allowDecimals={false} tick={{ fill: SLATE, fontSize: 11 }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value: any, name: any) => (name === 'Revenue (₹)' ? [inr(value), name] : [value, name])} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar yAxisId="left" dataKey="revenue" name="Revenue (₹)" fill={EMERALD} radius={[4, 4, 0, 0]} barSize={18} />
                <Line yAxisId="right" type="monotone" dataKey="sales" name="No. of Sales" stroke={BLUE} strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 6 · Sales module — top medicines */}
        <div className={s.panel}>
          <h3 className={s.panelTitle}>Most Given Medicines (Clinic)</h3>
          <p className={s.panelSub}>Units given to patients via the Sales module — last 12 months</p>
          {medicines.length === 0 ? <p className={s.emptyText}>No sales data yet</p> : (
            <RankList
              rows={medicines.map((p) => ({ name: p.name, value: p.units, meta: `${p.patients} patient${p.patients === 1 ? '' : 's'}` }))}
              unit="units"
              violet
            />
          )}
        </div>

        {/* 7 · Revenue vs Expenses */}
        <div className={s.panel}>
          <h3 className={s.panelTitle}>Revenue vs Expenses</h3>
          <p className={s.panelSub}>Monthly money in vs money out (all modules)</p>
          <div className={s.chartWrap}>
            <ResponsiveContainer>
              <ComposedChart data={expenseTimeline} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--shell-border)" />
                <XAxis dataKey="label" tick={{ fill: SLATE, fontSize: 11 }} />
                <YAxis tick={{ fill: SLATE, fontSize: 11 }} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value: any, name: any) => [inr(value), name]} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke={EMERALD} fill={EMERALD} fillOpacity={0.15} strokeWidth={2} />
                <Area type="monotone" dataKey="expenses" name="Expenses" stroke={RED} fill={RED} fillOpacity={0.15} strokeWidth={2} />
                <Line type="monotone" dataKey="profit" name="Net" stroke={AMBER} strokeWidth={2} dot={false} strokeDasharray="6 3" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 8 · Expenses by category */}
        <div className={s.panel}>
          <h3 className={s.panelTitle}>Expenses by Category</h3>
          <p className={s.panelSub}>Where the money went — last 12 months</p>
          {categories.length === 0 ? <p className={s.emptyText}>No expenses yet</p> : (
            <div className={s.chartWrap}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={categories} dataKey="value" nameKey="name" innerRadius="45%" outerRadius="75%" paddingAngle={2} strokeWidth={0} label={(e: any) => `${e.name} (${inr(e.value)})`}>
                    {categories.map((d) => <Cell key={d.name} fill={d.color} />)}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value: any) => inr(value)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
