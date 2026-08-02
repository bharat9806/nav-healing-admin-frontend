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
import f from './work-log.module.scss';

// ── Icons (inline SVG — no emoji glyphs in the UI) ──────────────────────────
const iconProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

const PhoneIcon = () => (
  <svg {...iconProps}>
    <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" />
  </svg>
);

const PlusIcon = () => (
  <svg {...iconProps}>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </svg>
);

const CloseIcon = () => (
  <svg {...iconProps}>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);

const TrashIcon = () => (
  <svg {...iconProps}>
    <path d="M3 6h18" />
    <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
  </svg>
);

const SlidersIcon = () => (
  <svg {...iconProps}>
    <path d="M4 6h16" />
    <path d="M4 12h16" />
    <path d="M4 18h16" />
    <circle cx="9" cy="6" r="2" />
    <circle cx="15" cy="12" r="2" />
    <circle cx="8" cy="18" r="2" />
  </svg>
);

const ClipboardIcon = () => (
  <svg {...iconProps}>
    <rect x="8" y="2" width="8" height="4" rx="1" />
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
  </svg>
);

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

type ContactType = 'PATIENT' | 'LEAD' | 'PROSPECT';

interface ContactHit {
  type: ContactType;
  id: number;
  name: string;
  phone?: string | null;
}

const CONTACT_LABELS: Record<ContactType, string> = {
  PATIENT: 'Patient', LEAD: 'Lead', PROSPECT: 'Prospect',
};

interface CallForm {
  phone: string;
  contactName: string;
  outcome: CallOutcome;
  notes: string;
  /** Set when the user picked a known contact rather than typing a raw number. */
  linkType?: ContactType;
  linkId?: number;
}

const emptyCall = (): CallForm => ({
  phone: '', contactName: '', outcome: 'CONNECTED', notes: '',
});

interface TaskForm {
  title: string;
  showCalls: boolean;
  calls: CallForm[];
  /** Optional extras, hidden behind "More" */
  showMore: boolean;
  category: WorkLogCategory | '';
  description: string;
  durationMinutes: string;
  status: WorkLogStatus;
}

const emptyTask = (): TaskForm => ({
  title: '',
  showCalls: false,
  calls: [],
  showMore: false,
  category: '',
  description: '',
  durationMinutes: '',
  status: 'COMPLETED',
});

interface WorkLogForm {
  logDate: string;
  tasks: TaskForm[];
}

const emptyForm = (): WorkLogForm => ({
  logDate: todayStr(),
  tasks: [emptyTask()],
});

/** Category is inferred from whether the task involved calling, unless set. */
const resolveCategory = (t: TaskForm): WorkLogCategory => {
  if (t.category) return t.category;
  return t.calls.some((c) => c.phone.trim()) ? 'CALLING' : 'OTHER';
};

/**
 * Number box for a logged call. Type a raw number and it's stored as-is;
 * type a name or number that matches a patient / lead / prospect and you
 * can pick it from the dropdown to attach the call to that record.
 */
