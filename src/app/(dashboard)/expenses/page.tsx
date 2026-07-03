'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { fetchCurrentUser } from '@/lib/current-user';
import {
  Company,
  Expense,
  ExpensePaymentMethod,
  ExpenseStats,
  ExpensesResponse,
} from '@/types';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { TypeableSelect } from '@/components/ui/TypeableSelect';
import { SkeletonList } from '@/components/ui/Loader';
import { exportToExcel } from '@/lib/exportExcel';
import s from '../leads/leads.module.scss';

const PAYMENT_METHODS: ExpensePaymentMethod[] = [
  'CASH', 'UPI', 'BANK_TRANSFER', 'CARD', 'CHEQUE', 'OTHER',
];

const PAYMENT_LABELS: Record<ExpensePaymentMethod, string> = {
  CASH: 'Cash',
  UPI: 'UPI',
  BANK_TRANSFER: 'Bank Transfer',
  CARD: 'Card',
  CHEQUE: 'Cheque',
  OTHER: 'Other',
};

// Sensible starting categories; users can type their own via TypeableSelect.
const DEFAULT_CATEGORIES = [
  'Office Supplies', 'Rent', 'Salaries', 'Utilities', 'Marketing',
  'Shipping', 'Travel', 'Equipment', 'Maintenance', 'Events',
  'Inventory / Stock', 'Miscellaneous',
];

const formatDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }) : '-';

