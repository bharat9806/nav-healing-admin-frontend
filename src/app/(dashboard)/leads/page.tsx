'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { exportToExcel } from '@/lib/exportExcel';
import { Lead, Product, LeadStatus } from '@/types';
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

interface LeadItemForm { productId: number; quantity: number; }

const DATE_PRESETS = [
  { label: 'Today',        key: 'today' },
  { label: 'Yesterday',    key: 'yesterday' },
  { label: 'This Week',    key: 'week' },
  { label: 'This Month',   key: 'month' },
  { label: 'Custom Range', key: 'custom' },
];

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
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
  const [loading, setLoading] = useState(true);

  const [showInlineForm, setShowInlineForm] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [form, setForm] = useState({
    name: '', phone: '', email: '', description: '',
    age: '', gender: '', address: '', pinCode: '',
    trackingNumber: '', diseases: '', status: 'NEW' as LeadStatus, notes: '',
    deliveredAt: '', nextFollowUpDate: '',
  });
  const [items, setItems] = useState<LeadItemForm[]>([{ productId: 0, quantity: 1 }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Lead | null>(null);

  const fetchData = (
    from = dateFrom, to = dateTo,
    delFrom = deliveredFrom, delTo = deliveredTo,
    fuFrom = followUpFrom, fuTo = followUpTo,
  ) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (from) params.set('dateFrom', from);
    if (to) params.set('dateTo', to);
    if (delFrom) params.set('deliveredFrom', delFrom);
    if (delTo) params.set('deliveredTo', delTo);
    if (fuFrom) params.set('followUpFrom', fuFrom);
    if (fuTo) params.set('followUpTo', fuTo);
    const query = params.toString() ? `?${params.toString()}` : '';
    Promise.all([api.get(`/leads${query}`), api.get('/products')])
      .then(([leadsRes, productsRes]) => { setLeads(leadsRes.data); setProducts(productsRes.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = leads.filter((l) => {
    const matchSearch = l.name.toLowerCase().includes(search.toLowerCase()) ||
      (l.phone || '').includes(search) ||
      (l.diseases || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || l.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', phone: '', email: '', description: '', age: '', gender: '', address: '', pinCode: '', trackingNumber: '', diseases: '', status: 'NEW', notes: '', deliveredAt: '', nextFollowUpDate: '' });
    setItems([{ productId: 0, quantity: 1 }]);
    setError('');
    setShowInlineForm(true);
  };

  const cancelCreate = () => { setShowInlineForm(false); setError(''); };

  const openEdit = (l: Lead) => {
    setEditing(l);
    setForm({
      name: l.name, phone: l.phone || '', email: l.email || '', description: l.description || '',
      age: l.age ? String(l.age) : '', gender: l.gender || '', address: l.address || '', pinCode: l.pinCode || '',
      trackingNumber: l.trackingNumber || '', diseases: l.diseases || '', status: l.status, notes: l.notes || '',
      deliveredAt: l.deliveredAt ? l.deliveredAt.slice(0, 10) : '',
      nextFollowUpDate: l.nextFollowUpDate ? l.nextFollowUpDate.slice(0, 10) : '',
    });
    setItems(l.items.length > 0 ? l.items.map((i) => ({ productId: i.productId, quantity: i.quantity })) : [{ productId: 0, quantity: 1 }]);
    setError('');
    setShowModal(true);
  };

  const addItem = () => setItems([...items, { productId: 0, quantity: 1 }]);
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: string, value: any) => {
    const updated = [...items];
    (updated[idx] as any)[field] = value;
    setItems(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const validItems = items.filter((i) => i.productId > 0);
    const payload: any = {
      name: form.name,
      phone: form.phone || undefined, email: form.email || undefined,
      description: form.description || undefined, age: form.age ? Number(form.age) : undefined,
      gender: form.gender || undefined, address: form.address || undefined,
      pinCode: form.pinCode || undefined, trackingNumber: form.trackingNumber || undefined,
      diseases: form.diseases || undefined, status: form.status, notes: form.notes || undefined,
      deliveredAt: form.deliveredAt || undefined, nextFollowUpDate: form.nextFollowUpDate || undefined,
      items: validItems.length > 0 ? validItems : undefined,
    };
    try {
      if (editing) { await api.put(`/leads/${editing.id}`, payload); setShowModal(false); }
      else { await api.post('/leads', payload); setShowInlineForm(false); }
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save lead');
    } finally { setSaving(false); }
  };

  const handleStatusChange = async (id: number, status: LeadStatus) => {
    await api.patch(`/leads/${id}/status`, { status });
    fetchData();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await api.delete(`/leads/${deleteTarget.id}`);
    setDeleteTarget(null);
    fetchData();
  };

  const handlePreset = (key: string) => {
    const today = new Date();
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    setDatePreset(key);
    if (!key) { setDateFrom(''); setDateTo(''); fetchData('', ''); }
    else if (key === 'today') { const d = fmt(today); setDateFrom(d); setDateTo(d); fetchData(d, d); }
    else if (key === 'yesterday') { const d = fmt(new Date(Date.now() - 86400000)); setDateFrom(d); setDateTo(d); fetchData(d, d); }
    else if (key === 'week') { const start = new Date(today); start.setDate(today.getDate() - today.getDay()); const from = fmt(start); const to = fmt(today); setDateFrom(from); setDateTo(to); fetchData(from, to); }
    else if (key === 'month') { const from = fmt(new Date(today.getFullYear(), today.getMonth(), 1)); const to = fmt(today); setDateFrom(from); setDateTo(to); fetchData(from, to); }
    else { setDateFrom(''); setDateTo(''); }
  };

  const applyDateRange = (from: string, to: string, field: 'delivered' | 'followUp') => {
    if (field === 'delivered') fetchData(dateFrom, dateTo, from, to, followUpFrom, followUpTo);
    else fetchData(dateFrom, dateTo, deliveredFrom, deliveredTo, from, to);
  };

  const handleDeliveredPreset = (key: string) => {
    const today = new Date();
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    setDeliveredPreset(key);
    if (!key) { setDeliveredFrom(''); setDeliveredTo(''); applyDateRange('', '', 'delivered'); }
    else if (key === 'today') { const d = fmt(today); setDeliveredFrom(d); setDeliveredTo(d); applyDateRange(d, d, 'delivered'); }
    else if (key === 'yesterday') { const d = fmt(new Date(Date.now() - 86400000)); setDeliveredFrom(d); setDeliveredTo(d); applyDateRange(d, d, 'delivered'); }
    else if (key === 'week') { const start = new Date(today); start.setDate(today.getDate() - today.getDay()); const from = fmt(start); const to = fmt(today); setDeliveredFrom(from); setDeliveredTo(to); applyDateRange(from, to, 'delivered'); }
    else if (key === 'month') { const from = fmt(new Date(today.getFullYear(), today.getMonth(), 1)); const to = fmt(today); setDeliveredFrom(from); setDeliveredTo(to); applyDateRange(from, to, 'delivered'); }
    else { setDeliveredFrom(''); setDeliveredTo(''); }
  };

  const handleFollowUpPreset = (key: string) => {
    const today = new Date();
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    setFollowUpPreset(key);
    if (!key) { setFollowUpFrom(''); setFollowUpTo(''); applyDateRange('', '', 'followUp'); }
    else if (key === 'today') { const d = fmt(today); setFollowUpFrom(d); setFollowUpTo(d); applyDateRange(d, d, 'followUp'); }
    else if (key === 'yesterday') { const d = fmt(new Date(Date.now() - 86400000)); setFollowUpFrom(d); setFollowUpTo(d); applyDateRange(d, d, 'followUp'); }
    else if (key === 'week') { const start = new Date(today); start.setDate(today.getDate() - today.getDay()); const from = fmt(start); const to = fmt(today); setFollowUpFrom(from); setFollowUpTo(to); applyDateRange(from, to, 'followUp'); }
    else if (key === 'month') { const from = fmt(new Date(today.getFullYear(), today.getMonth(), 1)); const to = fmt(today); setFollowUpFrom(from); setFollowUpTo(to); applyDateRange(from, to, 'followUp'); }
    else { setFollowUpFrom(''); setFollowUpTo(''); }
  };

  const handleExport = () => {
    const rows = filtered.map((l) => ({
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

  const LeadForm = () => (
    <form onSubmit={handleSubmit} className={s.inlineForm}>
      <h2 className={s.inlineFormTitle}>{editing ? 'Edit Lead' : 'New Lead'}</h2>
      {error && <div className={s.error}>{error}</div>}
      <div className={s.grid2}>
        <div className={s.formGroup}><label>Name *</label><input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={s.formInput} /></div>
        <div className={s.formGroup}><label>Phone</label><input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={s.formInput} /></div>
      </div>
      <div className={s.grid2}>
        <div className={s.formGroup}><label>Email</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={s.formInput} /></div>
        <div className={s.formGroup}><label>Description</label><input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={s.formInput} placeholder="Inquiry details..." /></div>
      </div>
      <div className={s.grid3}>
        <div className={s.formGroup}><label>Age</label><input type="number" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} className={s.formInput} /></div>
        <div className={s.formGroup}><label>Gender</label>
          <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} className={s.formSelect}>
            <option value="">Select...</option><option>Male</option><option>Female</option><option>Other</option>
          </select>
        </div>
        <div className={s.formGroup}><label>Pin Code</label><input type="text" value={form.pinCode} onChange={(e) => setForm({ ...form, pinCode: e.target.value })} className={s.formInput} /></div>
      </div>
      <div className={s.formGroup}><label>Address</label><textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} className={s.formTextarea} /></div>
      <div className={s.formGroup}><label>Diseases</label><textarea value={form.diseases} onChange={(e) => setForm({ ...form, diseases: e.target.value })} rows={2} className={s.formTextarea} /></div>
      <div className={s.grid2}>
        <div className={s.formGroup}><label>Tracking Number</label><input type="text" value={form.trackingNumber} onChange={(e) => setForm({ ...form, trackingNumber: e.target.value })} className={s.formInput} /></div>
        <div className={s.formGroup}><label>Status</label>
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as LeadStatus })} className={s.formSelect}>
            {statuses.map((st) => <option key={st} value={st}>{STATUS_LABELS[st]}</option>)}
          </select>
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
              <select value={item.productId} onChange={(e) => updateItem(idx, 'productId', Number(e.target.value))} className={s.itemSelect}>
                <option value={0}>Select product...</option>
                {products.filter((p) => p.isActive).map((p) => (
                  <option key={p.id} value={p.id}>{p.name} (&#8377;{Number(p.price).toFixed(2)})</option>
                ))}
              </select>
              <input type="number" min={1} value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', Number(e.target.value))} className={s.itemQty} placeholder="Qty" />
              {items.length > 1 && <button type="button" onClick={() => removeItem(idx)} className={s.removeItemBtn}>✕</button>}
            </div>
          ))}
        </div>
      </div>
      <div className={s.formGroup}><label>Notes</label><input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={s.formInput} /></div>
      <div className={s.formActions}>
        <button type="button" onClick={editing ? () => setShowModal(false) : cancelCreate} className={s.cancelBtn}>Cancel</button>
        <button type="submit" disabled={saving} className={s.saveBtn}>{saving ? 'Saving...' : editing ? 'Update' : 'Create'}</button>
      </div>
    </form>
  );

  return (
    <div className={s.page}>
      <div className={s.header}>
        <h1 className={s.pageTitle}>Leads</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={handleExport} className={s.exportBtn}>↓ Export Excel</button>
          <button onClick={openCreate} className={s.addBtn}>+ Add Lead</button>
        </div>
      </div>

      <div className={s.filterPanel}>
        <div className={s.filterRow}>
          <input type="text" placeholder="Search by name, phone, or disease..." value={search} onChange={(e) => setSearch(e.target.value)} className={s.searchInput} />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={s.select}>
            <option value="">All Statuses</option>
            {statuses.map((st) => <option key={st} value={st}>{STATUS_LABELS[st]}</option>)}
          </select>
          <select value={datePreset} onChange={(e) => handlePreset(e.target.value)} className={s.select}>
            <option value="">Created: All</option>
            {DATE_PRESETS.map(({ label, key }) => <option key={key} value={key}>{label}</option>)}
          </select>
          <select value={deliveredPreset} onChange={(e) => handleDeliveredPreset(e.target.value)} className={s.select}>
            <option value="">Delivered: All</option>
            {DATE_PRESETS.map(({ label, key }) => <option key={key} value={key}>{label}</option>)}
          </select>
          <select value={followUpPreset} onChange={(e) => handleFollowUpPreset(e.target.value)} className={s.select}>
            <option value="">Follow-Up: All</option>
            {DATE_PRESETS.map(({ label, key }) => <option key={key} value={key}>{label}</option>)}
          </select>
        </div>

        {/* Custom date range pickers */}
        {(datePreset === 'custom' || deliveredPreset === 'custom' || followUpPreset === 'custom') && (
          <>
            {datePreset === 'custom' && (
              <div className={s.filterRow}>
                <span className={s.filterLabel}>Created</span>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={s.dateInput} />
                <span className={s.sep}>—</span>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={s.dateInput} />
                <button onClick={() => fetchData(dateFrom, dateTo)} disabled={!dateFrom && !dateTo} className={s.applyBtn}>Apply</button>
              </div>
            )}
            {deliveredPreset === 'custom' && (
              <div className={s.filterRow}>
                <span className={s.filterLabel}>Delivered</span>
                <input type="date" value={deliveredFrom} onChange={(e) => setDeliveredFrom(e.target.value)} className={s.dateInput} />
                <span className={s.sep}>—</span>
                <input type="date" value={deliveredTo} onChange={(e) => setDeliveredTo(e.target.value)} className={s.dateInput} />
                <button onClick={() => applyDateRange(deliveredFrom, deliveredTo, 'delivered')} disabled={!deliveredFrom && !deliveredTo} className={s.applyBtn}>Apply</button>
              </div>
            )}
            {followUpPreset === 'custom' && (
              <div className={s.filterRow}>
                <span className={s.filterLabel}>Follow-Up</span>
                <input type="date" value={followUpFrom} onChange={(e) => setFollowUpFrom(e.target.value)} className={s.dateInput} />
                <span className={s.sep}>—</span>
                <input type="date" value={followUpTo} onChange={(e) => setFollowUpTo(e.target.value)} className={s.dateInput} />
                <button onClick={() => applyDateRange(followUpFrom, followUpTo, 'followUp')} disabled={!followUpFrom && !followUpTo} className={s.applyBtn}>Apply</button>
              </div>
            )}
          </>
        )}
      </div>

      {loading ? (
        <div className={s.skeletonList}>
          {[...Array(5)].map((_, i) => <div key={i} className={s.skeletonRow} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className={s.emptyBox}>
          {showInlineForm ? <LeadForm /> : <div className={s.emptyText}>No leads found</div>}
        </div>
      ) : (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead className={s.thead}>
              <tr>
                <th className={s.th}>Name</th>
                <th className={s.th}>Phone</th>
                <th className={`${s.th} ${s.hideMd}`}>Email</th>
                <th className={`${s.th} ${s.hideLg}`}>Diseases</th>
                <th className={s.th}>Products</th>
                <th className={s.th}>Status</th>
                <th className={`${s.th} ${s.hideLg}`}>Tracking</th>
                <th className={`${s.th} ${s.thRight}`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.id} className={s.tr}>
                  <td className={s.td}>
                    <p className={s.leadName}>{l.name}</p>
                    {l.description && <p className={s.leadDesc}>{l.description}</p>}
                  </td>
                  <td className={s.td}><span className={s.cellText}>{l.phone || '-'}</span></td>
                  <td className={`${s.td} ${s.hideMd}`}><span className={s.cellText}>{l.email || '-'}</span></td>
                  <td className={`${s.td} ${s.hideLg}`}><span className={s.cellText}>{l.diseases || '-'}</span></td>
                  <td className={s.td}><span className={s.cellText}>{l.items?.length || 0} items</span></td>
                  <td className={s.td}>
                    <select value={l.status} onChange={(e) => handleStatusChange(l.id, e.target.value as LeadStatus)}
                      className={`${s.statusSelect} ${statusCls(l.status)}`}>
                      {statuses.map((st) => <option key={st} value={st} style={{ backgroundColor: '#111827', color: '#fff' }}>{STATUS_LABELS[st]}</option>)}
                    </select>
                  </td>
                  <td className={`${s.td} ${s.hideLg}`}><span className={s.tracking}>{l.trackingNumber || '-'}</span></td>
                  <td className={`${s.td} ${s.tdRight}`}>
                    <button onClick={() => openEdit(l)} className={s.editBtn}>Edit</button>
                    <button onClick={() => setDeleteTarget(l)} className={s.deleteBtn}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className={s.overlay}>
          <div className={s.modal}><LeadForm /></div>
        </div>
      )}

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
