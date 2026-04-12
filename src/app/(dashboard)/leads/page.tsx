'use client';

import { useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import { fetchCurrentUser } from '@/lib/current-user';
import { exportToExcel } from '@/lib/exportExcel';
import { Lead, Product, LeadStatus, LeadReminderStats, User } from '@/types';
import { CustomSelect } from '@/components/ui/CustomSelect';
import s from './leads.module.scss';

const statuses: LeadStatus[] = [
  'NEW', 'CONTACTED', 'CONVERTED', 'CLOSED',
  'NOT_PICK', 'SWITCH_OFF', 'NOT_REACHABLE', 'HANG_UP', 'CALL_BACK',
  'NOT_INTERESTED', 'OTHER_TREATMENT', 'DNC',
  'HTU', 'FOLLOW_UP_1', 'FOLLOW_UP_2', 'FOLLOW_UP_3',
];

const STATUS_LABELS: Record<string, string> = {
  NEW: 'New', CONTACTED: 'Contacted', CONVERTED: 'Converted', CLOSED: 'Closed',
  NOT_PICK: 'Not Pick', SWITCH_OFF: 'Switch Off', NOT_REACHABLE: 'Not Reachable',
  HANG_UP: 'Hang Up', CALL_BACK: 'Call Back', NOT_INTERESTED: 'Not Interested',
  OTHER_TREATMENT: 'Other Treatment', DNC: 'DNC',
  HTU: 'HTU', FOLLOW_UP_1: 'Follow Up 1', FOLLOW_UP_2: 'Follow Up 2', FOLLOW_UP_3: 'Follow Up 3',
};

const statusCls = (st: string) => {
  switch (st) {
    case 'NEW':            return s.statusNew;
    case 'CONTACTED':      return s.statusContacted;
    case 'CONVERTED':      return s.statusConverted;
    case 'CLOSED':         return s.statusClosed;
    case 'NOT_PICK':
    case 'SWITCH_OFF':
    case 'NOT_REACHABLE':
    case 'HANG_UP':        return s.statusMissed;
    case 'CALL_BACK':      return s.statusCallBack;
    case 'NOT_INTERESTED':
    case 'OTHER_TREATMENT':return s.statusNotInterested;
    case 'DNC':            return s.statusDnc;
    case 'HTU':
    case 'FOLLOW_UP_1':
    case 'FOLLOW_UP_2':
    case 'FOLLOW_UP_3':    return s.statusFollowUp;
    default:               return s.statusClosed;
  }
};

interface LeadItemForm { productId: number; quantity: number; search: string; showDropdown: boolean; }

type ProductOption = { id: number; name: string; sku: string; price: number };

function LeadProductSearch({
  value,
  displayName,
  onSelect,
}: {
  value: number;
  displayName: string;
  onSelect: (id: number, name: string) => void;
}) {
  const [query, setQuery] = useState(displayName);
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<ProductOption[]>([]);
  const [searching, setSearching] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep local query in sync when parent changes the display name (e.g. edit mode)
  useEffect(() => { if (!open) setQuery(displayName); }, [displayName, open]);

  // Debounced server-side search
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearching(true);
      api
        .get<ProductOption[]>(`/products/options?search=${encodeURIComponent(query)}&limit=10`)
        .then((res) => setResults(res.data || []))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, open]);

  // Load initial results when first opened
  useEffect(() => {
    if (open && results.length === 0 && !searching) {
      setSearching(true);
      api
        .get<ProductOption[]>('/products/options?limit=10')
        .then((res) => setResults(res.data || []))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }
  }, [open]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery(displayName); // restore name on blur without selection
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [displayName]);

  return (
    <div className={s.itemSearchWrap} ref={wrapRef}>
      <input
        type="text"
        className={s.itemSearchInput}
        placeholder="Search medicine..."
        value={query}
        autoComplete="off"
        onChange={(e) => {
          setQuery(e.target.value);
          if (!open) setOpen(true);
          if (e.target.value === '') onSelect(0, '');
        }}
        onFocus={() => {
          setOpen(true);
          setQuery('');
        }}
      />
      {open && (
        <div className={s.productDropdown}>
          {searching ? (
            <div className={s.productOptionEmpty}>Searching...</div>
          ) : results.length === 0 ? (
            <div className={s.productOptionEmpty}>No medicines found</div>
          ) : (
            results.map((p) => (
              <div
                key={p.id}
                className={`${s.productOption} ${value === p.id ? s.productOptionSelected : ''}`}
                onMouseDown={() => {
                  onSelect(p.id, p.name);
                  setQuery(p.name);
                  setOpen(false);
                }}
              >
                <span>{p.name}</span>
                <span className={s.productPrice}>&#8377;{Number(p.price).toFixed(2)}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

const DATE_PRESETS = [
  { label: 'Today',        key: 'today' },
  { label: 'Yesterday',    key: 'yesterday' },
  { label: 'This Week',    key: 'week' },
  { label: 'This Month',   key: 'month' },
  { label: 'Custom Range', key: 'custom' },
];

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [doctors, setDoctors] = useState<{ id: number; username: string }[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [datePreset, setDatePreset] = useState<string>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [deliveredPreset, setDeliveredPreset] = useState('');
  const [deliveredFrom, setDeliveredFrom] = useState('');
  const [deliveredTo, setDeliveredTo] = useState('');
  const [followUpPreset, setFollowUpPreset] = useState('');
  const [followUpFrom, setFollowUpFrom] = useState('');
  const [followUpTo, setFollowUpTo] = useState('');
  const [reminderFilter, setReminderFilter] = useState('');
  const [showDateFilters, setShowDateFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [sortField, setSortField] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [reminderStats, setReminderStats] = useState<LeadReminderStats>({
    scheduled: 0,
    overdue: 0,
    dueToday: 0,
    upcoming: 0,
  });

  const [showInlineForm, setShowInlineForm] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [form, setForm] = useState({
    name: '', phone: '', alternatePhone: '', email: '', description: '',
    age: '', height: '', weight: '', gender: '', address: '', pinCode: '',
    trackingNumber: '', diseases: '', status: 'NEW' as LeadStatus, notes: '',
    deliveredAt: '', nextFollowUpDate: '', assignedDoctorId: '',
  });
  const [items, setItems] = useState<LeadItemForm[]>([{ productId: 0, quantity: 1, search: '', showDropdown: false }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Lead | null>(null);
  const [showColMenu, setShowColMenu] = useState(false);
  const colMenuRef = useRef<HTMLDivElement | null>(null);
  const [visibleCols, setVisibleCols] = useState({
    phone: true, altPhone: true, email: true, diseases: true,
    products: true, doctor: true, status: true, tracking: true,
    createdDate: true, deliveredDate: true, followUpDate: true,
  });
  const toggleCol = (col: keyof typeof visibleCols) =>
    setVisibleCols(p => ({ ...p, [col]: !p[col] }));

  const formatDate = (value?: string) => {
    if (!value) return '-';
    return new Date(value).toLocaleDateString('en-GB');
  };

  const formatFollowUp = (lead: Lead) => {
    if (!lead.nextFollowUpDate) return '-';

    const followUpCode: Partial<Record<LeadStatus, string>> = {
      FOLLOW_UP_1: 'F1',
      FOLLOW_UP_2: 'F2',
      FOLLOW_UP_3: 'F3',
      HTU: 'HTU',
    };

    const prefix = followUpCode[lead.status];
    const formattedDate = formatDate(lead.nextFollowUpDate);
    return prefix ? `${prefix} - ${formattedDate}` : formattedDate;
  };

  const getReminderState = (lead: Lead) => {
    if (!lead.nextFollowUpDate) return 'none';
    const followUp = new Date(lead.nextFollowUpDate);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const upcomingEnd = new Date(end);
    upcomingEnd.setDate(upcomingEnd.getDate() + 7);

    if (followUp < start) return 'overdue';
    if (followUp <= end) return 'today';
    if (followUp <= upcomingEnd) return 'upcoming';
    return 'scheduled';
  };

  useEffect(() => {
    if (!showColMenu) return;

    const handleOutsideInteraction = (event: MouseEvent | FocusEvent) => {
      const target = event.target as Node | null;
      if (!target || colMenuRef.current?.contains(target)) return;
      setShowColMenu(false);
    };

    document.addEventListener('mousedown', handleOutsideInteraction);
    document.addEventListener('focusin', handleOutsideInteraction);

    return () => {
      document.removeEventListener('mousedown', handleOutsideInteraction);
      document.removeEventListener('focusin', handleOutsideInteraction);
    };
  }, [showColMenu]);

  const fetchStats = () => {
    api.get('/leads/stats')
      .then((res) => {
        if (res.data.reminders) {
          setReminderStats(res.data.reminders);
        }
      })
      .catch(() => {});
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const fetchData = (p = page, nextPageSize = pageSize) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    if (deliveredFrom) params.set('deliveredFrom', deliveredFrom);
    if (deliveredTo) params.set('deliveredTo', deliveredTo);
    if (followUpFrom) params.set('followUpFrom', followUpFrom);
    if (followUpTo) params.set('followUpTo', followUpTo);
    if (reminderFilter) params.set('reminderStatus', reminderFilter);
    if (search) params.set('search', search);
    if (statusFilter) params.set('status', statusFilter);
    params.set('page', String(p));
    params.set('limit', String(nextPageSize));
    params.set('sortBy', sortField);
    params.set('order', sortOrder);
    const query = `?${params.toString()}`;
    api.get(`/leads${query}`)
      .then((leadsRes) => {
        setLeads(leadsRes.data.data);
        setTotalPages(leadsRes.data.meta.totalPages);
        setTotal(leadsRes.data.meta.total);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCurrentUser().then(setCurrentUser).catch(() => {});
    api.get('/users/doctors').then((res) => setDoctors(res.data)).catch(() => {});
    fetchStats();
  }, []);

  useEffect(() => {
    fetchData(page);
  }, [statusFilter, reminderFilter, dateFrom, dateTo, deliveredFrom, deliveredTo, followUpFrom, followUpTo, datePreset, deliveredPreset, followUpPreset, page, pageSize, sortField, sortOrder]);

  // Search and status filtering is now done server-side
  const filtered = leads;

  const goToPage = (p: number) => {
    setPage(p);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', phone: '', alternatePhone: '', email: '', description: '', age: '', height: '', weight: '', gender: '', address: '', pinCode: '', trackingNumber: '', diseases: '', status: 'NEW', notes: '', deliveredAt: '', nextFollowUpDate: '', assignedDoctorId: '' });
    setItems([{ productId: 0, quantity: 1, search: '', showDropdown: false }]);
    setError('');
    setShowInlineForm(true);
  };

  const cancelCreate = () => { setShowInlineForm(false); setEditing(null); setError(''); };

  const openEdit = (l: Lead) => {
    setEditing(l);
    setForm({
      name: l.name, phone: l.phone || '', alternatePhone: l.alternatePhone || '', email: l.email || '', description: l.description || '',
      age: l.age ? String(l.age) : '', height: l.height ? String(l.height) : '', weight: l.weight ? String(l.weight) : '',
      gender: l.gender || '', address: l.address || '', pinCode: l.pinCode || '',
      trackingNumber: l.trackingNumber || '', diseases: l.diseases || '', status: l.status, notes: l.notes || '',
      deliveredAt: l.deliveredAt ? l.deliveredAt.slice(0, 10) : '',
      nextFollowUpDate: l.nextFollowUpDate ? l.nextFollowUpDate.slice(0, 10) : '',
      assignedDoctorId: l.assignedDoctorId ? String(l.assignedDoctorId) : '',
    });
    setItems(l.items.length > 0 ? l.items.map((i) => ({ productId: i.productId, quantity: i.quantity, search: i.product?.name || '', showDropdown: false })) : [{ productId: 0, quantity: 1, search: '', showDropdown: false }]);
    setError('');
    setShowInlineForm(true);
  };

  const addItem = () => setItems((prev) => [...prev, { productId: 0, quantity: 1, search: '', showDropdown: false }]);
  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: string, value: any) => {
    setItems((prev) => {
      const updated = [...prev];
      (updated[idx] as any)[field] = value;
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const validItems = items.filter((i) => i.productId > 0);
    const heightNum = form.height ? Number(form.height) : undefined;
    const weightNum = form.weight ? Number(form.weight) : undefined;
    const bmi = heightNum && weightNum
      ? Math.round((weightNum / Math.pow(heightNum / 100, 2)) * 10) / 10
      : undefined;
    const payload: any = {
      name: form.name,
      phone: form.phone || undefined, alternatePhone: form.alternatePhone || undefined,
      email: form.email || undefined,
      description: form.description || undefined, age: form.age ? Number(form.age) : undefined,
      height: heightNum, weight: weightNum, bmi,
      gender: form.gender || undefined, address: form.address || undefined,
      assignedDoctorId: form.assignedDoctorId ? Number(form.assignedDoctorId) : undefined,
      pinCode: form.pinCode || undefined, trackingNumber: form.trackingNumber || undefined,
      diseases: form.diseases || undefined, status: form.status, notes: form.notes || undefined,
      deliveredAt: form.deliveredAt || undefined, nextFollowUpDate: form.nextFollowUpDate || undefined,
      items: validItems.length > 0 ? validItems : undefined,
    };
    try {
      if (editing) { await api.put(`/leads/${editing.id}`, payload); }
      else { await api.post('/leads', payload); }
      setShowInlineForm(false); setEditing(null);
      fetchData();
      fetchStats();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save lead');
    } finally { setSaving(false); }
  };

  const handleStatusChange = async (id: number, status: LeadStatus) => {
    await api.patch(`/leads/${id}/status`, { status });
    fetchData();
    fetchStats();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await api.delete(`/leads/${deleteTarget.id}`);
    setDeleteTarget(null);
    fetchData();
    fetchStats();
  };

  const handlePreset = (key: string) => {
    const today = new Date();
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    setDatePreset(key);
    if (!key) { setDateFrom(''); setDateTo(''); }
    else if (key === 'today') { const d = fmt(today); setDateFrom(d); setDateTo(d); }
    else if (key === 'yesterday') { const d = fmt(new Date(Date.now() - 86400000)); setDateFrom(d); setDateTo(d); }
    else if (key === 'week') { const start = new Date(today); start.setDate(today.getDate() - today.getDay()); const from = fmt(start); const to = fmt(today); setDateFrom(from); setDateTo(to); }
    else if (key === 'month') { const from = fmt(new Date(today.getFullYear(), today.getMonth(), 1)); const to = fmt(today); setDateFrom(from); setDateTo(to); }
    else { setDateFrom(''); setDateTo(''); }
  };

  const handleDeliveredPreset = (key: string) => {
    const today = new Date();
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    setDeliveredPreset(key);
    if (!key) { setDeliveredFrom(''); setDeliveredTo(''); }
    else if (key === 'today') { const d = fmt(today); setDeliveredFrom(d); setDeliveredTo(d); }
    else if (key === 'yesterday') { const d = fmt(new Date(Date.now() - 86400000)); setDeliveredFrom(d); setDeliveredTo(d); }
    else if (key === 'week') { const start = new Date(today); start.setDate(today.getDate() - today.getDay()); const from = fmt(start); const to = fmt(today); setDeliveredFrom(from); setDeliveredTo(to); }
    else if (key === 'month') { const from = fmt(new Date(today.getFullYear(), today.getMonth(), 1)); const to = fmt(today); setDeliveredFrom(from); setDeliveredTo(to); }
    else { setDeliveredFrom(''); setDeliveredTo(''); }
  };

  const handleFollowUpPreset = (key: string) => {
    const today = new Date();
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    setFollowUpPreset(key);
    if (!key) { setFollowUpFrom(''); setFollowUpTo(''); }
    else if (key === 'today') { const d = fmt(today); setFollowUpFrom(d); setFollowUpTo(d); }
    else if (key === 'yesterday') { const d = fmt(new Date(Date.now() - 86400000)); setFollowUpFrom(d); setFollowUpTo(d); }
    else if (key === 'week') { const start = new Date(today); start.setDate(today.getDate() - today.getDay()); const from = fmt(start); const to = fmt(today); setFollowUpFrom(from); setFollowUpTo(to); }
    else if (key === 'month') { const from = fmt(new Date(today.getFullYear(), today.getMonth(), 1)); const to = fmt(today); setFollowUpFrom(from); setFollowUpTo(to); }
    else { setFollowUpFrom(''); setFollowUpTo(''); }
  };

  const handleExport = async () => {
    if (currentUser && currentUser.role !== 'SUPER_ADMIN' && !currentUser.canExportLeads) return;
    // Fetch all leads (no pagination) for export
    const params = new URLSearchParams();
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    if (deliveredFrom) params.set('deliveredFrom', deliveredFrom);
    if (deliveredTo) params.set('deliveredTo', deliveredTo);
    if (followUpFrom) params.set('followUpFrom', followUpFrom);
    if (followUpTo) params.set('followUpTo', followUpTo);
    if (search) params.set('search', search);
    if (statusFilter) params.set('status', statusFilter);
    params.set('limit', '10000');
    const res = await api.get(`/leads?${params.toString()}`);
    const allLeads: Lead[] = res.data.data;
    const rows = allLeads.map((l) => ({
      ID: l.id,
      Name: l.name,
      Phone: l.phone || '',
      Email: l.email || '',
      Status: STATUS_LABELS[l.status] || l.status,
      Age: l.age || '',
      Gender: l.gender || '',
      Address: l.address || '',
      'Pin Code': l.pinCode || '',
      Diseases: l.diseases || '',
      'Tracking Number': l.trackingNumber || '',
      'Delivered At': l.deliveredAt ? l.deliveredAt.slice(0, 10) : '',
      'Next Follow-Up': l.nextFollowUpDate ? l.nextFollowUpDate.slice(0, 10) : '',
      Products: l.items.map((i) => `${i.product?.name || i.productId} x${i.quantity}`).join(', '),
      Notes: l.notes || '',
      'Created At': new Date(l.createdAt).toLocaleDateString(),
    }));
    exportToExcel(rows, `leads_${new Date().toISOString().slice(0, 10)}`);
  };

  const hasActiveDateFilters = Boolean(
    reminderFilter || datePreset || deliveredPreset || followUpPreset
    || dateFrom || dateTo || deliveredFrom || deliveredTo || followUpFrom || followUpTo,
  );

  const LeadForm = () => (
    <form onSubmit={handleSubmit} className={s.inlineForm}>
      <h2 className={s.inlineFormTitle}>{editing ? 'Edit Lead' : 'New Lead'}</h2>
      {error && <div className={s.error}>{error}</div>}
      <div className={s.grid2}>
        <div className={s.formGroup}><label>Name *</label><input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={s.formInput} /></div>
        <div className={s.formGroup}><label>Phone</label><input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={s.formInput} /></div>
      </div>
      <div className={s.grid2}>
        <div className={s.formGroup}><label>Alternate Number</label><input type="tel" value={form.alternatePhone} onChange={(e) => setForm({ ...form, alternatePhone: e.target.value })} className={s.formInput} placeholder="Optional" /></div>
        <div className={s.formGroup}><label>Assign Doctor</label>
          <CustomSelect
            options={[{ label: 'No doctor assigned', value: '' }, ...doctors.map((d) => ({ label: `Dr. ${d.username}`, value: d.id }))]}
            value={form.assignedDoctorId}
            onChange={(val) => setForm({ ...form, assignedDoctorId: String(val) })}
            align="left"
            minWidth="100%"
          />
        </div>
      </div>
      <div className={s.grid2}>
        <div className={s.formGroup}><label>Email</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={s.formInput} /></div>
        <div className={s.formGroup}><label>Description</label><input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={s.formInput} placeholder="Inquiry details..." /></div>
      </div>
      <div className={s.grid3}>
        <div className={s.formGroup}><label>Age</label><input type="number" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} className={s.formInput} /></div>
        <div className={s.formGroup}><label>Gender</label>
          <CustomSelect
            options={[{ label: 'Select...', value: '' }, { label: 'Male', value: 'Male' }, { label: 'Female', value: 'Female' }, { label: 'Other', value: 'Other' }]}
            value={form.gender}
            onChange={(val) => setForm({ ...form, gender: String(val) })}
            align="left"
            minWidth="100%"
          />
        </div>
        <div className={s.formGroup}><label>Pin Code</label><input type="text" value={form.pinCode} onChange={(e) => setForm({ ...form, pinCode: e.target.value })} className={s.formInput} /></div>
      </div>
      <div className={s.grid3}>
        <div className={s.formGroup}><label>Height (cm)</label><input type="number" min={1} step="0.1" value={form.height} onChange={(e) => setForm({ ...form, height: e.target.value })} className={s.formInput} placeholder="e.g. 170" /></div>
        <div className={s.formGroup}><label>Weight (kg)</label><input type="number" min={1} step="0.1" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} className={s.formInput} placeholder="e.g. 70" /></div>
        <div className={s.formGroup}>
          <label>BMI</label>
          {(() => {
            const h = Number(form.height), w = Number(form.weight);
            if (!h || !w) return <div className={s.bmiEmpty}>Enter height & weight</div>;
            const bmi = Math.round((w / Math.pow(h / 100, 2)) * 10) / 10;
            const { label, cls } = bmi < 18.5 ? { label: 'Underweight', cls: s.bmiUnderweight }
              : bmi < 25 ? { label: 'Normal', cls: s.bmiNormal }
              : bmi < 30 ? { label: 'Overweight', cls: s.bmiOverweight }
              : { label: 'Obese', cls: s.bmiObese };
            return <div className={`${s.bmiResult} ${cls}`}>{bmi} <span className={s.bmiLabel}>{label}</span></div>;
          })()}
        </div>
      </div>
      <div className={s.formGroup}><label>Address</label><textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} className={s.formTextarea} /></div>
      <div className={s.formGroup}><label>Diseases</label><textarea value={form.diseases} onChange={(e) => setForm({ ...form, diseases: e.target.value })} rows={2} className={s.formTextarea} /></div>
      <div className={s.grid2}>
        <div className={s.formGroup}><label>Tracking Number</label><input type="text" value={form.trackingNumber} onChange={(e) => setForm({ ...form, trackingNumber: e.target.value })} className={s.formInput} /></div>
        <div className={s.formGroup}><label>Status</label>
          <CustomSelect
            options={statuses.map((st) => ({ label: STATUS_LABELS[st], value: st }))}
            value={form.status}
            onChange={(val) => setForm({ ...form, status: val as LeadStatus })}
            align="left"
            minWidth="100%"
          />
        </div>
      </div>
      <div className={s.grid2}>
        <div className={s.formGroup}><label>Delivered At</label><input type="date" value={form.deliveredAt} onChange={(e) => setForm({ ...form, deliveredAt: e.target.value })} className={s.formInput} /></div>
        <div className={s.formGroup}><label>Next Follow-Up Date</label><input type="date" value={form.nextFollowUpDate} onChange={(e) => setForm({ ...form, nextFollowUpDate: e.target.value })} className={s.formInput} /></div>
      </div>
      <div>
        <div className={s.itemsHeader}>
          <label>Medicines / Products</label>
          <button type="button" onClick={addItem} className={s.addItemBtn}>+ Add Item</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {items.map((item, idx) => (
            <div key={idx} className={s.itemRow}>
              <LeadProductSearch
                value={item.productId}
                displayName={item.search}
                onSelect={(id, name) => {
                  updateItem(idx, 'productId', id);
                  updateItem(idx, 'search', name);
                }}
              />
              <input type="number" min={1} value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', Number(e.target.value))} className={s.itemQty} placeholder="Qty" />
              {items.length > 1 && <button type="button" onClick={() => removeItem(idx)} className={s.removeItemBtn}>✕</button>}
            </div>
          ))}
        </div>
      </div>
      <div className={s.formGroup}><label>Notes</label><input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={s.formInput} /></div>
      <div className={s.formActions}>
        <button type="button" onClick={cancelCreate} className={s.cancelBtn}>Cancel</button>
        <button type="submit" disabled={saving} className={s.saveBtn}>{saving ? 'Saving...' : editing ? 'Update' : 'Create'}</button>
      </div>
    </form>
  );

  return (
    <div className={s.page}>
      <div className={s.header}>
        <h1 className={s.pageTitle}>Leads</h1>
        <div className={s.headerActions}>
          {(currentUser?.role === 'SUPER_ADMIN' || currentUser?.canExportLeads) && (
            <button onClick={handleExport} className={s.exportBtn}>↓ Export Excel</button>
          )}
          <button onClick={openCreate} className={s.addBtn}>+ Add Lead</button>
        </div>
      </div>

      <div className={s.reminderCards}>
        <button type="button" onClick={() => { setReminderFilter('overdue'); setPage(1); }} className={`${s.reminderCard} ${reminderFilter === 'overdue' ? s.reminderCardActive : ''}`}>
          <span className={s.reminderLabel}>Overdue</span>
          <strong className={s.reminderValue}>{reminderStats.overdue}</strong>
        </button>
        <button type="button" onClick={() => { setReminderFilter('today'); setPage(1); }} className={`${s.reminderCard} ${reminderFilter === 'today' ? s.reminderCardActive : ''}`}>
          <span className={s.reminderLabel}>Due Today</span>
          <strong className={s.reminderValue}>{reminderStats.dueToday}</strong>
        </button>
        <button type="button" onClick={() => { setReminderFilter('upcoming'); setPage(1); }} className={`${s.reminderCard} ${reminderFilter === 'upcoming' ? s.reminderCardActive : ''}`}>
          <span className={s.reminderLabel}>Next 7 Days</span>
          <strong className={s.reminderValue}>{reminderStats.upcoming}</strong>
        </button>
        <button type="button" onClick={() => { setReminderFilter(''); setPage(1); }} className={`${s.reminderCard} ${!reminderFilter ? s.reminderCardActive : ''}`}>
          <span className={s.reminderLabel}>All Scheduled</span>
          <strong className={s.reminderValue}>{reminderStats.scheduled}</strong>
        </button>
      </div>

      <div className={`${s.filterPanel} ${showDateFilters || hasActiveDateFilters ? s.filterPanelExpanded : ''}`}>
        <div className={s.filterRow}>
          <div className={s.searchWrapper}>
            <input type="text" placeholder="Search by name, phone, or disease..." value={search} onChange={(e) => { setSearch(e.target.value); }} onKeyDown={(e) => { if (e.key === 'Enter') { if (page === 1) fetchData(1); else setPage(1); } }} className={s.searchInput} />
            {search && (
              <button type="button" className={s.searchClear} onClick={() => { setSearch(''); if (page === 1) fetchData(1); else setPage(1); }}>✕</button>
            )}
          </div>
          <button onClick={() => { if (page === 1) fetchData(1); else setPage(1); }} className={s.searchBtn}>Search</button>
          <button
            type="button"
            onClick={() => setShowDateFilters((prev) => !prev)}
            className={`${s.moreFiltersBtn} ${showDateFilters || hasActiveDateFilters ? s.moreFiltersBtnActive : ''}`}
          >
            Date Filters
            <span className={s.moreFiltersMeta}>
              {hasActiveDateFilters ? 'Active' : showDateFilters ? 'Hide' : 'Show'}
            </span>
          </button>
          <CustomSelect
            options={[{ label: 'All Statuses', value: '' }, ...statuses.map((st) => ({ label: STATUS_LABELS[st], value: st }))]}
            value={statusFilter}
            onChange={(val) => { setStatusFilter(String(val)); setPage(1); }}
            align="left"
            minWidth="11rem"
          />
          <CustomSelect
            options={[{ label: 'Created: All', value: '' }, ...DATE_PRESETS.map(({ label, key }) => ({ label, value: key }))]}
            value={datePreset}
            onChange={(val) => handlePreset(String(val))}
            align="left"
            minWidth="10rem"
          />
          <CustomSelect
            options={[{ label: 'Delivered: All', value: '' }, ...DATE_PRESETS.map(({ label, key }) => ({ label, value: key }))]}
            value={deliveredPreset}
            onChange={(val) => handleDeliveredPreset(String(val))}
            align="left"
            minWidth="10rem"
          />
          <CustomSelect
            options={[{ label: 'Follow-Up: All', value: '' }, ...DATE_PRESETS.map(({ label, key }) => ({ label, value: key }))]}
            value={followUpPreset}
            onChange={(val) => handleFollowUpPreset(String(val))}
            align="left"
            minWidth="10rem"
          />
          <CustomSelect
            options={[
              { label: 'Reminder: All', value: '' },
              { label: 'Overdue', value: 'overdue' },
              { label: 'Due Today', value: 'today' },
              { label: 'Next 7 Days', value: 'upcoming' },
              { label: 'Scheduled', value: 'scheduled' },
              { label: 'No Follow-Up', value: 'none' },
            ]}
            value={reminderFilter}
            onChange={(val) => { setReminderFilter(String(val)); setPage(1); }}
            align="left"
            minWidth="10rem"
          />
          <div className={s.colMenuWrap}>
            <button
              onClick={() => setShowColMenu((p) => !p)}
              className={`${s.colMenuBtn} ${showColMenu ? s.colMenuBtnActive : ''}`}
              title="Toggle columns"
              type="button"
            >
              âŠž Columns
            </button>
            {showColMenu && (
              <div className={s.colMenu}>
                {([
                  ['phone', 'Phone'],
                  ['altPhone', 'Alt. Number'],
                  ['email', 'Email'],
                  ['diseases', 'Diseases'],
                  ['products', 'Products'],
                  ['doctor', 'Doctor'],
                  ['status', 'Status'],
                  ['tracking', 'Tracking'],
                ] as [keyof typeof visibleCols, string][]).map(([key, label]) => (
                  <label key={key} className={s.colMenuItem}>
                    <input type="checkbox" checked={visibleCols[key]} onChange={() => toggleCol(key)} />
                    {label}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {showDateFilters && (
          <div className={s.dateFilterRow}>
            <CustomSelect
              options={[{ label: 'Created: All', value: '' }, ...DATE_PRESETS.map(({ label, key }) => ({ label, value: key }))]}
              value={datePreset}
              onChange={(val) => handlePreset(String(val))}
              align="left"
              minWidth="10rem"
            />
            <CustomSelect
              options={[{ label: 'Delivered: All', value: '' }, ...DATE_PRESETS.map(({ label, key }) => ({ label, value: key }))]}
              value={deliveredPreset}
              onChange={(val) => handleDeliveredPreset(String(val))}
              align="left"
              minWidth="10rem"
            />
            <CustomSelect
              options={[{ label: 'Follow-Up: All', value: '' }, ...DATE_PRESETS.map(({ label, key }) => ({ label, value: key }))]}
              value={followUpPreset}
              onChange={(val) => handleFollowUpPreset(String(val))}
              align="left"
              minWidth="10rem"
            />
          </div>
        )}

        {/* Custom date range pickers */}
        {showDateFilters && (datePreset === 'custom' || deliveredPreset === 'custom' || followUpPreset === 'custom') && (
          <>
            {datePreset === 'custom' && (
              <div className={s.filterRow}>
                <span className={s.filterLabel}>Created</span>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={s.dateInput} />
                <span className={s.sep}>—</span>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={s.dateInput} />
                <button onClick={() => fetchData()} disabled={!dateFrom && !dateTo} className={s.applyBtn}>Apply</button>
              </div>
            )}
            {deliveredPreset === 'custom' && (
              <div className={s.filterRow}>
                <span className={s.filterLabel}>Delivered</span>
                <input type="date" value={deliveredFrom} onChange={(e) => setDeliveredFrom(e.target.value)} className={s.dateInput} />
                <span className={s.sep}>—</span>
                <input type="date" value={deliveredTo} onChange={(e) => setDeliveredTo(e.target.value)} className={s.dateInput} />
                <button onClick={() => fetchData()} disabled={!deliveredFrom && !deliveredTo} className={s.applyBtn}>Apply</button>
              </div>
            )}
            {followUpPreset === 'custom' && (
              <div className={s.filterRow}>
                <span className={s.filterLabel}>Follow-Up</span>
                <input type="date" value={followUpFrom} onChange={(e) => setFollowUpFrom(e.target.value)} className={s.dateInput} />
                <span className={s.sep}>—</span>
                <input type="date" value={followUpTo} onChange={(e) => setFollowUpTo(e.target.value)} className={s.dateInput} />
                <button onClick={() => fetchData()} disabled={!followUpFrom && !followUpTo} className={s.applyBtn}>Apply</button>
              </div>
            )}
          </>
        )}
      </div>

      {showInlineForm && (
        <div className={s.inlineFormWrap}>
          {LeadForm()}
        </div>
      )}

      {!showInlineForm && (loading ? (
        <div className={s.skeletonList}>
          {[...Array(5)].map((_, i) => <div key={i} className={s.skeletonRow} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className={s.emptyBox}>
          <div className={s.emptyText}>No leads found</div>
        </div>
      ) : (
        <div className={s.tableWrap}>
          <div className={s.mobileList}>
            {filtered.map((l) => {
              const reminderState = getReminderState(l);
              return (
                <article key={`mobile-${l.id}`} className={`${s.mobileCard} ${reminderState === 'overdue' ? s.rowOverdue : reminderState === 'today' ? s.rowDueToday : ''}`}>
                  <div className={s.mobileCardTop}>
                    <div className={s.mobileCardHeader}>
                      <div>
                        <p className={s.leadName}>{l.name}</p>
                        {l.description && <p className={s.leadDesc}>{l.description}</p>}
                      </div>
                      <select
                        value={l.status}
                        onChange={(e) => handleStatusChange(l.id, e.target.value as LeadStatus)}
                        className={`${s.statusSelect} ${statusCls(l.status)}`}
                      >
                        {statuses.map((st) => <option key={st} value={st}>{STATUS_LABELS[st]}</option>)}
                      </select>
                    </div>

                    <div className={s.mobileBadgeRow}>
                      {reminderState !== 'none' && (
                        <span className={`${s.reminderBadge} ${reminderState === 'overdue' ? s.reminderBadgeOverdue : reminderState === 'today' ? s.reminderBadgeToday : s.reminderBadgeUpcoming}`}>
                          {reminderState === 'overdue' ? 'Overdue' : reminderState === 'today' ? 'Today' : reminderState === 'upcoming' ? 'Soon' : 'Scheduled'}
                        </span>
                      )}
                      {l.assignedDoctor && <span className={s.mobileDoctor}>Dr. {l.assignedDoctor.username}</span>}
                    </div>
                  </div>

                  <div className={s.mobileMetaGrid}>
                    <div className={s.mobileMetaItem}>
                      <span className={s.mobileMetaLabel}>Phone</span>
                      <span className={s.cellText}>{l.phone || '-'}</span>
                    </div>
                    <div className={s.mobileMetaItem}>
                      <span className={s.mobileMetaLabel}>Email</span>
                      <span className={s.cellText}>{l.email || '-'}</span>
                    </div>
                    <div className={s.mobileMetaItem}>
                      <span className={s.mobileMetaLabel}>Products</span>
                      <span className={s.cellText}>{l.items?.length || 0} items</span>
                    </div>
                    <div className={s.mobileMetaItem}>
                      <span className={s.mobileMetaLabel}>Follow-Up</span>
                      <span className={s.cellText}>{formatFollowUp(l)}</span>
                    </div>
                  </div>

                  <div className={s.mobileMetaGrid}>
                    <div className={s.mobileMetaItem}>
                      <span className={s.mobileMetaLabel}>Created</span>
                      <span className={s.cellText}>{formatDate(l.createdAt)}</span>
                    </div>
                    <div className={s.mobileMetaItem}>
                      <span className={s.mobileMetaLabel}>Delivered</span>
                      <span className={s.cellText}>{formatDate(l.deliveredAt)}</span>
                    </div>
                  </div>

                  <div className={s.mobileNotes}>
                    <span className={s.mobileMetaLabel}>Diseases / Tracking</span>
                    <span className={s.cellText}>
                      {l.diseases || '-'}
                      {l.trackingNumber ? ` • ${l.trackingNumber}` : ''}
                    </span>
                  </div>

                  <div className={s.mobileActions}>
                    <button onClick={() => openEdit(l)} className={s.mobileEditBtn}>Edit</button>
                    <button onClick={() => setDeleteTarget(l)} className={s.mobileDeleteBtn}>Delete</button>
                  </div>
                </article>
              );
            })}
          </div>

          <div className={s.tableToolbar}>
            <div ref={colMenuRef} className={s.colMenuWrap}>
              <button
                onClick={() => setShowColMenu((p) => !p)}
                className={`${s.colMenuBtn} ${showColMenu ? s.colMenuBtnActive : ''}`}
                title="Toggle columns"
                type="button"
              >
                ⊞ Columns
              </button>
              {showColMenu && (
                <div className={s.colMenu}>
                {([
                    ['phone',    'Phone'],
                    ['altPhone', 'Alt. Number'],
                    ['email',    'Email'],
                    ['diseases', 'Diseases'],
                    ['products', 'Products'],
                    ['doctor',   'Doctor'],
                    ['createdDate', 'Created Date'],
                    ['deliveredDate', 'Delivered Date'],
                    ['followUpDate', 'Follow-Up'],
                    ['status',   'Status'],
                    ['tracking', 'Tracking'],
                  ] as [keyof typeof visibleCols, string][]).map(([key, label]) => (
                    <label key={key} className={s.colMenuItem}>
                      <input type="checkbox" checked={visibleCols[key]} onChange={() => toggleCol(key)} />
                      {label}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
          <table className={s.table}>
            <thead className={s.thead}>
              <tr>
                <th className={`${s.th} ${s.thSortable}`} onClick={() => handleSort('name')}>Name{sortField === 'name' ? (sortOrder === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</th>
                {visibleCols.phone    && <th className={s.th}>Phone</th>}
                {visibleCols.altPhone && <th className={s.th}>Alt. Number</th>}
                {visibleCols.email    && <th className={s.th}>Email</th>}
                {visibleCols.diseases && <th className={s.th}>Diseases</th>}
                {visibleCols.products && <th className={s.th}>Products</th>}
                {visibleCols.doctor   && <th className={s.th}>Doctor</th>}
                {visibleCols.createdDate && <th className={`${s.th} ${s.thSortable}`} onClick={() => handleSort('createdAt')}>Created Date{sortField === 'createdAt' ? (sortOrder === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</th>}
                {visibleCols.deliveredDate && <th className={`${s.th} ${s.thSortable}`} onClick={() => handleSort('deliveredAt')}>Delivered Date{sortField === 'deliveredAt' ? (sortOrder === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</th>}
                {visibleCols.followUpDate && <th className={`${s.th} ${s.thSortable}`} onClick={() => handleSort('nextFollowUpDate')}>Follow-Up{sortField === 'nextFollowUpDate' ? (sortOrder === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</th>}
                {visibleCols.status   && <th className={`${s.th} ${s.thSortable}`} onClick={() => handleSort('status')}>Status{sortField === 'status' ? (sortOrder === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</th>}
                {visibleCols.tracking && <th className={s.th}>Tracking</th>}
                <th className={`${s.th} ${s.thRight}`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => {
                const reminderState = getReminderState(l);
                return (
                <tr key={l.id} className={`${s.tr} ${reminderState === 'overdue' ? s.rowOverdue : reminderState === 'today' ? s.rowDueToday : ''}`}>
                  <td className={s.td}>
                    <p className={s.leadName}>{l.name}</p>
                    {l.description && <p className={s.leadDesc}>{l.description}</p>}
                  </td>
                  {visibleCols.phone    && <td className={s.td}><span className={s.cellText}>{l.phone || '-'}</span></td>}
                  {visibleCols.altPhone && <td className={s.td}><span className={s.cellText}>{l.alternatePhone || '-'}</span></td>}
                  {visibleCols.email    && <td className={s.td}><span className={s.cellText}>{l.email || '-'}</span></td>}
                  {visibleCols.diseases && <td className={s.td}><span className={s.cellText}>{l.diseases || '-'}</span></td>}
                  {visibleCols.products && <td className={s.td}><span className={s.cellText}>{l.items?.length || 0} items</span></td>}
                  {visibleCols.doctor   && <td className={s.td}><span className={s.cellText}>{l.assignedDoctor ? `Dr. ${l.assignedDoctor.username}` : '-'}</span></td>}
                  {visibleCols.createdDate && <td className={s.td}><span className={s.cellText}>{formatDate(l.createdAt)}</span></td>}
                  {visibleCols.deliveredDate && <td className={s.td}><span className={s.cellText}>{formatDate(l.deliveredAt)}</span></td>}
                  {visibleCols.followUpDate && <td className={s.td}>
                    <div className={s.followUpCell}>
                      <span className={s.cellText}>{formatFollowUp(l)}</span>
                      {reminderState !== 'none' && (
                        <span className={`${s.reminderBadge} ${reminderState === 'overdue' ? s.reminderBadgeOverdue : reminderState === 'today' ? s.reminderBadgeToday : s.reminderBadgeUpcoming}`}>
                          {reminderState === 'overdue' ? 'Overdue' : reminderState === 'today' ? 'Today' : reminderState === 'upcoming' ? 'Soon' : 'Scheduled'}
                        </span>
                      )}
                    </div>
                  </td>}
                  {visibleCols.status   && <td className={s.td}>
                    <select value={l.status} onChange={(e) => handleStatusChange(l.id, e.target.value as LeadStatus)}
                      className={`${s.statusSelect} ${statusCls(l.status)}`}>
                      {statuses.map((st) => <option key={st} value={st}>{STATUS_LABELS[st]}</option>)}
                    </select>
                  </td>}
                  {visibleCols.tracking && <td className={s.td}><span className={s.tracking}>{l.trackingNumber || '-'}</span></td>}
                  <td className={`${s.td} ${s.tdRight}`}>
                    <button onClick={() => openEdit(l)} className={s.editBtn}>Edit</button>
                    <button onClick={() => setDeleteTarget(l)} className={s.deleteBtn}>Delete</button>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>

          {/* Pagination */}
          <div className={s.pagination}>
            <button
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1}
              className={s.pageBtn}
            >
              ← Prev
            </button>
            <span className={s.pageInfo}>
              Page {page} of {totalPages} ({total} leads)
            </span>
            <button
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages}
              className={s.pageBtn}
            >
              Next →
            </button>
            <CustomSelect
              options={[10, 20, 30, 50].map((n) => ({ label: `${n} / page`, value: n }))}
              value={pageSize}
              onChange={(val) => {
                const next = Number(val);
                setPageSize(next);
                setPage(1);
                fetchData(1, next);
              }}
              align="right"
              direction="up"
            />
          </div>
        </div>
      ))}

      {deleteTarget && (
        <div className={s.overlay}>
          <div className={s.deleteModal}>
            <h3 className={s.deleteTitle}>Delete Lead</h3>
            <p className={s.deleteMsg}>Are you sure you want to delete &ldquo;{deleteTarget.name}&rdquo;? This cannot be undone.</p>
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
