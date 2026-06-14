'use client';

import { useEffect, useRef, useState, type FC } from 'react';
import api from '@/lib/api';
import { fetchCurrentUser } from '@/lib/current-user';
import { exportToExcel } from '@/lib/exportExcel';
import { generateOrderInvoice } from '@/lib/generateOrderInvoice';
import { Lead, Product, LeadStatus, LeadReminderStats, User } from '@/types';
import { CustomSelect } from '@/components/ui/CustomSelect';
import s from './leads.module.scss';

type IconCmp = FC<{ size?: number; color?: string }>;
const svgProps = (size: number, color: string) => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color,
  strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  'aria-hidden': true,
});
const IconPackage: IconCmp = ({ size = 20, color = 'currentColor' }) => (
  <svg {...svgProps(size, color)}><path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><path d="M3.3 7 12 12l8.7-5" /><path d="M12 22V12" /></svg>
);
const IconTruck: IconCmp = ({ size = 20, color = 'currentColor' }) => (
  <svg {...svgProps(size, color)}><path d="M3 6h11v9H3z" /><path d="M14 9h4l3 3v3h-7z" /><circle cx="7.5" cy="18" r="1.6" /><circle cx="17.5" cy="18" r="1.6" /></svg>
);
const IconClock: IconCmp = ({ size = 20, color = 'currentColor' }) => (
  <svg {...svgProps(size, color)}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
);
const IconPin: IconCmp = ({ size = 20, color = 'currentColor' }) => (
  <svg {...svgProps(size, color)}><path d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>
);
const IconCheck: IconCmp = ({ size = 20, color = 'currentColor' }) => (
  <svg {...svgProps(size, color)}><path d="M4 12l5 5 11-12" /></svg>
);
const IconAlert: IconCmp = ({ size = 20, color = 'currentColor' }) => (
  <svg {...svgProps(size, color)}><path d="M12 3 2 20h20L12 3z" /><path d="M12 10v4" /><path d="M12 17h.01" /></svg>
);

