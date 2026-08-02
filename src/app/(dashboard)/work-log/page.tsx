'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import { fetchCurrentUser } from '@/lib/current-user';
import {
  CallOutcome,
  WorkLog,
  WorkLogCategory,
  WorkLogStats,
  WorkLogStatus,
  WorkLogsResponse,
} from '@/types';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { SkeletonList } from '@/components/ui/Loader';
import { generateWorkLogReport } from '@/lib/generateWorkLogReport';
import s from '../leads/leads.module.scss';

const categories: WorkLogCategory[] = [
  'CALLING', 'RECEPTION', 'FOLLOW_UP', 'DATA_ENTRY',
  'DISPATCH', 'MEETING', 'ADMIN_WORK', 'OTHER',
];

const CATEGORY_LABELS: Record<string, string> = {
  CALLING: 'Calling', RECEPTION: 'Reception', FOLLOW_UP: 'Follow Up',
  DATA_ENTRY: 'Data Entry', DISPATCH: 'Dispatch', MEETING: 'Meeting',
  ADMIN_WORK: 'Admin Work', OTHER: 'Other',
};

const workStatuses: WorkLogStatus[] = ['COMPLETED', 'IN_PROGRESS', 'PENDING'];

const STATUS_LABELS: Record<string, string> = {
  COMPLETED: 'Completed', IN_PROGRESS: 'In Progress', PENDING: 'Pending',
};

const outcomes: CallOutcome[] = [
  'CONNECTED', 'NOT_PICKED', 'BUSY', 'SWITCHED_OFF', 'NOT_REACHABLE',
  'WRONG_NUMBER', 'CALL_BACK', 'INTERESTED', 'NOT_INTERESTED', 'ORDER_PLACED',
];

const OUTCOME_LABELS: Record<string, string> = {
  CONNECTED: 'Connected', NOT_PICKED: 'Not Picked', BUSY: 'Busy',
  SWITCHED_OFF: 'Switched Off', NOT_REACHABLE: 'Not Reachable',
  WRONG_NUMBER: 'Wrong Number', CALL_BACK: 'Call Back',
  INTERESTED: 'Interested', NOT_INTERESTED: 'Not Interested',
  ORDER_PLACED: 'Order Placed',
};

const statusCls = (st: string) => {
  switch (st) {
    case 'COMPLETED': return s.statusConverted;
    case 'IN_PROGRESS': return s.statusContacted;
    default: return s.statusNew;
  }
};

const outcomeCls = (o: string) => {
  switch (o) {
    case 'CONNECTED':
    case 'INTERESTED':
    case 'ORDER_PLACED': return s.statusConverted;
    case 'CALL_BACK': return s.statusCallBack;
    case 'NOT_INTERESTED':
    case 'WRONG_NUMBER': return s.statusNotInterested;
    default: return s.statusMissed;
  }
};

const todayStr = () => new Date().toISOString().slice(0, 10);

const formatDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-';

const formatMinutes = (m?: number | null) => {
  if (!m) return '-';
  const h = Math.floor(m / 60);
  const min = m % 60;
  return h ? `${h}h ${min}m` : `${min}m`;
};

interface CallForm {
  phone: string;
  contactName: string;
  outcome: CallOutcome;
  durationSeconds: string;
  notes: string;
}

const emptyCall = (): CallForm => ({
  phone: '', contactName: '', outcome: 'CONNECTED', durationSeconds: '', notes: '',
});

interface WorkLogForm {
  logDate: string;
  category: WorkLogCategory;
  title: string;
  description: string;
  status: WorkLogStatus;
  startTime: string;
  endTime: string;
  durationMinutes: string;
  calls: CallForm[];
}

const emptyForm = (): WorkLogForm => ({
  logDate: todayStr(),
  category: 'CALLING',
  title: '',
  description: '',
  status: 'COMPLETED',
  startTime: '',
  endTime: '',
  durationMinutes: '',
  calls: [],
});