function CallNumberInput({
  call,
  onChange,
}: {
  call: CallForm;
  onChange: (patch: Partial<CallForm>) => void;
}) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<ContactHit[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2 || call.linkId) {
      setHits([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await api.get<ContactHit[]>(
          `/work-logs/contacts?q=${encodeURIComponent(q)}`,
        );
        if (!cancelled) {
          setHits(res.data);
          setOpen(res.data.length > 0);
        }
      } catch {
        if (!cancelled) setHits([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query, call.linkId]);

  const pick = (hit: ContactHit) => {
    onChange({
      phone: hit.phone || call.phone,
      contactName: hit.name,
      linkType: hit.type,
      linkId: hit.id,
    });
    setQuery('');
    setHits([]);
    setOpen(false);
  };

  const unlink = () => {
    onChange({ linkType: undefined, linkId: undefined, contactName: '' });
  };

  if (call.linkId && call.linkType) {
    return (
      <div className={f.contactChip}>
        <span className={f.contactChipName}>{call.contactName}</span>
        <span className={f.contactChipPhone}>{call.phone || 'no number'}</span>
        <span className={f.contactChipType}>{CONTACT_LABELS[call.linkType]}</span>
        <button
          type="button"
          onClick={unlink}
          className={f.contactChipUnlink}
          aria-label={`Unlink ${call.contactName}`}
          title="Unlink"
        >
          <CloseIcon />
        </button>
      </div>
    );
  }

  return (
    <div className={f.contactBox}>
      <input
        type="tel"
        inputMode="tel"
        value={call.phone}
        onChange={(e) => {
          onChange({ phone: e.target.value });
          setQuery(e.target.value);
        }}
        onFocus={() => { if (hits.length) setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className={f.contactInput}
        placeholder="Number, or a name to search"
        aria-label="Phone number or contact name"
      />
      {open && hits.length > 0 && (
        <div className={f.contactDropdown} role="listbox">
          {hits.map((h) => (
            <button
              key={`${h.type}-${h.id}`}
              type="button"
              role="option"
              aria-selected={false}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(h)}
              className={f.contactOption}
            >
              <span className={f.contactOptionName}>{h.name}</span>
              <span className={f.contactOptionMeta}>
                <span>{h.phone || 'no number'}</span>
                <span className={f.contactChipType}>{CONTACT_LABELS[h.type]}</span>
              </span>
            </button>
          ))}
        </div>
      )}
      {open && !hits.length && searching && (
        <div className={f.contactDropdown}>
          <div className={f.contactOptionEmpty}>Searching...</div>
        </div>
      )}
    </div>
  );
}

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
      tasks: [
        {
          title: w.title,
          showCalls: w.calls.length > 0,
          calls: w.calls.map((c) => ({
            phone: c.phone,
            contactName: c.contactName || '',
            outcome: c.outcome,
            notes: c.notes || '',
            linkType: c.patientId
              ? ('PATIENT' as const)
              : c.leadId
                ? ('LEAD' as const)
                : c.prospectId
                  ? ('PROSPECT' as const)
                  : undefined,
            linkId: c.patientId ?? c.leadId ?? c.prospectId ?? undefined,
          })),
          showMore: !!(w.description || w.durationMinutes || w.status !== 'COMPLETED'),
          category: w.category,
          description: w.description || '',
          durationMinutes: w.durationMinutes != null ? String(w.durationMinutes) : '',
          status: w.status,
        },
      ],
    });
    setError('');
    setShowForm(true);
  };

  // ── Task row helpers ───────────────────────────────────────────────────────
  const setTask = (ti: number, patch: Partial<TaskForm>) =>
    setForm((f) => ({
      ...f,
      tasks: f.tasks.map((t, i) => (i === ti ? { ...t, ...patch } : t)),
    }));

  const addTaskRow = () =>
    setForm((f) => ({ ...f, tasks: [...f.tasks, emptyTask()] }));

  const removeTaskRow = (ti: number) =>
    setForm((f) => ({
      ...f,
      tasks: f.tasks.length === 1 ? f.tasks : f.tasks.filter((_, i) => i !== ti),
    }));

  // ── Call row helpers (scoped to a task) ────────────────────────────────────
  const setCall = (ti: number, ci: number, patch: Partial<CallForm>) =>
    setForm((f) => ({
      ...f,
      tasks: f.tasks.map((t, i) =>
        i !== ti
          ? t
          : { ...t, calls: t.calls.map((c, j) => (j === ci ? { ...c, ...patch } : c)) },
      ),
    }));

  const addCallRow = (ti: number) =>
    setForm((f) => ({
      ...f,
      tasks: f.tasks.map((t, i) =>
        i === ti ? { ...t, showCalls: true, calls: [...t.calls, emptyCall()] } : t,
      ),
    }));

  const removeCallRow = (ti: number, ci: number) =>
    setForm((f) => ({
      ...f,
      tasks: f.tasks.map((t, i) =>
        i === ti ? { ...t, calls: t.calls.filter((_, j) => j !== ci) } : t,
      ),
    }));

  /** Paste a block of numbers (one per line or comma separated) as call rows. */
  const bulkAddNumbers = (ti: number) => {
    const raw = window.prompt('Paste numbers — one per line or comma separated:');
    if (!raw) return;
    const numbers = raw
      .split(/[\n,;]+/)
      .map((n) => n.trim())
      .filter(Boolean);
    if (!numbers.length) return;
    setForm((f) => ({
      ...f,
      tasks: f.tasks.map((t, i) =>
        i === ti
          ? {
              ...t,
              showCalls: true,
              calls: [...t.calls, ...numbers.map((phone) => ({ ...emptyCall(), phone }))],
            }
          : t,
      ),
    }));
  };

  const taskToPayload = (t: TaskForm) => ({
    logDate: form.logDate,
    category: resolveCategory(t),
    title: t.title.trim(),
    description: t.description.trim() || undefined,
    status: t.status,
    durationMinutes: t.durationMinutes ? Number(t.durationMinutes) : undefined,
    calls: t.calls
      .filter((c) => c.phone.trim() || c.linkId)
      .map((c) => ({
        phone: c.phone.trim(),
        contactName: c.contactName.trim() || undefined,
        outcome: c.outcome,
        notes: c.notes.trim() || undefined,
        patientId: c.linkType === 'PATIENT' ? c.linkId : undefined,
        leadId: c.linkType === 'LEAD' ? c.linkId : undefined,
        prospectId: c.linkType === 'PROSPECT' ? c.linkId : undefined,
      })),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const filled = form.tasks.filter((t) => t.title.trim());
    if (filled.length === 0) {
      setError('Add at least one task');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (editing) {
        await api.put(`/work-logs/${editing.id}`, taskToPayload(filled[0]));
      } else {
        // One entry per task line, saved in a single request.
        await api.post('/work-logs/bulk', { entries: filled.map(taskToPayload) });
      }
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

            <div className={f.formShell}>
              <div className={f.dateField}>
                <label htmlFor="wl-date">Date</label>
                <input
                  id="wl-date"
                  type="date"
                  required
                  value={form.logDate}
                  onChange={(e) => setForm({ ...form, logDate: e.target.value })}
                />
              </div>

              <div className={f.tasksList}>
                {form.tasks.map((t, ti) => (
                  <div key={ti} className={f.taskCard}>
                    {form.tasks.length > 1 && (
                      <div className={f.taskHead}>
                        <span className={f.taskIndex}>Task {ti + 1}</span>
                        {!editing && (
                          <button
                            type="button"
                            onClick={() => removeTaskRow(ti)}
                            className={f.removeTaskBtn}
                          >
                            <TrashIcon />
                            Remove
                          </button>
                        )}
                      </div>
                    )}

                    <div className={f.taskTitleField}>
                      <label htmlFor={`wl-task-${ti}`}>What did you do?</label>
                      <input
                        id={`wl-task-${ti}`}
                        type="text"
                        value={t.title}
                        onChange={(e) => setTask(ti, { title: e.target.value })}
                        placeholder="e.g. Handled front desk walk-ins"
                        autoFocus={ti === form.tasks.length - 1 && !editing}
                      />
                    </div>

                    <div className={f.taskActions}>
                      {!t.showCalls && (
                        <button
                          type="button"
                          onClick={() => addCallRow(ti)}
                          className={f.ghostAction}
                        >
                          <PhoneIcon />
                          Add numbers called
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setTask(ti, { showMore: !t.showMore })}
                        className={`${f.ghostAction} ${t.showMore ? f.ghostActionActive : ''}`}
                        aria-expanded={t.showMore}
                      >
                        <SlidersIcon />
                        {t.showMore ? 'Hide options' : 'More options'}
                      </button>
                    </div>

                    {/* Calls for this task */}
                    {t.showCalls && (
                      <div className={f.callsBlock}>
                        <div className={f.callsHead}>
                          <span className={f.callsTitle}>
                            Numbers called ({t.calls.length})
                          </span>
                          <div className={f.callsHeadActions}>
                            <button
                              type="button"
                              onClick={() => addCallRow(ti)}
                              className={f.ghostAction}
                            >
                              <PlusIcon />
                              Add
                            </button>
                            <button
                              type="button"
                              onClick={() => bulkAddNumbers(ti)}
                              className={f.ghostAction}
                            >
                              <ClipboardIcon />
                              Paste list
                            </button>
                          </div>
                        </div>

                        {t.calls.length === 0 ? (
                          <p className={f.callsEmpty}>
                            No numbers yet — use Add for one at a time, or Paste list
                            to drop in a whole call sheet.
                          </p>
                        ) : (
                          <>
                            <div className={f.callsColumns} aria-hidden="true">
                              <span>Number or contact</span>
                              <span>Outcome</span>
                              <span />
                            </div>

                            {t.calls.map((c, ci) => (
                              <div key={ci} className={f.callRow}>
                                <div>
                                  <span className={f.callRowLabel}>Number or contact</span>
                                  <CallNumberInput
                                    call={c}
                                    onChange={(patch) => setCall(ti, ci, patch)}
                                  />
                                </div>
                                <div>
                                  <span className={f.callRowLabel}>Outcome</span>
                                  <select
                                    value={c.outcome}
                                    onChange={(e) =>
                                      setCall(ti, ci, { outcome: e.target.value as CallOutcome })
                                    }
                                    className={f.outcomeSelect}
                                    aria-label="Call outcome"
                                  >
                                    {outcomes.map((o) => (
                                      <option key={o} value={o}>{OUTCOME_LABELS[o]}</option>
                                    ))}
                                  </select>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeCallRow(ti, ci)}
                                  className={f.removeCallBtn}
                                  aria-label={`Remove ${c.phone || 'number'}`}
                                  title="Remove number"
                                >
                                  <CloseIcon />
                                </button>
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    )}

                    {/* Optional extras */}
                    {t.showMore && (
                      <div className={f.extras}>
                        <div className={f.extrasGrid}>
                          <div className={f.extrasField}>
                            <label>Category</label>
                            <CustomSelect
                              options={[
                                { label: 'Auto', value: '' },
                                ...categories.map((c) => ({ label: CATEGORY_LABELS[c], value: c })),
                              ]}
                              value={t.category}
                              onChange={(val) =>
                                setTask(ti, { category: String(val) as WorkLogCategory | '' })
                              }
                              align="left"
                              fullWidth
                            />
                          </div>
                          <div className={f.extrasField}>
                            <label>Status</label>
                            <CustomSelect
                              options={workStatuses.map((st) => ({
                                label: STATUS_LABELS[st],
                                value: st,
                              }))}
                              value={t.status}
                              onChange={(val) => setTask(ti, { status: val as WorkLogStatus })}
                              align="left"
                              fullWidth
                            />
                          </div>
                          <div className={f.extrasField}>
                            <label htmlFor={`wl-min-${ti}`}>Minutes spent</label>
                            <input
                              id={`wl-min-${ti}`}
                              type="number"
                              min={0}
                              inputMode="numeric"
                              value={t.durationMinutes}
                              onChange={(e) => setTask(ti, { durationMinutes: e.target.value })}
                              placeholder="e.g. 90"
                            />
                          </div>
                        </div>
                        <div className={f.extrasField}>
                          <label htmlFor={`wl-notes-${ti}`}>Notes</label>
                          <textarea
                            id={`wl-notes-${ti}`}
                            value={t.description}
                            onChange={(e) => setTask(ti, { description: e.target.value })}
                            rows={2}
                            placeholder="Anything worth remembering about this task"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {!editing && (
                <button type="button" onClick={addTaskRow} className={f.addTaskBtn}>
                  <PlusIcon />
                  Add another task
                </button>
              )}
            </div>

            <div className={s.formActions}>
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditing(null); }}
                className={s.cancelBtn}
              >
                Cancel
              </button>
              <button type="submit" disabled={saving} className={s.saveBtn}>
                {saving
                  ? 'Saving...'
                  : editing
                    ? 'Save Changes'
                    : `Save ${form.tasks.filter((t) => t.title.trim()).length || ''} Task${
                        form.tasks.filter((t) => t.title.trim()).length === 1 ? '' : 's'
                      }`}
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

            <div className={f.modalBody}>
              <div className={f.modalRow}>
                <div className={f.modalField}>
                  <label htmlFor="pdf-from">From</label>
                  <input
                    id="pdf-from"
                    type="date"
                    value={pdfFrom}
                    onChange={(e) => {
                      setPdfFrom(e.target.value);
                      if (pdfTo < e.target.value) setPdfTo(e.target.value);
                    }}
                  />
                </div>
                <div className={f.modalField}>
                  <label htmlFor="pdf-to">To</label>
                  <input
                    id="pdf-to"
                    type="date"
                    value={pdfTo}
                    onChange={(e) => setPdfTo(e.target.value)}
                  />
                </div>
              </div>

              {isAdmin && stats && stats.byUser.length > 0 && (
                <div className={f.modalField}>
                  <label>Staff</label>
                  <CustomSelect
                    options={[
                      { label: 'All staff', value: '' },
                      ...stats.byUser.map((u) => ({ label: u.username, value: String(u.userId) })),
                    ]}
                    value={pdfUser}
                    onChange={(val) => setPdfUser(String(val))}
                    align="left"
                    fullWidth
                  />
                </div>
              )}

              {pdfError && <div className={s.error}>{pdfError}</div>}
            </div>

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
