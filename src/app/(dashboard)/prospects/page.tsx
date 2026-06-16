'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { fetchCurrentUser } from '@/lib/current-user';
import { Prospect, ProspectStatus, ProspectsResponse } from '@/types';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { SkeletonList } from '@/components/ui/Loader';
import s from '../leads/leads.module.scss';

const statuses: ProspectStatus[] = [
  'NEW', 'CONTACTED', 'CALL_BACK', 'NOT_PICK',
  'SWITCH_OFF', 'NOT_REACHABLE', 'HANG_UP', 'NOT_INTERESTED',
  'DNC', 'FOLLOW_UP_1', 'FOLLOW_UP_2', 'FOLLOW_UP_3', 'CONVERTED',
];

const STATUS_LABELS: Record<string, string> = {
  NEW: 'New', CONTACTED: 'Contacted', CALL_BACK: 'Call Back', NOT_PICK: 'Not Pick',
  SWITCH_OFF: 'Switch Off', NOT_REACHABLE: 'Not Reachable', HANG_UP: 'Hang Up',
  NOT_INTERESTED: 'Not Interested', DNC: 'DNC',
  FOLLOW_UP_1: 'Follow Up 1', FOLLOW_UP_2: 'Follow Up 2', FOLLOW_UP_3: 'Follow Up 3',
  CONVERTED: 'Converted',
};

const statusCls = (st: string) => {
  switch (st) {
    case 'NEW': return s.statusNew;
    case 'CONTACTED': return s.statusContacted;
    case 'CONVERTED': return s.statusConverted;
    case 'CALL_BACK': return s.statusCallBack;
    case 'NOT_PICK':
    case 'SWITCH_OFF':
    case 'NOT_REACHABLE':
    case 'HANG_UP': return s.statusMissed;
    case 'NOT_INTERESTED': return s.statusNotInterested;
    case 'DNC': return s.statusDnc;
    case 'FOLLOW_UP_1':
    case 'FOLLOW_UP_2':
    case 'FOLLOW_UP_3': return s.statusFollowUp;
    default: return s.statusClosed;
  }
};

const formatDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-';

interface ProspectForm {
  name: string;
  phone: string;
  alternatePhone: string;
  city: string;
  status: ProspectStatus;
  notes: string;
  nextFollowUpDate: string;
}

const emptyForm = (): ProspectForm => ({
  name: '', phone: '', alternatePhone: '', city: '',
  status: 'NEW', notes: '', nextFollowUpDate: '',
});