type TrackTheme = { color: string; soft: string; border: string; ring: string; Icon: IconCmp };
function trackTheme(status?: string): TrackTheme {
  const v = (status || '').toLowerCase();
  if (/out for delivery|ofd/.test(v))
    return { color: '#a78bfa', soft: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.30)', ring: 'rgba(139,92,246,0.22)', Icon: IconTruck };
  if (/deliver/.test(v))
    return { color: '#34d399', soft: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.30)', ring: 'rgba(16,185,129,0.22)', Icon: IconCheck };
  if (/rto|cancel|return|undeliver|fail|lost|exception|hold/.test(v))
    return { color: '#f87171', soft: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.30)', ring: 'rgba(239,68,68,0.22)', Icon: IconAlert };
  if (/pending|booked|manifest|pickup|awaiting|not pick|created/.test(v))
    return { color: '#fbbf24', soft: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.30)', ring: 'rgba(245,158,11,0.22)', Icon: IconClock };
  return { color: '#60a5fa', soft: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.30)', ring: 'rgba(59,130,246,0.22)', Icon: IconTruck };
}

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
    const leadItems = l.items ?? [];
    setItems(leadItems.length > 0 ? leadItems.map((i) => ({ productId: i.productId, quantity: i.quantity, search: i.product?.name || '', showDropdown: false })) : [{ productId: 0, quantity: 1, search: '', showDropdown: false }]);
    setError('');
    setShowInlineForm(true);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
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
      items: validItems.length > 0 ? validItems.map((i) => ({ productId: i.productId, quantity: i.quantity })) : undefined,
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

  // Regenerate the tax invoice for a lead's order. Reuses the same
  // generator as website orders so the PDF matches the originals.
  const downloadInvoice = (l: Lead) => {
    const items = (l.items || [])
      .filter((i) => i.product)
      .map((i) => ({
        name: i.product!.name,
        qty: i.quantity,
        unitPrice: Number(i.product!.price),
      }));

    if (items.length === 0) {
      setError(`"${l.name}" has no products, so an invoice can't be generated.`);
      return;
    }

    // Prefer an invoice number already recorded in notes (e.g. NNH-2026-001);
    // otherwise derive one from the order year and lead id.
    const date = l.deliveredAt || l.createdAt;
    const year = new Date(date).getFullYear();
    const fromNotes = l.notes?.match(/NNH-\d{4}-\d+/i)?.[0];
    const invoiceNumber = fromNotes || `NNH-${year}-${String(l.id).padStart(3, '0')}`;

    const address = [l.address, l.pinCode].filter(Boolean).join(' – ');
    const totalAmount = items.reduce((sum, it) => sum + it.unitPrice * it.qty, 0);

    generateOrderInvoice({
      invoiceNumber,
      date,
      customerName: l.name,
      customerPhone: [l.phone, l.alternatePhone].filter(Boolean).join(' / ') || undefined,
      customerEmail: l.email,
      address: address || undefined,
      paymentMethod: 'COD',
      items,
      totalAmount,
    });
  };

  // ── Shipment tracking (Shipmozo) ───────────────────────────────
  interface TrackState {
    open: boolean; loading: boolean; error: string;
    awb: string; name: string;
    data: {
      currentStatus?: string; courier?: string; expectedDeliveryDate?: string | null;
      scans?: Record<string, unknown>[];
    } | null;
  }
  const [track, setTrack] = useState<TrackState>({
    open: false, loading: false, error: '', awb: '', name: '', data: null,
  });
  const closeTrack = () => setTrack((t) => ({ ...t, open: false }));
  const openTrack = async (l: Lead) => {
    const awb = (l.trackingNumber || '').trim();
    if (!awb) return;
    setTrack({ open: true, loading: true, error: '', awb, name: l.name, data: null });
    try {
      const res = await api.get('/shipping/track', { params: { awb } });
      setTrack((t) => ({ ...t, loading: false, data: res.data }));
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Could not fetch tracking status. Check the AWB number and Shipmozo keys.';
      setTrack((t) => ({ ...t, loading: false, error: msg }));
    }
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
                    {l.items?.length > 0 && (
                      <button onClick={() => downloadInvoice(l)} className={s.mobileInvoiceBtn}>↓ Invoice</button>
                    )}
                    {l.trackingNumber && (
                      <button onClick={() => openTrack(l)} className={s.mobileEditBtn}>Track</button>
                    )}
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
                    {l.items?.length > 0 && (
                      <button onClick={() => downloadInvoice(l)} className={s.invoiceBtn}>Invoice</button>
                    )}
                    {l.trackingNumber && (
                      <button onClick={() => openTrack(l)} className={s.editBtn}>Track</button>
                    )}
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

      {track.open && (
        <div className={s.overlay} onClick={closeTrack}>
          <div
            className={s.deleteModal}
            style={{ maxWidth: '30rem', width: '100%', padding: 0, overflow: 'hidden' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '1.05rem 1.2rem', display: 'flex', alignItems: 'center', gap: '11px', borderBottom: '0.5px solid var(--shell-border)' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'var(--shell-soft-bg, rgba(255,255,255,0.05))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--shell-text-secondary)' }}>
                <IconPackage size={19} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--shell-text-primary)' }}>Shipment tracking</p>
                <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--shell-text-subtle)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {track.name} &middot;{' '}
                  <span style={{ fontFamily: 'ui-monospace, monospace', letterSpacing: '0.02em' }}>{track.awb}</span>
                </p>
              </div>
              <button onClick={closeTrack} aria-label="Close" style={{ background: 'none', border: 'none', color: 'var(--shell-text-subtle)', cursor: 'pointer', fontSize: '1.35rem', lineHeight: 1, padding: '0.15rem 0.35rem' }}>&times;</button>
            </div>

            <div style={{ padding: '1.1rem 1.2rem 0.4rem', maxHeight: '26rem', overflowY: 'auto' }}>
              {track.loading && (
                <p style={{ textAlign: 'center', color: 'var(--shell-text-secondary)', fontSize: '0.85rem', padding: '1.5rem 0', margin: 0 }}>Fetching status&hellip;</p>
              )}
              {track.error && <div className={s.error}>{track.error}</div>}

              {track.data && (() => {
                const d = track.data!;
                const th = trackTheme(d.currentStatus);
                const scans = Array.isArray(d.scans) ? d.scans : [];
                const latest = (scans[0] || {}) as Record<string, unknown>;
                const latestLoc = String(latest.location ?? latest.city ?? '');
                return (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '13px', padding: '1rem 1.1rem', borderRadius: '14px', background: th.soft, border: `0.5px solid ${th.border}` }}>
                      <div style={{ width: '46px', height: '46px', borderRadius: '50%', background: th.ring, color: th.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <th.Icon size={24} color={th.color} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: th.color }}>{d.currentStatus || 'Unknown'}</p>
                        {latestLoc && (
                          <p style={{ margin: '3px 0 0', fontSize: '0.75rem', color: 'var(--shell-text-subtle)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{latestLoc}</p>
                        )}
                      </div>
                    </div>

                    {(d.expectedDeliveryDate || d.courier) && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px', padding: '8px 12px', borderRadius: '10px', background: 'var(--shell-soft-bg, rgba(255,255,255,0.03))', fontSize: '0.78rem', color: 'var(--shell-text-secondary)' }}>
                        {d.courier && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}><IconTruck size={14} />{d.courier}</span>
                        )}
                        {d.expectedDeliveryDate && (
                          <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <IconClock size={14} />ETA{' '}
                            <span style={{ color: 'var(--shell-text-primary)', fontWeight: 600 }}>{d.expectedDeliveryDate}</span>
                          </span>
                        )}
                      </div>
                    )}

                    {scans.length > 0 ? (
                      <div style={{ padding: '1.15rem 0 0.2rem' }}>
                        <p style={{ margin: '0 0 12px', fontSize: '0.68rem', letterSpacing: '0.06em', color: 'var(--shell-text-subtle)', textTransform: 'uppercase' }}>Tracking history</p>
                        <div style={{ position: 'relative' }}>
                          <span style={{ position: 'absolute', left: '0.45rem', top: '0.5rem', bottom: '1rem', width: '2px', background: 'var(--shell-border)' }} />
                          {scans.map((scan, idx) => {
                            const sc = scan as Record<string, unknown>;
                            const status = String(sc.status ?? sc.activity ?? sc.remark ?? '\u2014');
                            const time = String(sc.date ?? sc.date_time ?? sc.status_date_time ?? sc.scan_date_time ?? '');
                            const loc = String(sc.location ?? sc.city ?? sc.scan_location ?? '');
                            const isLatest = idx === 0;
                            const isLast = idx === scans.length - 1;
                            return (
                              <div key={idx} style={{ position: 'relative', paddingLeft: '1.75rem', paddingBottom: isLast ? 0 : '1.05rem' }}>
                                <span
                                  style={{
                                    position: 'absolute',
                                    left: isLatest ? '0.1rem' : '0.25rem',
                                    top: isLatest ? '0.15rem' : '0.3rem',
                                    width: isLatest ? '0.95rem' : '0.62rem',
                                    height: isLatest ? '0.95rem' : '0.62rem',
                                    borderRadius: '50%',
                                    background: isLatest ? th.color : 'var(--shell-elevated, #1c2740)',
                                    border: isLatest ? 'none' : '2px solid var(--shell-border-strong, rgba(255,255,255,0.22))',
                                    outline: isLatest ? `4px solid ${th.ring}` : 'none',
                                  }}
                                />
                                <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600, color: isLatest ? th.color : 'var(--shell-text-primary)' }}>{status}</p>
                                <p style={{ margin: '3px 0 0', fontSize: '0.72rem', color: 'var(--shell-text-subtle)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                  {time && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><IconClock size={12} />{time}</span>}
                                  {loc && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><IconPin size={12} />{loc}</span>}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <p style={{ fontSize: '0.8rem', color: 'var(--shell-text-subtle)', margin: '1rem 0' }}>No scan updates yet.</p>
                    )}
                  </div>
                );
              })()}
            </div>

            <div style={{ padding: '0.85rem 1.2rem', borderTop: '0.5px solid var(--shell-border)', display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button onClick={closeTrack} className={s.deleteCancelBtn}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
