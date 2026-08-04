'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import { fetchCurrentUser } from '@/lib/current-user';
import { DailyReport, DailyReportTotals, DailyReportsResponse } from '@/types';
import { SkeletonList } from '@/components/ui/Loader';
import { exportToExcel } from '@/lib/exportExcel';
import { generateDailyReportImage } from '@/lib/generateDailyReportImage';
import s from '../leads/leads.module.scss';

const today = () => new Date().toISOString().slice(0, 10);

// reportDate is a DATE column, so read it in UTC to avoid a day shift.
const formatDate = (iso: string) => {
  const d = new Date(iso);
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${d.getUTCFullYear()}`;
};

const toInputDate = (iso: string) => iso.slice(0, 10);

const formatMoney = (n: number) =>
  `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const EMPTY_TOTALS: DailyReportTotals = {
  totalCalls: 0, verifiedOrders: 0, tenPercentOffOrders: 0, totalSale: 0,
};

interface ReportForm {
  reportDate: string;
  totalCalls: string;
  verifiedOrders: string;
  tenPercentOffOrders: string;
  totalSale: string;
  notes: string;
}

const emptyForm = (): ReportForm => ({
  reportDate: today(),
  totalCalls: '',
  verifiedOrders: '',
  tenPercentOffOrders: '',
  totalSale: '',
  notes: '',
});

export default function DailyReportPage() {
  const [rows, setRows] = useState<DailyReport[]>([]);
  const [totals, setTotals] = useState<DailyReportTotals>(EMPTY_TOTALS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [canManage, setCanManage] = useState(true);

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<DailyReport | null>(null);
  const [form, setForm] = useState<ReportForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DailyReport | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      params.set('order', 'asc');
      const res = await api.get<DailyReportsResponse>(`/daily-reports?${params.toString()}`);
      setRows(res.data.data);
      setTotals({
        totalCalls: res.data.meta.totalCalls,
        verifiedOrders: res.data.meta.verifiedOrders,
        tenPercentOffOrders: res.data.meta.tenPercentOffOrders,
        totalSale: res.data.meta.totalSale,
      });
    } catch {
      setError('Failed to load daily reports');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchCurrentUser()
      .then((u) => setCanManage(u.role === 'SUPER_ADMIN' || u.canViewDashboard))
      .catch(() => {});
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setError('');
    setShowForm(true);
  };

  const openEdit = (r: DailyReport) => {
    setEditing(r);
    setForm({
      reportDate: toInputDate(r.reportDate),
      totalCalls: String(r.totalCalls),
      verifiedOrders: String(r.verifiedOrders),
      tenPercentOffOrders: String(r.tenPercentOffOrders),
      totalSale: String(r.totalSale),
      notes: r.notes || '',
    });
    setError('');
    setShowForm(true);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.reportDate) {
      setError('Pick a date for this report');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        reportDate: form.reportDate,
        totalCalls: Number(form.totalCalls || 0),
        verifiedOrders: Number(form.verifiedOrders || 0),
        tenPercentOffOrders: Number(form.tenPercentOffOrders || 0),
        totalSale: Number(form.totalSale || 0),
        notes: form.notes.trim() || undefined,
      };
      if (editing) await api.put(`/daily-reports/${editing.id}`, payload);
      else await api.post('/daily-reports', payload);
      setShowForm(false);
      setEditing(null);
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
        .response?.data?.message;
      setError(msg || 'Failed to save the report');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/daily-reports/${deleteTarget.id}`);
      setDeleteTarget(null);
      fetchData();
    } catch {
      setError('Failed to delete');
      setDeleteTarget(null);
    }
  };

  const handleDownloadImage = () => {
    generateDailyReportImage({
      rows,
      totals,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    });
  };

  const handleExportExcel = () => {
    const data = rows.map((r) => ({
      Date: formatDate(r.reportDate),
      'Total Calls': r.totalCalls,
      'Verified Orders': r.verifiedOrders,
      '10% Off Orders': r.tenPercentOffOrders,
      'Total Sale (Rs.)': r.totalSale,
      Notes: r.notes || '',
    }));
    data.push({
      Date: 'TOTAL',
      'Total Calls': totals.totalCalls,
      'Verified Orders': totals.verifiedOrders,
      '10% Off Orders': totals.tenPercentOffOrders,
      'Total Sale (Rs.)': totals.totalSale,
      Notes: '',
    });
    exportToExcel(data, `daily-report-${today()}`);
  };

  const conversion = totals.totalCalls > 0
    ? `${Math.round((totals.verifiedOrders / totals.totalCalls) * 100)}%`
    : '-';

  return (
    <div className={s.page}>
      <div className={s.header}>
        <div>
          <h2 className={s.pageTitle}>Daily Report</h2>
          <p className={s.leadDesc}>
            {rows.length} day{rows.length === 1 ? '' : 's'} recorded
            {rows.length > 0 ? ` · ${formatMoney(totals.totalSale)} total sale` : ''}
          </p>
        </div>
        <div className={s.headerActions}>
          <button onClick={handleExportExcel} className={s.exportBtn} disabled={rows.length === 0}>
            Export Excel
          </button>
          <button onClick={handleDownloadImage} className={s.exportBtn} disabled={rows.length === 0}>
            Download Image
          </button>
          {canManage && (
            <button onClick={openCreate} className={s.addBtn}>+ Add Day</button>
          )}
        </div>
      </div>

      <div className={s.reminderCards}>
        <div className={s.reminderCard}>
          <span className={s.reminderLabel}>Total Calls</span>
          <span className={s.reminderValue}>{totals.totalCalls}</span>
        </div>
        <div className={s.reminderCard}>
          <span className={s.reminderLabel}>Verified Orders</span>
          <span className={s.reminderValue}>{totals.verifiedOrders}</span>
        </div>
        <div className={s.reminderCard}>
          <span className={s.reminderLabel}>10% Off Orders</span>
          <span className={s.reminderValue}>{totals.tenPercentOffOrders}</span>
        </div>
        <div className={s.reminderCard}>
          <span className={s.reminderLabel}>Total Sale</span>
          <span className={s.reminderValue}>{formatMoney(totals.totalSale)}</span>
        </div>
        <div className={s.reminderCard}>
          <span className={s.reminderLabel}>Conversion</span>
          <span className={s.reminderValue}>{conversion}</span>
        </div>
      </div>

      {error && !showForm && <div className={s.error}>{error}</div>}

      {showForm && (
        <div className={s.inlineFormWrap}>
          <form onSubmit={handleSubmit} className={s.inlineForm}>
            <h2 className={s.inlineFormTitle}>{editing ? 'Edit Day' : 'New Day'}</h2>
            {error && <div className={s.error}>{error}</div>}
            <div className={s.grid2}>
              <div className={s.formGroup}>
                <label>Date *</label>
                <input
                  type="date"
                  value={form.reportDate}
                  onChange={(e) => setForm({ ...form, reportDate: e.target.value })}
                  className={s.formInput}
                />
              </div>
              <div className={s.formGroup}>
                <label>Total Calls</label>
                <input
                  type="number"
                  min={0}
                  value={form.totalCalls}
                  onChange={(e) => setForm({ ...form, totalCalls: e.target.value })}
                  className={s.formInput}
                  placeholder="Numbers received from ads"
                />
              </div>
            </div>
            <div className={s.grid2}>
              <div className={s.formGroup}>
                <label>Verified Orders</label>
                <input
                  type="number"
                  min={0}
                  value={form.verifiedOrders}
                  onChange={(e) => setForm({ ...form, verifiedOrders: e.target.value })}
                  className={s.formInput}
                  placeholder="e.g. 3"
                />
              </div>
              <div className={s.formGroup}>
                <label>10% Off Orders</label>
                <input
                  type="number"
                  min={0}
                  value={form.tenPercentOffOrders}
                  onChange={(e) => setForm({ ...form, tenPercentOffOrders: e.target.value })}
                  className={s.formInput}
                  placeholder="e.g. 1"
                />
              </div>
            </div>
            <div className={s.grid2}>
              <div className={s.formGroup}>
                <label>Total Sale (₹)</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.totalSale}
                  onChange={(e) => setForm({ ...form, totalSale: e.target.value })}
                  className={s.formInput}
                  placeholder="e.g. 2314"
                />
              </div>
              <div className={s.formGroup} />
            </div>
            <div className={s.formGroup}>
              <label>Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
                className={s.formTextarea}
                placeholder="Optional — e.g. Dr Krishan 5 kit order, 2 RTOs came back"
              />
            </div>
            <div className={s.formActions}>
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditing(null); setError(''); }}
                className={s.cancelBtn}
              >
                Cancel
              </button>
              <button type="submit" disabled={saving} className={s.saveBtn}>
                {saving ? 'Saving...' : editing ? 'Update' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}

      {!showForm && (
        <div className={s.filterPanel}>
          <div className={s.filterRow}>
            <div className={s.formGroup}>
              <label>From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className={s.formInput}
              />
            </div>
            <div className={s.formGroup}>
              <label>To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className={s.formInput}
              />
            </div>
            {(dateFrom || dateTo) && (
              <button
                type="button"
                onClick={() => { setDateFrom(''); setDateTo(''); }}
                className={s.clearBtn}
              >
                Clear dates
              </button>
            )}
          </div>
        </div>
      )}

      {!showForm && (loading ? (
        <SkeletonList rows={5} />
      ) : rows.length === 0 ? (
        <div className={s.emptyBox}>
          <div className={s.emptyText}>No daily reports yet</div>
        </div>
      ) : (
        <div className={s.tableWrap}>
          {/* Mobile cards */}
          <div className={s.mobileList}>
            {rows.map((r) => (
              <article key={`m-${r.id}`} className={s.mobileCard}>
                <div className={s.mobileCardTop}>
                  <div className={s.mobileCardHeader}>
                    <div>
                      <p className={s.leadName}>{formatDate(r.reportDate)}</p>
                      {r.notes && (
                        <p className={s.leadDesc} style={{ whiteSpace: 'pre-wrap' }}>{r.notes}</p>
                      )}
                    </div>
                    <span className={s.reminderValue}>{formatMoney(r.totalSale)}</span>
                  </div>
                </div>
                <div className={s.mobileMetaGrid}>
                  <div className={s.mobileMetaItem}>
                    <span className={s.mobileMetaLabel}>Total Calls</span>
                    <span className={s.cellText}>{r.totalCalls}</span>
                  </div>
                  <div className={s.mobileMetaItem}>
                    <span className={s.mobileMetaLabel}>Verified Orders</span>
                    <span className={s.cellText}>{r.verifiedOrders}</span>
                  </div>
                  <div className={s.mobileMetaItem}>
                    <span className={s.mobileMetaLabel}>10% Off Orders</span>
                    <span className={s.cellText}>{r.tenPercentOffOrders}</span>
                  </div>
                </div>
                {canManage && (
                  <div className={s.mobileActions}>
                    <button onClick={() => openEdit(r)} className={s.mobileEditBtn}>Edit</button>
                    <button onClick={() => setDeleteTarget(r)} className={s.mobileDeleteBtn}>Delete</button>
                  </div>
                )}
              </article>
            ))}
          </div>

          {/* Desktop table */}
          <table className={s.table}>
            <thead className={s.thead}>
              <tr>
                <th className={s.th}>Date</th>
                <th className={s.th}>Total Calls</th>
                <th className={s.th}>Verified Orders</th>
                <th className={s.th}>10% Off Orders</th>
                <th className={`${s.th} ${s.thRight}`}>Total Sale (Rs.)</th>
                <th className={`${s.th} ${s.hideMd}`}>Notes</th>
                <th className={`${s.th} ${s.thRight}`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={s.tr}>
                  <td className={s.td}><span className={s.leadName}>{formatDate(r.reportDate)}</span></td>
                  <td className={s.td}><span className={s.cellText}>{r.totalCalls}</span></td>
                  <td className={s.td}><span className={s.cellText}>{r.verifiedOrders}</span></td>
                  <td className={s.td}><span className={s.cellText}>{r.tenPercentOffOrders}</span></td>
                  <td className={`${s.td} ${s.tdRight}`}>
                    <span className={s.leadName}>{formatMoney(r.totalSale)}</span>
                  </td>
                  <td className={`${s.td} ${s.hideMd}`}>
                    <span className={s.cellText} style={{ whiteSpace: 'pre-wrap' }}>
                      {r.notes || '-'}
                    </span>
                  </td>
                  <td className={`${s.td} ${s.tdRight}`}>
                    {canManage && (
                      <>
                        <button onClick={() => openEdit(r)} className={s.editBtn}>Edit</button>
                        <button onClick={() => setDeleteTarget(r)} className={s.deleteBtn}>Delete</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              <tr className={s.tr}>
                <td className={s.td}><strong>TOTAL</strong></td>
                <td className={s.td}><strong>{totals.totalCalls}</strong></td>
                <td className={s.td}><strong>{totals.verifiedOrders}</strong></td>
                <td className={s.td}><strong>{totals.tenPercentOffOrders}</strong></td>
                <td className={`${s.td} ${s.tdRight}`}>
                  <strong>{formatMoney(totals.totalSale)}</strong>
                </td>
                <td className={`${s.td} ${s.hideMd}`} />
                <td className={`${s.td} ${s.tdRight}`} />
              </tr>
            </tbody>
          </table>
        </div>
      ))}

      {/* Delete modal */}
      {deleteTarget && (
        <div className={s.overlay}>
          <div className={s.deleteModal}>
            <h3 className={s.deleteTitle}>Delete this day?</h3>
            <p className={s.deleteMsg}>
              Remove the report for {formatDate(deleteTarget.reportDate)}
              {' '}({formatMoney(deleteTarget.totalSale)})? This cannot be undone.
            </p>
            <div className={s.deleteActions}>
              <button onClick={() => setDeleteTarget(null)} className={s.deleteCancelBtn}>Cancel</button>
              <button onClick={handleDelete} className={s.deleteConfirmBtn}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