export default function ProspectsPage() {
  const [rows, setRows] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [canManage, setCanManage] = useState(true);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [sortField, setSortField] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Prospect | null>(null);
  const [form, setForm] = useState<ProspectForm>(emptyForm());
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Prospect | null>(null);
  const [convertTarget, setConvertTarget] = useState<Prospect | null>(null);
  const [convertName, setConvertName] = useState('');
  const [convertDesc, setConvertDesc] = useState('');
  const [converting, setConverting] = useState(false);

  useEffect(() => {
    fetchCurrentUser()
      .then((u) => setCanManage(u.role === 'SUPER_ADMIN' || u.canManageProspects))
      .catch(() => {});
  }, []);

  const fetchData = async (toPage = page) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter) params.set('status', statusFilter);
      params.set('page', String(toPage));
      params.set('limit', String(pageSize));
      params.set('sortBy', sortField);
      params.set('order', sortOrder);
      const res = await api.get<ProspectsResponse>(`/prospects?${params.toString()}`);
      setRows(res.data.data);
      setTotal(res.data.meta.total);
      setTotalPages(res.data.meta.totalPages || 1);
      setPage(res.data.meta.page);
    } catch {
      setError('Failed to load prospects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, pageSize, sortField, sortOrder]);

  const handleSort = (field: string) => {
    if (sortField === field) setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortOrder('asc'); }
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

  const openEdit = (p: Prospect) => {
    setEditing(p);
    setForm({
      name: p.name || '',
      phone: p.phone || '',
      alternatePhone: p.alternatePhone || '',
      city: p.city || '',
      status: p.status,
      notes: p.notes || '',
      nextFollowUpDate: p.nextFollowUpDate ? p.nextFollowUpDate.slice(0, 10) : '',
    });
    setError('');
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim() || undefined,
        phone: form.phone.trim() || undefined,
        alternatePhone: form.alternatePhone.trim() || undefined,
        city: form.city.trim() || undefined,
        status: form.status,
        notes: form.notes.trim() || undefined,
        nextFollowUpDate: form.nextFollowUpDate || undefined,
      };
      if (editing) await api.put(`/prospects/${editing.id}`, payload);
      else await api.post('/prospects', payload);
      setShowForm(false);
      setEditing(null);
      fetchData(editing ? page : 1);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save prospect');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (id: number, status: ProspectStatus) => {
    setRows((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
    try {
      await api.patch(`/prospects/${id}/status`, { status });
    } catch {
      fetchData(page);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/prospects/${deleteTarget.id}`);
      setDeleteTarget(null);
      fetchData(page);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete');
      setDeleteTarget(null);
    }
  };

  const openConvert = (p: Prospect) => {
    setConvertTarget(p);
    setConvertName(p.name || '');
    setConvertDesc('');
  };

  const handleConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!convertTarget) return;
    setConverting(true);
    setError('');
    try {
      await api.post(`/prospects/${convertTarget.id}/convert`, {
        name: convertName.trim(),
        description: convertDesc.trim() || undefined,
      });
      setConvertTarget(null);
      fetchData(page);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to convert');
    } finally {
      setConverting(false);
    }
  };

  return (
    <div className={s.page}>
      <div className={s.header}>
        <div>
          <h2 className={s.pageTitle}>Prospects</h2>
          <p className={s.leadDesc}>{total} numbers in the call list</p>
        </div>
        {canManage && (
          <button onClick={openCreate} className={s.addBtn}>+ Add Prospect</button>
        )}
      </div>

      {error && !showForm && <div className={s.error}>{error}</div>}

      {showForm && (
        <div className={s.inlineFormWrap}>
          <form onSubmit={handleSubmit} className={s.inlineForm}>
            <h2 className={s.inlineFormTitle}>{editing ? 'Edit Prospect' : 'New Prospect'}</h2>
            {error && <div className={s.error}>{error}</div>}
            <div className={s.grid2}>
              <div className={s.formGroup}>
                <label>Name</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={s.formInput} placeholder="Optional until qualified" />
              </div>
              <div className={s.formGroup}>
                <label>Phone</label>
                <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={s.formInput} />
              </div>
            </div>
            <div className={s.grid2}>
              <div className={s.formGroup}>
                <label>Alternate Number</label>
                <input type="tel" value={form.alternatePhone} onChange={(e) => setForm({ ...form, alternatePhone: e.target.value })} className={s.formInput} placeholder="Optional" />
              </div>
              <div className={s.formGroup}>
                <label>City</label>
                <input type="text" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className={s.formInput} />
              </div>
            </div>
            <div className={s.grid2}>
              <div className={s.formGroup}>
                <label>Status</label>
                <CustomSelect
                  options={statuses.map((st) => ({ label: STATUS_LABELS[st], value: st }))}
                  value={form.status}
                  onChange={(val) => setForm({ ...form, status: val as ProspectStatus })}
                  align="left"
                  minWidth="100%"
                />
              </div>
              <div className={s.formGroup}>
                <label>Next Follow-Up</label>
                <input type="date" value={form.nextFollowUpDate} onChange={(e) => setForm({ ...form, nextFollowUpDate: e.target.value })} className={s.formInput} />
              </div>
            </div>
            <div className={s.formGroup}>
              <label>Notes</label>
              <input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={s.formInput} placeholder="Call notes..." />
            </div>
            <div className={s.formActions}>
              <button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className={s.cancelBtn}>Cancel</button>
              <button type="submit" disabled={saving} className={s.saveBtn}>
                {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Prospect'}
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
                placeholder="Search by name, phone, or city..."
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
              options={[{ label: 'All statuses', value: '' }, ...statuses.map((st) => ({ label: STATUS_LABELS[st], value: st }))]}
              value={statusFilter}
              onChange={(val) => setStatusFilter(String(val))}
              align="left"
              minWidth="180px"
            />
          </div>
        </div>
      )}

      {!showForm && (loading ? (
        <SkeletonList rows={5} />
      ) : rows.length === 0 ? (
        <div className={s.emptyBox}>
          <div className={s.emptyText}>No prospects found</div>
        </div>
      ) : (
        <div className={s.tableWrap}>
          {/* Mobile cards */}
          <div className={s.mobileList}>
            {rows.map((p) => (
              <article key={`m-${p.id}`} className={s.mobileCard}>
                <div className={s.mobileCardTop}>
                  <div className={s.mobileCardHeader}>
                    <div>
                      <p className={s.leadName}>{p.name || p.phone || `Prospect #${p.id}`}</p>
                      {p.city && <p className={s.leadDesc}>{p.city}</p>}
                    </div>
                    <select
                      value={p.status}
                      disabled={!canManage}
                      onChange={(e) => handleStatusChange(p.id, e.target.value as ProspectStatus)}
                      className={`${s.statusSelect} ${statusCls(p.status)}`}
                    >
                      {statuses.map((st) => <option key={st} value={st}>{STATUS_LABELS[st]}</option>)}
                    </select>
                  </div>
                </div>
                <div className={s.mobileMetaGrid}>
                  <div className={s.mobileMetaItem}>
                    <span className={s.mobileMetaLabel}>Phone</span>
                    <span className={s.cellText}>{p.phone || '-'}</span>
                  </div>
                  <div className={s.mobileMetaItem}>
                    <span className={s.mobileMetaLabel}>Alt. Number</span>
                    <span className={s.cellText}>{p.alternatePhone || '-'}</span>
                  </div>
                  <div className={s.mobileMetaItem}>
                    <span className={s.mobileMetaLabel}>Follow-Up</span>
                    <span className={s.cellText}>{formatDate(p.nextFollowUpDate)}</span>
                  </div>
                  <div className={s.mobileMetaItem}>
                    <span className={s.mobileMetaLabel}>Added</span>
                    <span className={s.cellText}>{formatDate(p.createdAt)}</span>
                  </div>
                </div>
                {p.notes && (
                  <div className={s.mobileNotes}>
                    <span className={s.mobileMetaLabel}>Notes</span>
                    <span className={s.cellText}>{p.notes}</span>
                  </div>
                )}
                {canManage && (
                  <div className={s.mobileActions}>
                    {p.status !== 'CONVERTED' && (
                      <button onClick={() => openConvert(p)} className={s.mobileEditBtn}>Convert</button>
                    )}
                    <button onClick={() => openEdit(p)} className={s.mobileEditBtn}>Edit</button>
                    <button onClick={() => setDeleteTarget(p)} className={s.mobileDeleteBtn}>Delete</button>
                  </div>
                )}
              </article>
            ))}
          </div>

          {/* Desktop table */}
          <table className={s.table}>
            <thead className={s.thead}>
              <tr>
                <th className={`${s.th} ${s.thSortable}`} onClick={() => handleSort('name')}>Name{sortField === 'name' ? (sortOrder === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</th>
                <th className={`${s.th} ${s.thSortable}`} onClick={() => handleSort('phone')}>Phone{sortField === 'phone' ? (sortOrder === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</th>
                <th className={s.th}>Alt. Number</th>
                <th className={s.th}>City</th>
                <th className={`${s.th} ${s.thSortable}`} onClick={() => handleSort('nextFollowUpDate')}>Follow-Up{sortField === 'nextFollowUpDate' ? (sortOrder === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</th>
                <th className={`${s.th} ${s.thSortable}`} onClick={() => handleSort('createdAt')}>Added{sortField === 'createdAt' ? (sortOrder === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</th>
                <th className={`${s.th} ${s.thSortable}`} onClick={() => handleSort('status')}>Status{sortField === 'status' ? (sortOrder === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</th>
                <th className={`${s.th} ${s.thRight}`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className={s.tr}>
                  <td className={s.td}>
                    <p className={s.leadName}>{p.name || <span className={s.cellText}>—</span>}</p>
                    {p.notes && <p className={s.leadDesc}>{p.notes}</p>}
                  </td>
                  <td className={s.td}><span className={s.cellText}>{p.phone || '-'}</span></td>
                  <td className={s.td}><span className={s.cellText}>{p.alternatePhone || '-'}</span></td>
                  <td className={s.td}><span className={s.cellText}>{p.city || '-'}</span></td>
                  <td className={s.td}><span className={s.cellText}>{formatDate(p.nextFollowUpDate)}</span></td>
                  <td className={s.td}><span className={s.cellText}>{formatDate(p.createdAt)}</span></td>
                  <td className={s.td}>
                    <select
                      value={p.status}
                      disabled={!canManage}
                      onChange={(e) => handleStatusChange(p.id, e.target.value as ProspectStatus)}
                      className={`${s.statusSelect} ${statusCls(p.status)}`}
                    >
                      {statuses.map((st) => <option key={st} value={st}>{STATUS_LABELS[st]}</option>)}
                    </select>
                  </td>
                  <td className={`${s.td} ${s.tdRight}`}>
                    {canManage && p.status !== 'CONVERTED' && (
                      <button onClick={() => openConvert(p)} className={s.editBtn}>Convert</button>
                    )}
                    {canManage && (
                      <>
                        <button onClick={() => openEdit(p)} className={s.editBtn}>Edit</button>
                        <button onClick={() => setDeleteTarget(p)} className={s.deleteBtn}>Delete</button>
                      </>
                    )}
                    {p.status === 'CONVERTED' && p.convertedLeadId && (
                      <span className={s.cellText}>→ Lead #{p.convertedLeadId}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className={s.pagination}>
            <button onClick={() => goToPage(page - 1)} disabled={page <= 1} className={s.pageBtn}>← Prev</button>
            <span className={s.pageInfo}>Page {page} of {totalPages} ({total} prospects)</span>
            <button onClick={() => goToPage(page + 1)} disabled={page >= totalPages} className={s.pageBtn}>Next →</button>
            <CustomSelect
              options={[10, 20, 30, 50].map((n) => ({ label: `${n} / page`, value: n }))}
              value={pageSize}
              onChange={(val) => { setPageSize(Number(val)); }}
              align="right"
              direction="up"
            />
          </div>
        </div>
      ))}

      {/* Convert modal */}
      {convertTarget && (
        <div className={s.overlay}>
          <div className={s.deleteModal}>
            <h3 className={s.deleteTitle}>Convert to Lead</h3>
            <p className={s.deleteMsg}>
              This creates a lead for the order team from prospect {convertTarget.phone || `#${convertTarget.id}`} and marks it Converted.
            </p>
            <form onSubmit={handleConvert}>
              <div className={s.formGroup}>
                <label>Lead Name *</label>
                <input type="text" required value={convertName} onChange={(e) => setConvertName(e.target.value)} className={s.formInput} placeholder="Customer name" />
              </div>
              <div className={s.formGroup}>
                <label>Description</label>
                <input type="text" value={convertDesc} onChange={(e) => setConvertDesc(e.target.value)} className={s.formInput} placeholder="Optional" />
              </div>
              {error && <div className={s.error}>{error}</div>}
              <div className={s.deleteActions}>
                <button type="button" onClick={() => setConvertTarget(null)} className={s.deleteCancelBtn}>Cancel</button>
                <button type="submit" disabled={converting} className={s.saveBtn}>{converting ? 'Converting...' : 'Convert'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete modal */}
      {deleteTarget && (
        <div className={s.overlay}>
          <div className={s.deleteModal}>
            <h3 className={s.deleteTitle}>Delete Prospect?</h3>
            <p className={s.deleteMsg}>
              Remove {deleteTarget.name || deleteTarget.phone || `#${deleteTarget.id}`} from the call list? This cannot be undone.
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
