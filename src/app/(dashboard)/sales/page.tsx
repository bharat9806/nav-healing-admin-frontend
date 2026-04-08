'use client';

import { isAxiosError } from 'axios';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { fetchCurrentUser } from '@/lib/current-user';
import { exportToExcel } from '@/lib/exportExcel';
import { Sale, User } from '@/types';
import s from './sales.module.scss';

const defaultPaymentModes = ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Cheque'];
const defaultStatuses = ['Paid', 'Pending', 'Partial', 'Cancelled'];

type SaleFormState = {
  date: string;
  patientName: string;
  amount: string;
  paymentMode: string;
  status: string;
  pendingAmount: string;
  notes: string;
};

const initialForm = (): SaleFormState => ({
  date: new Date().toISOString().slice(0, 10),
  patientName: '',
  amount: '',
  paymentMode: 'Cash',
  status: 'Paid',
  pendingAmount: '0',
  notes: '',
});

const currency = (value: number | string) => `Rs. ${Number(value || 0).toFixed(2)}`;

const statusClass = (status: string) => {
  const normalized = status.toLowerCase();
  if (normalized === 'pending') return `${s.statusBadge} ${s.statusPending}`;
  if (normalized === 'partial') return `${s.statusBadge} ${s.statusPartial}`;
  if (normalized === 'cancelled') return `${s.statusBadge} ${s.statusCancelled}`;
  return s.statusBadge;
};

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [search, setSearch] = useState('');
  const [paymentModeFilter, setPaymentModeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [paymentModes, setPaymentModes] = useState<string[]>(defaultPaymentModes);
  const [statuses, setStatuses] = useState<string[]>(defaultStatuses);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const [showInlineForm, setShowInlineForm] = useState(false);
  const [editing, setEditing] = useState<Sale | null>(null);
  const [form, setForm] = useState<SaleFormState>(initialForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Sale | null>(null);

  const fetchSales = (nextPage = page) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (paymentModeFilter) params.set('paymentMode', paymentModeFilter);
    if (statusFilter) params.set('status', statusFilter);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    params.set('page', String(nextPage));
    params.set('limit', '20');

    api.get(`/sales?${params.toString()}`)
      .then((res) => {
        setSales(res.data.data);
        setTotalPages(res.data.meta.totalPages);
        setTotal(res.data.meta.total);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCurrentUser().then(setCurrentUser).catch(() => {});
    api.get('/sales/filters')
      .then((res) => {
        if (res.data.paymentModes?.length) setPaymentModes(res.data.paymentModes);
        if (res.data.statuses?.length) setStatuses(res.data.statuses);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchSales(page);
  }, [paymentModeFilter, statusFilter, dateFrom, dateTo, page]);

  const goToPage = (nextPage: number) => {
    setPage(nextPage);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(initialForm());
    setError('');
    setShowInlineForm(true);
  };

  const openEdit = (sale: Sale) => {
    setEditing(sale);
    setForm({
      date: sale.date.slice(0, 10),
      patientName: sale.patientName,
      amount: String(sale.amount),
      paymentMode: sale.paymentMode,
      status: sale.status,
      pendingAmount: String(sale.pendingAmount),
      notes: sale.notes || '',
    });
    setError('');
    setShowInlineForm(true);
  };

  const cancelForm = () => {
    setShowInlineForm(false);
    setEditing(null);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    const payload = {
      date: form.date,
      patientName: form.patientName,
      amount: Number(form.amount),
      paymentMode: form.paymentMode,
      status: form.status,
      pendingAmount: Number(form.pendingAmount || 0),
      notes: form.notes || undefined,
    };

    try {
      if (editing) {
        await api.put(`/sales/${editing.id}`, payload);
      } else {
        await api.post('/sales', payload);
      }

      setShowInlineForm(false);
      setEditing(null);
      fetchSales();
    } catch (err) {
      const message = isAxiosError<{ message?: string }>(err)
        ? err.response?.data?.message
        : undefined;
      setError(message || 'Failed to save sale');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await api.delete(`/sales/${deleteTarget.id}`);
    setDeleteTarget(null);
    fetchSales();
  };

  const handleExport = async () => {
    if (currentUser && currentUser.role !== 'SUPER_ADMIN' && !currentUser.canExportSales) return;
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (paymentModeFilter) params.set('paymentMode', paymentModeFilter);
    if (statusFilter) params.set('status', statusFilter);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    params.set('limit', '10000');

    const res = await api.get(`/sales?${params.toString()}`);
    const rows = (res.data.data as Sale[]).map((sale) => ({
      Date: sale.date.slice(0, 10),
      'Patient Name': sale.patientName,
      Amount: Number(sale.amount).toFixed(2),
      'Payment Mode': sale.paymentMode,
      Status: sale.status,
      'Pending Amount': Number(sale.pendingAmount).toFixed(2),
      Notes: sale.notes || '',
      'Created At': new Date(sale.createdAt).toLocaleDateString(),
    }));

    exportToExcel(rows, `sales_${new Date().toISOString().slice(0, 10)}`);
  };

  return (
    <div className={s.page}>
      <div className={s.header}>
        <h1 className={s.pageTitle}>Sales</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {(currentUser?.role === 'SUPER_ADMIN' || currentUser?.canExportSales) && (
            <button onClick={handleExport} className={s.exportBtn}>Export Excel</button>
          )}
          <button onClick={openCreate} className={s.addBtn}>+ Add Sale</button>
        </div>
      </div>

      {!showInlineForm && (
        <div className={s.filterPanel}>
          <div className={s.searchWrapper}>
            <input
              type="text"
              placeholder="Search by patient name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setPage(1);
                  fetchSales(1);
                }
              }}
              className={s.searchInput}
            />
            {search && (
              <button
                type="button"
                className={s.searchClear}
                onClick={() => {
                  setSearch('');
                  setPage(1);
                  fetchSales(1);
                }}
              >
                ✕
              </button>
            )}
          </div>
          <select
            value={paymentModeFilter}
            onChange={(e) => {
              setPaymentModeFilter(e.target.value);
              setPage(1);
            }}
            className={s.select}
          >
            <option value="">All Payment Modes</option>
            {paymentModes.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className={s.select}
          >
            <option value="">All Statuses</option>
            {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={s.dateInput} />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={s.dateInput} />
          <button
            onClick={() => {
              if (page === 1) fetchSales(1);
              else setPage(1);
            }}
            className={s.searchBtn}
          >
            Search
          </button>
        </div>
      )}

      {showInlineForm && (
        <div className={s.inlineFormWrap}>
          <form onSubmit={handleSubmit} className={s.inlineForm}>
            <h2 className={s.inlineFormTitle}>{editing ? 'Edit Sale' : 'New Sale'}</h2>
            {error && <div className={s.error}>{error}</div>}
            <div className={s.grid2}>
              <div className={s.formGroup}>
                <label>Date *</label>
                <input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={s.formInput} />
              </div>
              <div className={s.formGroup}>
                <label>Patient Name *</label>
                <input type="text" required value={form.patientName} onChange={(e) => setForm({ ...form, patientName: e.target.value })} className={s.formInput} />
              </div>
            </div>
            <div className={s.grid2}>
              <div className={s.formGroup}>
                <label>Amount *</label>
                <input type="number" min="0" step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={s.formInput} />
              </div>
              <div className={s.formGroup}>
                <label>Pending Amount</label>
                <input type="number" min="0" step="0.01" value={form.pendingAmount} onChange={(e) => setForm({ ...form, pendingAmount: e.target.value })} className={s.formInput} />
              </div>
            </div>
            <div className={s.grid2}>
              <div className={s.formGroup}>
                <label>Payment Mode *</label>
                <select value={form.paymentMode} onChange={(e) => setForm({ ...form, paymentMode: e.target.value })} className={s.formSelect}>
                  {[...new Set([...defaultPaymentModes, ...paymentModes])].map((mode) => <option key={mode} value={mode}>{mode}</option>)}
                </select>
              </div>
              <div className={s.formGroup}>
                <label>Status *</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={s.formSelect}>
                  {[...new Set([...defaultStatuses, ...statuses])].map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </div>
            </div>
            <div className={s.formGroup}>
              <label>Notes</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} className={s.formTextarea} />
            </div>
            <div className={s.formActions}>
              <button type="button" onClick={cancelForm} className={s.cancelBtn}>Cancel</button>
              <button type="submit" disabled={saving} className={s.saveBtn}>{saving ? 'Saving...' : editing ? 'Update' : 'Create'}</button>
            </div>
          </form>
        </div>
      )}

      {!showInlineForm && (loading ? (
        <div className={s.skeletonList}>
          {[...Array(5)].map((_, i) => <div key={i} className={s.skeletonRow} />)}
        </div>
      ) : sales.length === 0 ? (
        <div className={s.emptyBox}>
          <div className={s.emptyText}>No sales found</div>
        </div>
      ) : (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead className={s.thead}>
              <tr>
                <th className={s.th}>Date</th>
                <th className={s.th}>Patient Name</th>
                <th className={s.th}>Amount</th>
                <th className={s.th}>Payment Mode</th>
                <th className={s.th}>Status</th>
                <th className={s.th}>Pending Amount</th>
                <th className={`${s.th} ${s.thRight}`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((sale) => (
                <tr key={sale.id} className={s.tr}>
                  <td className={s.td}><span className={s.cellText}>{sale.date.slice(0, 10)}</span></td>
                  <td className={s.td}>
                    <p className={s.patientName}>{sale.patientName}</p>
                    {sale.notes && <p className={s.noteText}>{sale.notes}</p>}
                  </td>
                  <td className={s.td}><span className={s.amountText}>{currency(sale.amount)}</span></td>
                  <td className={s.td}><span className={s.cellText}>{sale.paymentMode}</span></td>
                  <td className={s.td}><span className={statusClass(sale.status)}>{sale.status}</span></td>
                  <td className={s.td}><span className={s.pendingText}>{currency(sale.pendingAmount)}</span></td>
                  <td className={`${s.td} ${s.tdRight}`}>
                    <button onClick={() => openEdit(sale)} className={s.editBtn}>Edit</button>
                    <button onClick={() => setDeleteTarget(sale)} className={s.deleteBtn}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className={s.pagination}>
              <button onClick={() => goToPage(page - 1)} disabled={page <= 1} className={s.pageBtn}>
                Prev
              </button>
              <span className={s.pageInfo}>Page {page} of {totalPages} ({total} sales)</span>
              <button onClick={() => goToPage(page + 1)} disabled={page >= totalPages} className={s.pageBtn}>
                Next
              </button>
            </div>
          )}
        </div>
      ))}

      {deleteTarget && (
        <div className={s.overlay}>
          <div className={s.deleteModal}>
            <h3 className={s.deleteTitle}>Delete Sale</h3>
            <p className={s.deleteMsg}>Are you sure you want to delete "{deleteTarget.patientName}"? This cannot be undone.</p>
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