const formatMoney = (n: number) =>
  `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface ExpenseForm {
  title: string;
  amount: string;
  category: string;
  vendor: string;
  paymentMethod: ExpensePaymentMethod;
  notes: string;
  expenseDate: string;
  companyId: string;
}

const today = () => new Date().toISOString().slice(0, 10);

const emptyForm = (): ExpenseForm => ({
  title: '', amount: '', category: '', vendor: '',
  paymentMethod: 'CASH', notes: '', expenseDate: today(), companyId: '',
});

export default function ExpensesPage() {
  const [rows, setRows] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [canManage, setCanManage] = useState(true);
  const [canExport, setCanExport] = useState(true);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [stats, setStats] = useState<ExpenseStats | null>(null);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [pageAmount, setPageAmount] = useState(0);
  const [sortField, setSortField] = useState('expenseDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState<ExpenseForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);

  useEffect(() => {
    fetchCurrentUser()
      .then((u) => {
        setCanManage(u.role === 'SUPER_ADMIN' || u.canManageExpenses);
        setCanExport(u.role === 'SUPER_ADMIN' || u.canExportExpenses);
      })
      .catch(() => {});
    api.get<Company[]>('/companies').then((r) => setCompanies(r.data)).catch(() => {});
    api.get<string[]>('/expenses/categories').then((r) => setCategories(r.data)).catch(() => {});
    refreshStats();
  }, []);

  const refreshStats = () => {
    api.get<ExpenseStats>('/expenses/stats').then((r) => setStats(r.data)).catch(() => {});
  };

  const fetchData = async (toPage = page) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (categoryFilter) params.set('category', categoryFilter);
      if (methodFilter) params.set('paymentMethod', methodFilter);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      params.set('page', String(toPage));
      params.set('limit', String(pageSize));
      params.set('sortBy', sortField);
      params.set('order', sortOrder);
      const res = await api.get<ExpensesResponse>(`/expenses?${params.toString()}`);
      setRows(res.data.data);
      setTotal(res.data.meta.total);
      setTotalPages(res.data.meta.totalPages || 1);
      setPageAmount(res.data.meta.totalAmount);
      setPage(res.data.meta.page);
    } catch {
      setError('Failed to load expenses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryFilter, methodFilter, dateFrom, dateTo, pageSize, sortField, sortOrder]);

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

  const openEdit = (x: Expense) => {
    setEditing(x);
    setForm({
      title: x.title,
      amount: String(x.amount),
      category: x.category,
      vendor: x.vendor || '',
      paymentMethod: x.paymentMethod,
      notes: x.notes || '',
      expenseDate: x.expenseDate ? x.expenseDate.slice(0, 10) : today(),
      companyId: x.companyId ? String(x.companyId) : '',
    });
    setError('');
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(form.amount);
    if (!form.title.trim()) return setError('Title is required');
    if (!form.category.trim()) return setError('Category is required');
    if (!Number.isFinite(amountNum) || amountNum <= 0) return setError('Enter a valid amount');
    if (!form.expenseDate) return setError('Date is required');

    setSaving(true);
    setError('');
    try {
      const payload: Record<string, unknown> = {
        title: form.title.trim(),
        amount: amountNum,
        category: form.category.trim(),
        vendor: form.vendor.trim() || undefined,
        paymentMethod: form.paymentMethod,
        notes: form.notes.trim() || undefined,
        expenseDate: form.expenseDate,
        companyId: form.companyId ? Number(form.companyId) : undefined,
      };
      if (editing) await api.put(`/expenses/${editing.id}`, payload);
      else await api.post('/expenses', payload);
      setShowForm(false);
      setEditing(null);
      fetchData(editing ? page : 1);
      refreshStats();
      api.get<string[]>('/expenses/categories').then((r) => setCategories(r.data)).catch(() => {});
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save expense');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/expenses/${deleteTarget.id}`);
      setDeleteTarget(null);
      fetchData(page);
      refreshStats();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete');
      setDeleteTarget(null);
    }
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (categoryFilter) params.set('category', categoryFilter);
      if (methodFilter) params.set('paymentMethod', methodFilter);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      params.set('page', '1');
      params.set('limit', '10000');
      params.set('sortBy', sortField);
      params.set('order', sortOrder);
      const res = await api.get<ExpensesResponse>(`/expenses?${params.toString()}`);
      const data = res.data.data.map((x) => ({
        Title: x.title,
        Amount: x.amount,
        Category: x.category,
        Vendor: x.vendor || '',
        'Payment Method': PAYMENT_LABELS[x.paymentMethod],
        Supplier: x.company?.name || '',
        Date: formatDate(x.expenseDate),
        Notes: x.notes || '',
      }));
      exportToExcel(data, `expenses-${today()}`);
    } catch {
      setError('Failed to export');
    }
  };

  const categoryOptions = Array.from(
    new Set([...DEFAULT_CATEGORIES, ...categories]),
  ).map((c) => ({ label: c, value: c }));

  return (
    <div className={s.page}>
      <div className={s.header}>
        <div>
          <h2 className={s.pageTitle}>Company Expenses</h2>
          <p className={s.leadDesc}>{total} expenses · {formatMoney(pageAmount)} in current view</p>
        </div>
        <div className={s.headerActions}>
          {canExport && (
            <button onClick={handleExport} className={s.exportBtn}>Export</button>
          )}
          {canManage && (
            <button onClick={openCreate} className={s.addBtn}>+ Add Expense</button>
          )}
        </div>
      </div>

      {stats && (
        <div className={s.reminderCards}>
          <div className={s.reminderCard}>
            <span className={s.reminderLabel}>Total Spend</span>
            <span className={s.reminderValue}>{formatMoney(stats.totalAmount)}</span>
          </div>
          <div className={s.reminderCard}>
            <span className={s.reminderLabel}>This Month</span>
            <span className={s.reminderValue}>{formatMoney(stats.thisMonthAmount)}</span>
          </div>
          <div className={s.reminderCard}>
            <span className={s.reminderLabel}>Records</span>
            <span className={s.reminderValue}>{stats.totalCount}</span>
          </div>
        </div>
      )}

      {error && !showForm && <div className={s.error}>{error}</div>}

      {showForm && (
        <div className={s.inlineFormWrap}>
          <form onSubmit={handleSubmit} className={s.inlineForm}>
            <h2 className={s.inlineFormTitle}>{editing ? 'Edit Expense' : 'New Expense'}</h2>
            {error && <div className={s.error}>{error}</div>}
            <div className={s.grid2}>
              <div className={s.formGroup}>
                <label>Title *</label>
                <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={s.formInput} placeholder="e.g. Clinic stationery" />
              </div>
              <div className={s.formGroup}>
                <label>Amount (₹) *</label>
                <input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={s.formInput} placeholder="0.00" />
              </div>
            </div>
            <div className={s.grid2}>
              <div className={s.formGroup}>
                <label>Category *</label>
                <TypeableSelect
                  options={categoryOptions}
                  value={form.category}
                  onChange={(val) => setForm({ ...form, category: val })}
                  align="left"
                  fullWidth
                  placeholder="Select or type a category"
                  customOptionLabel="Type a new category"
                />
              </div>
              <div className={s.formGroup}>
                <label>Payment Method</label>
                <CustomSelect
                  options={PAYMENT_METHODS.map((m) => ({ label: PAYMENT_LABELS[m], value: m }))}
                  value={form.paymentMethod}
                  onChange={(val) => setForm({ ...form, paymentMethod: val as ExpensePaymentMethod })}
                  align="left"
                  minWidth="100%"
                />
              </div>
            </div>
            <div className={s.grid2}>
              <div className={s.formGroup}>
                <label>Date *</label>
                <input type="date" value={form.expenseDate} onChange={(e) => setForm({ ...form, expenseDate: e.target.value })} className={s.formInput} />
              </div>
              <div className={s.formGroup}>
                <label>Vendor / Payee</label>
                <input type="text" value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} className={s.formInput} placeholder="Optional" />
              </div>
            </div>
            <div className={s.grid2}>
              <div className={s.formGroup}>
                <label>Supplier (optional)</label>
                <CustomSelect
                  options={[{ label: 'None', value: '' }, ...companies.map((c) => ({ label: c.name, value: String(c.id) }))]}
                  value={form.companyId}
                  onChange={(val) => setForm({ ...form, companyId: String(val) })}
                  align="left"
                  minWidth="100%"
                />
              </div>
              <div className={s.formGroup}>
                <label>Notes</label>
                <input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={s.formInput} placeholder="Optional" />
              </div>
            </div>
            <div className={s.formActions}>
              <button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className={s.cancelBtn}>Cancel</button>
              <button type="submit" disabled={saving} className={s.saveBtn}>
                {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Expense'}
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
                placeholder="Search title, category, vendor, notes..."
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
              options={[{ label: 'All categories', value: '' }, ...categoryOptions]}
              value={categoryFilter}
              onChange={(val) => setCategoryFilter(String(val))}
              align="left"
              minWidth="170px"
            />
            <CustomSelect
              options={[{ label: 'All methods', value: '' }, ...PAYMENT_METHODS.map((m) => ({ label: PAYMENT_LABELS[m], value: m }))]}
              value={methodFilter}
              onChange={(val) => setMethodFilter(String(val))}
              align="left"
              minWidth="150px"
            />
          </div>
          <div className={s.filterRow}>
            <div className={s.formGroup}>
              <label>From</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={s.formInput} />
            </div>
            <div className={s.formGroup}>
              <label>To</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={s.formInput} />
            </div>
            {(dateFrom || dateTo) && (
              <button type="button" onClick={() => { setDateFrom(''); setDateTo(''); }} className={s.clearBtn}>Clear dates</button>
            )}
          </div>
        </div>
      )}

      {!showForm && (loading ? (
        <SkeletonList rows={5} />
      ) : rows.length === 0 ? (
        <div className={s.emptyBox}>
          <div className={s.emptyText}>No expenses found</div>
        </div>
      ) : (
        <div className={s.tableWrap}>
          {/* Mobile cards */}
          <div className={s.mobileList}>
            {rows.map((x) => (
              <article key={`m-${x.id}`} className={s.mobileCard}>
                <div className={s.mobileCardTop}>
                  <div className={s.mobileCardHeader}>
                    <div>
                      <p className={s.leadName}>{x.title}</p>
                      <p className={s.leadDesc}>{x.category}</p>
                    </div>
                    <span className={s.reminderValue}>{formatMoney(x.amount)}</span>
                  </div>
                </div>
                <div className={s.mobileMetaGrid}>
                  <div className={s.mobileMetaItem}>
                    <span className={s.mobileMetaLabel}>Date</span>
                    <span className={s.cellText}>{formatDate(x.expenseDate)}</span>
                  </div>
                  <div className={s.mobileMetaItem}>
                    <span className={s.mobileMetaLabel}>Method</span>
                    <span className={s.cellText}>{PAYMENT_LABELS[x.paymentMethod]}</span>
                  </div>
                  <div className={s.mobileMetaItem}>
                    <span className={s.mobileMetaLabel}>Vendor</span>
                    <span className={s.cellText}>{x.vendor || '-'}</span>
                  </div>
                  <div className={s.mobileMetaItem}>
                    <span className={s.mobileMetaLabel}>Supplier</span>
                    <span className={s.cellText}>{x.company?.name || '-'}</span>
                  </div>
                </div>
                {x.notes && (
                  <div className={s.mobileNotes}>
                    <span className={s.mobileMetaLabel}>Notes</span>
                    <span className={s.cellText}>{x.notes}</span>
                  </div>
                )}
                {canManage && (
                  <div className={s.mobileActions}>
                    <button onClick={() => openEdit(x)} className={s.mobileEditBtn}>Edit</button>
                    <button onClick={() => setDeleteTarget(x)} className={s.mobileDeleteBtn}>Delete</button>
                  </div>
                )}
              </article>
            ))}
          </div>

          {/* Desktop table */}
          <table className={s.table}>
            <thead className={s.thead}>
              <tr>
                <th className={`${s.th} ${s.thSortable}`} onClick={() => handleSort('title')}>Title{sortField === 'title' ? (sortOrder === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</th>
                <th className={`${s.th} ${s.thSortable}`} onClick={() => handleSort('category')}>Category{sortField === 'category' ? (sortOrder === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</th>
                <th className={`${s.th} ${s.thSortable}`} onClick={() => handleSort('amount')}>Amount{sortField === 'amount' ? (sortOrder === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</th>
                <th className={s.th}>Method</th>
                <th className={s.th}>Vendor</th>
                <th className={s.th}>Supplier</th>
                <th className={`${s.th} ${s.thSortable}`} onClick={() => handleSort('expenseDate')}>Date{sortField === 'expenseDate' ? (sortOrder === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</th>
                <th className={`${s.th} ${s.thRight}`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((x) => (
                <tr key={x.id} className={s.tr}>
                  <td className={s.td}>
                    <p className={s.leadName}>{x.title}</p>
                    {x.notes && <p className={s.leadDesc}>{x.notes}</p>}
                  </td>
                  <td className={s.td}><span className={s.cellText}>{x.category}</span></td>
                  <td className={s.td}><span className={s.leadName}>{formatMoney(x.amount)}</span></td>
                  <td className={s.td}><span className={s.cellText}>{PAYMENT_LABELS[x.paymentMethod]}</span></td>
                  <td className={s.td}><span className={s.cellText}>{x.vendor || '-'}</span></td>
                  <td className={s.td}><span className={s.cellText}>{x.company?.name || '-'}</span></td>
                  <td className={s.td}><span className={s.cellText}>{formatDate(x.expenseDate)}</span></td>
                  <td className={`${s.td} ${s.tdRight}`}>
                    {canManage && (
                      <>
                        <button onClick={() => openEdit(x)} className={s.editBtn}>Edit</button>
                        <button onClick={() => setDeleteTarget(x)} className={s.deleteBtn}>Delete</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className={s.pagination}>
            <button onClick={() => goToPage(page - 1)} disabled={page <= 1} className={s.pageBtn}>← Prev</button>
            <span className={s.pageInfo}>Page {page} of {totalPages} ({total} expenses)</span>
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

      {/* Delete modal */}
      {deleteTarget && (
        <div className={s.overlay}>
          <div className={s.deleteModal}>
            <h3 className={s.deleteTitle}>Delete Expense?</h3>
            <p className={s.deleteMsg}>
              Remove &quot;{deleteTarget.title}&quot; ({formatMoney(deleteTarget.amount)})? This cannot be undone.
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