export default function WorkLogPage() {
  const [rows, setRows] = useState<WorkLog[]>([]);
  const [stats, setStats] = useState<WorkLogStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [myUserId, setMyUserId] = useState<number | null>(null);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [sortField, setSortField] = useState('logDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<WorkLog | null>(null);
  const [form, setForm] = useState<WorkLogForm>(emptyForm());
  const [saving, setSaving] = useState(false);

  const [expanded, setExpanded] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WorkLog | null>(null);

  const [myUsername, setMyUsername] = useState('');
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfFrom, setPdfFrom] = useState(todayStr());
  const [pdfTo, setPdfTo] = useState(todayStr());
  const [pdfUser, setPdfUser] = useState('');
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState('');

  useEffect(() => {
    fetchCurrentUser()
      .then((u) => {
        setMyUserId(u.id);
        setMyUsername(u.username);
        setIsAdmin(u.role === 'SUPER_ADMIN' || u.role === 'ADMIN');
      })
      .catch(() => {});
  }, []);

  const buildParams = useCallback(
    (toPage: number) => {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (categoryFilter) params.set('category', categoryFilter);
      if (statusFilter) params.set('status', statusFilter);
      if (userFilter) params.set('userId', userFilter);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      params.set('page', String(toPage));
      params.set('limit', String(pageSize));
      params.set('sortBy', sortField);
      params.set('order', sortOrder);
      return params;
    },
    [search, categoryFilter, statusFilter, userFilter, dateFrom, dateTo, pageSize, sortField, sortOrder],
  );

  const fetchStats = useCallback(async () => {
    try {
      const p = new URLSearchParams();
      if (dateFrom) p.set('dateFrom', dateFrom);
      if (dateTo) p.set('dateTo', dateTo);
      if (userFilter) p.set('userId', userFilter);
      const res = await api.get<WorkLogStats>(`/work-logs/stats?${p.toString()}`);
      setStats(res.data);
    } catch {
      /* stats are supplementary — a failure here shouldn't block the table */
    }
  }, [dateFrom, dateTo, userFilter]);

  const fetchData = async (toPage = page) => {
    try {
      setLoading(true);
      const res = await api.get<WorkLogsResponse>(`/work-logs?${buildParams(toPage).toString()}`);
      setRows(res.data.data);
      setTotal(res.data.meta.total);
      setTotalPages(res.data.meta.totalPages || 1);
      setPage(res.data.meta.page);
      setError('');
    } catch {
      setError('Failed to load work logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(1);
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryFilter, statusFilter, userFilter, dateFrom, dateTo, pageSize, sortField, sortOrder]);

  const handleSort = (field: string) => {
    if (sortField === field) setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortOrder('desc'); }
  };

  const goToPage = (next: number) => {
    if (next < 1 || next > totalPages) return;
    fetchData(next);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setError('');
    setShowForm(true);
  };

  const openEdit = (w: WorkLog) => {
    setEditing(w);
    setForm({
      logDate: w.logDate.slice(0, 10),
      category: w.category,
      title: w.title,
      description: w.description || '',
      status: w.status,
      startTime: w.startTime || '',
      endTime: w.endTime || '',
      durationMinutes: w.durationMinutes != null ? String(w.durationMinutes) : '',
      calls: w.calls.map((c) => ({
        phone: c.phone,
        contactName: c.contactName || '',
        outcome: c.outcome,
        durationSeconds: c.durationSeconds != null ? String(c.durationSeconds) : '',
        notes: c.notes || '',
      })),
    });
    setError('');
    setShowForm(true);
  };

  const setCall = (idx: number, patch: Partial<CallForm>) => {
    setForm((f) => ({
      ...f,
      calls: f.calls.map((c, i) => (i === idx ? { ...c, ...patch } : c)),
    }));
  };

  const addCallRow = () => setForm((f) => ({ ...f, calls: [...f.calls, emptyCall()] }));

  const removeCallRow = (idx: number) =>
    setForm((f) => ({ ...f, calls: f.calls.filter((_, i) => i !== idx) }));

  /** Paste a block of numbers (one per line or comma separated) as call rows. */
  const bulkAddNumbers = () => {
    const raw = window.prompt('Paste numbers — one per line or comma separated:');
    if (!raw) return;
    const numbers = raw
      .split(/[\n,;]+/)
      .map((n) => n.trim())
      .filter(Boolean);
    if (!numbers.length) return;
    setForm((f) => ({
      ...f,
      calls: [...f.calls, ...numbers.map((phone) => ({ ...emptyCall(), phone }))],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload: Record<string, unknown> = {
        logDate: form.logDate,
        category: form.category,
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        status: form.status,
        startTime: form.startTime.trim() || undefined,
        endTime: form.endTime.trim() || undefined,
        durationMinutes: form.durationMinutes ? Number(form.durationMinutes) : undefined,
        calls: form.calls
          .filter((c) => c.phone.trim())
          .map((c) => ({
            phone: c.phone.trim(),
            contactName: c.contactName.trim() || undefined,
            outcome: c.outcome,
            durationSeconds: c.durationSeconds ? Number(c.durationSeconds) : undefined,
            notes: c.notes.trim() || undefined,
          })),
      };
      if (editing) await api.put(`/work-logs/${editing.id}`, payload);
      else await api.post('/work-logs', payload);
      setShowForm(false);
      setEditing(null);
      fetchData(editing ? page : 1);
      fetchStats();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save work log');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/work-logs/${deleteTarget.id}`);
      setDeleteTarget(null);
      fetchData(page);
      fetchStats();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete');
      setDeleteTarget(null);
    }
  };

  const openPdfModal = () => {
    // Prefill from the active date filter so "what I'm looking at" is the default.
    setPdfFrom(dateFrom || todayStr());
    setPdfTo(dateTo || dateFrom || todayStr());
    setPdfUser(userFilter);
    setPdfError('');
    setShowPdfModal(true);
  };

  /** Shortcut from a row: open the modal prefilled with that entry's day. */
  const openPdfForDay = (w: WorkLog) => {
    const day = w.logDate.slice(0, 10);
    setPdfFrom(day);
    setPdfTo(day);
    setPdfUser(isAdmin ? String(w.userId) : '');
    setPdfError('');
    setShowPdfModal(true);
  };

  /** Pull every entry for the chosen day(s) — the PDF is not paginated. */
  const handleDownloadPdf = async () => {
    if (pdfTo < pdfFrom) {
      setPdfError('The "to" date cannot be before the "from" date');
      return;
    }
    setPdfBusy(true);
    setPdfError('');
    try {
      const p = new URLSearchParams();
      p.set('dateFrom', pdfFrom);
      p.set('dateTo', pdfTo);
      if (isAdmin && pdfUser) p.set('userId', pdfUser);
      p.set('page', '1');
      p.set('limit', '500');
      p.set('sortBy', 'logDate');
      p.set('order', 'asc');

      const res = await api.get<WorkLogsResponse>(`/work-logs?${p.toString()}`);
      const logs = res.data.data;

      if (logs.length === 0) {
        setPdfError('No work was logged for that date');
        return;
      }

      // Name the report after whoever it covers.
      let staffName: string | undefined;
      if (!isAdmin) {
        staffName = myUsername;
      } else if (pdfUser) {
        staffName =
          stats?.byUser.find((u) => String(u.userId) === pdfUser)?.username ??
          logs[0].user?.username;
      } else {
        const names = new Set(logs.map((l) => l.user?.username).filter(Boolean));
        staffName = names.size === 1 ? (names.values().next().value as string) : undefined;
      }

      generateWorkLogReport({ logs, dateFrom: pdfFrom, dateTo: pdfTo, staffName });
      setShowPdfModal(false);
    } catch {
      setPdfError('Failed to build the report');
    } finally {
      setPdfBusy(false);
    }
  };

  const canEdit = (w: WorkLog) => myUserId != null && w.userId === myUserId;

  const linkedLabel = (c: WorkLog['calls'][number]) => {
    if (c.lead) return `Lead #${c.lead.id}`;
    if (c.prospect) return `Prospect #${c.prospect.id}`;
    if (c.patient) return `Patient #${c.patient.id}`;
    return null;
  };

  const clearFilters = () => {
    setSearch(''); setCategoryFilter(''); setStatusFilter('');
    setUserFilter(''); setDateFrom(''); setDateTo('');
  };

  return (
    <div className={s.page}>
      <div className={s.header}>
        <div>
          <h2 className={s.pageTitle}>{isAdmin ? 'Team Work Log' : 'My Work Log'}</h2>
          <p className={s.leadDesc}>
            {isAdmin
              ? `${total} entries logged by the team`
              : `${total} entries you have logged`}
          </p>
        </div>
        <div className={s.headerActions}>
          <button onClick={openPdfModal} className={s.exportBtn}>↓ Download PDF</button>
          <button onClick={openCreate} className={s.addBtn}>+ Log Work</button>
        </div>
      </div>

      {error && !showForm && <div className={s.error}>{error}</div>}

      {stats && !showForm && (
        <div className={s.reminderCards}>
          <div className={s.reminderCard}>
            <span className={s.reminderLabel}>Entries</span>
            <span className={s.reminderValue}>{stats.entries}</span>
          </div>
          <div className={s.reminderCard}>
            <span className={s.reminderLabel}>Calls Made</span>
            <span className={s.reminderValue}>{stats.calls}</span>
          </div>
          <div className={s.reminderCard}>
            <span className={s.reminderLabel}>Connected</span>
            <span className={s.reminderValue}>{stats.callsConnected}</span>
          </div>
          <div className={s.reminderCard}>
            <span className={s.reminderLabel}>Time Logged</span>
            <span className={s.reminderValue}>{formatMinutes(stats.minutes)}</span>
          </div>
        </div>
      )}

      {showForm && (
        <div className={s.inlineFormWrap}>
          <form onSubmit={handleSubmit} className={s.inlineForm}>
            <h2 className={s.inlineFormTitle}>{editing ? 'Edit Entry' : 'Log Work Done'}</h2>
            {error && <div className={s.error}>{error}</div>}

            <div className={s.grid2}>
              <div className={s.formGroup}>
                <label>Date *</label>
                <input
                  type="date"
                  required
                  value={form.logDate}
                  onChange={(e) => setForm({ ...form, logDate: e.target.value })}
                  className={s.formInput}
                />
              </div>
              <div className={s.formGroup}>
                <label>Category</label>
                <CustomSelect
                  options={categories.map((c) => ({ label: CATEGORY_LABELS[c], value: c }))}
                  value={form.category}
                  onChange={(val) => setForm({ ...form, category: val as WorkLogCategory })}
                  align="left"
                  minWidth="100%"
                />
              </div>
            </div>

            <div className={s.formGroup}>
              <label>What did you do? *</label>
              <input
                type="text"
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className={s.formInput}
                placeholder="e.g. Called pending follow-up list"
              />
            </div>

            <div className={s.formGroup}>
              <label>Details</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className={s.formTextarea}
                rows={3}
                placeholder="Optional notes about the work"
              />
            </div>

            <div className={s.grid3}>
              <div className={s.formGroup}>
                <label>Status</label>
                <CustomSelect
                  options={workStatuses.map((st) => ({ label: STATUS_LABELS[st], value: st }))}
                  value={form.status}
                  onChange={(val) => setForm({ ...form, status: val as WorkLogStatus })}
                  align="left"
                  minWidth="100%"
                />
              </div>
              <div className={s.formGroup}>
                <label>From</label>
                <input
                  type="time"
                  value={form.startTime}
                  onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                  className={s.formInput}
                />
              </div>
              <div className={s.formGroup}>
                <label>To</label>
                <input
                  type="time"
                  value={form.endTime}
                  onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                  className={s.formInput}
                />
              </div>
            </div>

            <div className={s.formGroup}>
              <label>Time Spent (minutes)</label>
              <input
                type="number"
                min={0}
                value={form.durationMinutes}
                onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })}
                className={s.formInput}
                placeholder="e.g. 90"
              />
            </div>

            <div className={s.itemsHeader}>
              <label>Calls Made ({form.calls.length})</label>
              <div>
                <button type="button" onClick={bulkAddNumbers} className={s.addItemBtn}>
                  Paste Numbers
                </button>
                <button type="button" onClick={addCallRow} className={s.addItemBtn}>
                  + Add Call
                </button>
              </div>
            </div>

            {form.calls.length === 0 && (
              <p className={s.leadDesc}>
                No calls added. Use “+ Add Call” if this entry involved calling.
              </p>
            )}

            {form.calls.map((c, idx) => (
              <div key={idx} className={s.itemRow}>
                <div className={s.grid3}>
                  <div className={s.formGroup}>
                    <label>Number *</label>
                    <input
                      type="tel"
                      value={c.phone}
                      onChange={(e) => setCall(idx, { phone: e.target.value })}
                      className={s.formInput}
                      placeholder="9876543210"
                    />
                  </div>
                  <div className={s.formGroup}>
                    <label>Name</label>
                    <input
                      type="text"
                      value={c.contactName}
                      onChange={(e) => setCall(idx, { contactName: e.target.value })}
                      className={s.formInput}
                      placeholder="Optional"
                    />
                  </div>
                  <div className={s.formGroup}>
                    <label>Outcome</label>
                    <select
                      value={c.outcome}
                      onChange={(e) => setCall(idx, { outcome: e.target.value as CallOutcome })}
                      className={s.formSelect}
                    >
                      {outcomes.map((o) => (
                        <option key={o} value={o}>{OUTCOME_LABELS[o]}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className={s.grid2}>
                  <div className={s.formGroup}>
                    <label>Call Length (seconds)</label>
                    <input
                      type="number"
                      min={0}
                      value={c.durationSeconds}
                      onChange={(e) => setCall(idx, { durationSeconds: e.target.value })}
                      className={s.formInput}
                      placeholder="Optional"
                    />
                  </div>
                  <div className={s.formGroup}>
                    <label>Call Notes</label>
                    <input
                      type="text"
                      value={c.notes}
                      onChange={(e) => setCall(idx, { notes: e.target.value })}
                      className={s.formInput}
                      placeholder="Optional"
                    />
                  </div>
                </div>
                <button type="button" onClick={() => removeCallRow(idx)} className={s.removeItemBtn}>
                  Remove
                </button>
              </div>
            ))}

            <div className={s.formActions}>
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditing(null); }}
                className={s.cancelBtn}
              >
                Cancel
              </button>
              <button type="submit" disabled={saving} className={s.saveBtn}>
                {saving ? 'Saving...' : editing ? 'Save Changes' : 'Save Entry'}
              </button>
            </div>
          </form>
        </div>
      )}

      {!showForm && (
        <div className={s.filterPanel}>
          <div className={s.filterRow}>
            <div className={s.searchWrapper}>
              <input
                type="text"
                placeholder="Search task, notes, or a phone number..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') fetchData(1); }}
                className={s.searchInput}
              />
              {search && (
                <button type="button" className={s.searchClear} onClick={() => { setSearch(''); fetchData(1); }}>✕</button>
              )}
            </div>
            <button onClick={() => fetchData(1)} className={s.searchBtn}>Search</button>
            <CustomSelect
              options={[{ label: 'All categories', value: '' }, ...categories.map((c) => ({ label: CATEGORY_LABELS[c], value: c }))]}
              value={categoryFilter}
              onChange={(val) => setCategoryFilter(String(val))}
              align="left"
              minWidth="170px"
            />
            <CustomSelect
              options={[{ label: 'All statuses', value: '' }, ...workStatuses.map((st) => ({ label: STATUS_LABELS[st], value: st }))]}
              value={statusFilter}
              onChange={(val) => setStatusFilter(String(val))}
              align="left"
              minWidth="160px"
            />
            {isAdmin && stats && stats.byUser.length > 0 && (
              <CustomSelect
                options={[{ label: 'All staff', value: '' }, ...stats.byUser.map((u) => ({ label: u.username, value: String(u.userId) }))]}
                value={userFilter}
                onChange={(val) => setUserFilter(String(val))}
                align="left"
                minWidth="160px"
              />
            )}
          </div>
          <div className={s.filterRow}>
            <div className={s.dateRange}>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={s.dateInput} />
              <span className={s.sep}>to</span>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={s.dateInput} />
            </div>
            <button type="button" onClick={clearFilters} className={s.clearBtn}>Clear</button>
          </div>
        </div>
      )}

      {!showForm && (loading ? (
        <SkeletonList rows={5} />
      ) : rows.length === 0 ? (
        <div className={s.emptyBox}>
          <div className={s.emptyText}>No work logged yet</div>
        </div>
      ) : (
        <div className={s.tableWrap}>
          {/* Mobile cards */}
          <div className={s.mobileList}>
            {rows.map((w) => (
              <article key={`m-${w.id}`} className={s.mobileCard}>
                <div className={s.mobileCardTop}>
                  <div className={s.mobileCardHeader}>
                    <div>
                      <p className={s.leadName}>{w.title}</p>
                      <p className={s.leadDesc}>
                        {CATEGORY_LABELS[w.category]}
                        {isAdmin && w.user ? ` · ${w.user.username}` : ''}
                      </p>
                    </div>
                    <span className={`${s.statusSelect} ${statusCls(w.status)}`}>
                      {STATUS_LABELS[w.status]}
                    </span>
                  </div>
                </div>
                <div className={s.mobileMetaGrid}>
                  <div className={s.mobileMetaItem}>
                    <span className={s.mobileMetaLabel}>Date</span>
                    <span className={s.cellText}>{formatDate(w.logDate)}</span>
                  </div>
                  <div className={s.mobileMetaItem}>
                    <span className={s.mobileMetaLabel}>Time</span>
                    <span className={s.cellText}>
                      {w.startTime && w.endTime ? `${w.startTime}–${w.endTime}` : formatMinutes(w.durationMinutes)}
                    </span>
                  </div>
                  <div className={s.mobileMetaItem}>
                    <span className={s.mobileMetaLabel}>Calls</span>
                    <span className={s.cellText}>{w.calls.length}</span>
                  </div>
                </div>
                {w.description && (
                  <div className={s.mobileNotes}>
                    <span className={s.mobileMetaLabel}>Details</span>
                    <span className={s.cellText}>{w.description}</span>
                  </div>
                )}
                {w.calls.length > 0 && (
                  <div className={s.mobileNotes}>
                    <span className={s.mobileMetaLabel}>Numbers Called</span>
                    <span className={s.cellText}>
                      {w.calls.map((c) => c.phone).join(', ')}
                    </span>
                  </div>
                )}
                <div className={s.mobileActions}>
                  <button onClick={() => openPdfForDay(w)} className={s.mobileEditBtn}>PDF</button>
                  {canEdit(w) && (
                    <>
                      <button onClick={() => openEdit(w)} className={s.mobileEditBtn}>Edit</button>
                      <button onClick={() => setDeleteTarget(w)} className={s.mobileDeleteBtn}>Delete</button>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>

          {/* Desktop table */}
          <table className={s.table}>
            <thead className={s.thead}>
              <tr>
                <th className={`${s.th} ${s.thSortable}`} onClick={() => handleSort('logDate')}>
                  Date{sortField === 'logDate' ? (sortOrder === 'asc' ? ' ↑' : ' ↓') : ' ↕'}
                </th>
                {isAdmin && <th className={s.th}>Staff</th>}
                <th className={`${s.th} ${s.thSortable}`} onClick={() => handleSort('title')}>
                  Task{sortField === 'title' ? (sortOrder === 'asc' ? ' ↑' : ' ↓') : ' ↕'}
                </th>
                <th className={`${s.th} ${s.thSortable}`} onClick={() => handleSort('category')}>
                  Category{sortField === 'category' ? (sortOrder === 'asc' ? ' ↑' : ' ↓') : ' ↕'}
                </th>
                <th className={s.th}>Time</th>
                <th className={s.th}>Calls</th>
                <th className={s.th}>Status</th>
                <th className={`${s.th} ${s.thRight}`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((w) => (
                <Fragment key={w.id}>
                  <tr className={s.tr}>
                    <td className={s.td}><span className={s.cellText}>{formatDate(w.logDate)}</span></td>
                    {isAdmin && (
                      <td className={s.td}><span className={s.cellText}>{w.user?.username || '-'}</span></td>
                    )}
                    <td className={s.td}>
                      <p className={s.leadName}>{w.title}</p>
                      {w.description && <p className={s.leadDesc}>{w.description}</p>}
                    </td>
                    <td className={s.td}><span className={s.cellText}>{CATEGORY_LABELS[w.category]}</span></td>
                    <td className={s.td}>
                      <span className={s.cellText}>
                        {w.startTime && w.endTime ? `${w.startTime}–${w.endTime}` : formatMinutes(w.durationMinutes)}
                      </span>
                    </td>
                    <td className={s.td}>
                      {w.calls.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => setExpanded(expanded === w.id ? null : w.id)}
                          className={s.editBtn}
                        >
                          {w.calls.length} {expanded === w.id ? '▲' : '▼'}
                        </button>
                      ) : (
                        <span className={s.cellText}>-</span>
                      )}
                    </td>
                    <td className={s.td}>
                      <span className={`${s.statusSelect} ${statusCls(w.status)}`}>
                        {STATUS_LABELS[w.status]}
                      </span>
                    </td>
                    <td className={`${s.td} ${s.tdRight}`}>
                      <button
                        onClick={() => openPdfForDay(w)}
                        className={s.editBtn}
                        title="Download this day as PDF"
                      >
                        PDF
                      </button>
                      {canEdit(w) && (
                        <>
                          <button onClick={() => openEdit(w)} className={s.editBtn}>Edit</button>
                          <button onClick={() => setDeleteTarget(w)} className={s.deleteBtn}>Delete</button>
                        </>
                      )}
                    </td>
                  </tr>
                  {expanded === w.id && (
                    <tr className={s.tr}>
                      <td className={s.td} colSpan={isAdmin ? 8 : 7}>
                        <table className={s.table}>
                          <thead className={s.thead}>
                            <tr>
                              <th className={s.th}>Number</th>
                              <th className={s.th}>Name</th>
                              <th className={s.th}>Outcome</th>
                              <th className={s.th}>Length</th>
                              <th className={s.th}>Linked To</th>
                              <th className={s.th}>Notes</th>
                            </tr>
                          </thead>
                          <tbody>
                            {w.calls.map((c) => (
                              <tr key={c.id} className={s.tr}>
                                <td className={s.td}><span className={s.leadName}>{c.phone}</span></td>
                                <td className={s.td}><span className={s.cellText}>{c.contactName || '-'}</span></td>
                                <td className={s.td}>
                                  <span className={`${s.statusSelect} ${outcomeCls(c.outcome)}`}>
                                    {OUTCOME_LABELS[c.outcome]}
                                  </span>
                                </td>
                                <td className={s.td}>
                                  <span className={s.cellText}>
                                    {c.durationSeconds != null ? `${c.durationSeconds}s` : '-'}
                                  </span>
                                </td>
                                <td className={s.td}>
                                  <span className={s.cellText}>{linkedLabel(c) || 'New number'}</span>
                                </td>
                                <td className={s.td}><span className={s.cellText}>{c.notes || '-'}</span></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>

          <div className={s.pagination}>
            <button onClick={() => goToPage(page - 1)} disabled={page <= 1} className={s.pageBtn}>← Prev</button>
            <span className={s.pageInfo}>Page {page} of {totalPages} ({total} entries)</span>
            <button onClick={() => goToPage(page + 1)} disabled={page >= totalPages} className={s.pageBtn}>Next →</button>
            <CustomSelect
              options={[10, 20, 30, 50].map((n) => ({ label: `${n} / page`, value: n }))}
              value={pageSize}
              onChange={(val) => setPageSize(Number(val))}
              align="right"
              direction="up"
            />
          </div>
        </div>
      ))}

      {showPdfModal && (
        <div className={s.overlay}>
          <div className={s.deleteModal}>
            <h3 className={s.deleteTitle}>Download Work Report</h3>
            <p className={s.deleteMsg}>
              Pick a day to export. Keep both dates the same for a single-day report,
              or widen them for a range.
            </p>

            <div className={s.grid2}>
              <div className={s.formGroup}>
                <label>From</label>
                <input
                  type="date"
                  value={pdfFrom}
                  onChange={(e) => {
                    setPdfFrom(e.target.value);
                    if (pdfTo < e.target.value) setPdfTo(e.target.value);
                  }}
                  className={s.formInput}
                />
              </div>
              <div className={s.formGroup}>
                <label>To</label>
                <input
                  type="date"
                  value={pdfTo}
                  onChange={(e) => setPdfTo(e.target.value)}
                  className={s.formInput}
                />
              </div>
            </div>

            {isAdmin && stats && stats.byUser.length > 0 && (
              <div className={s.formGroup}>
                <label>Staff</label>
                <CustomSelect
                  options={[
                    { label: 'All staff', value: '' },
                    ...stats.byUser.map((u) => ({ label: u.username, value: String(u.userId) })),
                  ]}
                  value={pdfUser}
                  onChange={(val) => setPdfUser(String(val))}
                  align="left"
                  minWidth="100%"
                />
              </div>
            )}

            {pdfError && <div className={s.error}>{pdfError}</div>}

            <div className={s.deleteActions}>
              <button
                type="button"
                onClick={() => setShowPdfModal(false)}
                className={s.deleteCancelBtn}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={pdfBusy}
                className={s.saveBtn}
              >
                {pdfBusy ? 'Preparing...' : 'Download PDF'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className={s.overlay}>
          <div className={s.deleteModal}>
            <h3 className={s.deleteTitle}>Delete Entry?</h3>
            <p className={s.deleteMsg}>
              Remove “{deleteTarget.title}” from {formatDate(deleteTarget.logDate)}?
              {deleteTarget.calls.length > 0 && ` Its ${deleteTarget.calls.length} logged call(s) will be removed too.`}
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
