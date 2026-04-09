'use client';

import { isAxiosError } from 'axios';
import { useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import { fetchCurrentUser } from '@/lib/current-user';
import { exportToExcel } from '@/lib/exportExcel';
import { Sale, User } from '@/types';
import { CustomSelect } from '@/components/ui/CustomSelect';
import s from './sales.module.scss';

const defaultPaymentModes = ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Cheque'];
const defaultStatuses = ['Paid', 'Pending', 'Partial', 'Cancelled'];

type ProductOption = {
  id: number;
  name: string;
  sku: string;
  price: number;
  currentStock: number;
  reorderLevel: number;
};

type SaleFormState = {
  date: string;
  patientName: string;
  productId: string;
  therapyPrice: string;
  amount: string;
  paymentMode: string;
  status: string;
  pendingAmount: string;
  notes: string;
};

const initialForm = (): SaleFormState => ({
  date: new Date().toISOString().slice(0, 10),
  patientName: '',
  productId: '',
  therapyPrice: '',
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

function SearchableProductSelect({
  products,
  value,
  onChange,
}: {
  products: ProductOption[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = products.find((p) => String(p.id) === value);
  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.sku.toLowerCase().includes(query.toLowerCase()),
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className={s.formGroup} ref={wrapRef}>
      <label>Product (optional)</label>
      <div className={s.comboWrap}>
        <input
          ref={inputRef}
          type="text"
          className={s.formInput}
          placeholder="Search product..."
          value={open ? query : selected ? `${selected.name} (${selected.sku})` : ''}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            setQuery('');
          }}
          autoComplete="off"
        />
        {value && !open && (
          <button
            type="button"
            className={s.comboClear}
            onClick={() => {
              onChange('');
              setQuery('');
              setOpen(true);
              inputRef.current?.focus();
            }}
          >
            ✕
          </button>
        )}
        {open && (
          <ul className={s.comboList}>
            <li
              className={s.comboItem}
              onMouseDown={() => {
                onChange('');
                setOpen(false);
                setQuery('');
              }}
            >
              <span className={s.comboItemName}>— No product —</span>
            </li>
            {filtered.length === 0 ? (
              <li className={s.comboEmpty}>No products found</li>
            ) : (
              filtered.map((p) => (
                <li
                  key={p.id}
                  className={`${s.comboItem} ${String(p.id) === value ? s.comboItemActive : ''}`}
                  onMouseDown={() => {
                    onChange(String(p.id));
                    setOpen(false);
                    setQuery('');
                  }}
                >
                  <span className={s.comboItemName}>{p.name}</span>
                  <span className={s.comboItemSku}>{p.sku} • Rs. {Number(p.price).toFixed(2)}</span>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [search, setSearch] = useState('');
  const [paymentModeFilter, setPaymentModeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [paymentModes, setPaymentModes] = useState<string[]>(defaultPaymentModes);
  const [statuses, setStatuses] = useState<string[]>(defaultStatuses);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
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
  const [sortField, setSortField] = useState('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Derived: selected product and computed amount
  const selectedProduct = products.find((p) => String(p.id) === form.productId);
  const productPrice = selectedProduct ? Number(selectedProduct.price) : 0;
  const therapyPrice = Number(form.therapyPrice || 0);
  const computedAmount = selectedProduct
    ? productPrice + therapyPrice
    : Number(form.amount || 0);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const fetchSales = (nextPage = page, nextPageSize = pageSize) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (paymentModeFilter) params.set('paymentMode', paymentModeFilter);
    if (statusFilter) params.set('status', statusFilter);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    params.set('page', String(nextPage));
    params.set('limit', String(nextPageSize));
    params.set('sortBy', sortField);
    params.set('order', sortOrder);

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
    api.get('/products/options').then((res) => setProducts(res.data || [])).catch(() => {});
    api.get('/sales/filters')
      .then((res) => {
        if (res.data.paymentModes?.length) setPaymentModes(res.data.paymentModes);
        if (res.data.statuses?.length) setStatuses(res.data.statuses);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchSales(page);
  }, [paymentModeFilter, statusFilter, dateFrom, dateTo, page, pageSize, sortField, sortOrder]);

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
      productId: sale.productId ? String(sale.productId) : '',
      therapyPrice: sale.therapyPrice ? String(sale.therapyPrice) : '',
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
      productId: form.productId ? Number(form.productId) : undefined,
      therapyPrice: form.therapyPrice ? Number(form.therapyPrice) : undefined,
      amount: computedAmount,
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
      Product: sale.product?.name || '',
      'Product Price': sale.product ? Number(sale.product.price).toFixed(2) : '',
      'Therapy Price': sale.therapyPrice ? Number(sale.therapyPrice).toFixed(2) : '',
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
          <CustomSelect
            options={[{ label: 'All Payment Modes', value: '' }, ...paymentModes.map((m) => ({ label: m, value: m }))]}
            value={paymentModeFilter}
            onChange={(val) => { setPaymentModeFilter(String(val)); setPage(1); }}
            align="left"
            minWidth="11rem"
          />
          <CustomSelect
            options={[{ label: 'All Statuses', value: '' }, ...statuses.map((st) => ({ label: st, value: st }))]}
            value={statusFilter}
            onChange={(val) => { setStatusFilter(String(val)); setPage(1); }}
            align="left"
            minWidth="9rem"
          />
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

            {/* Row 1: Date + Patient */}
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

            {/* Row 2: Product + Therapy Price */}
            <div className={s.grid2}>
              <SearchableProductSelect
                products={products}
                value={form.productId}
                onChange={(id) => setForm({ ...form, productId: id })}
              />
              <div className={s.formGroup}>
                <label>Therapy Price (optional)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.therapyPrice}
                  onChange={(e) => setForm({ ...form, therapyPrice: e.target.value })}
                  className={s.formInput}
                />
              </div>
            </div>

            {/* Amount breakdown */}
            <div className={s.amountBreakdown}>
              {selectedProduct && (
                <div className={s.breakdownRow}>
                  <span>Product ({selectedProduct.name})</span>
                  <span>{currency(productPrice)}</span>
                </div>
              )}
              {therapyPrice > 0 && (
                <div className={s.breakdownRow}>
                  <span>Therapy</span>
                  <span>{currency(therapyPrice)}</span>
                </div>
              )}
              <div className={`${s.breakdownRow} ${s.breakdownTotal}`}>
                <span>Total Amount</span>
                <span>{currency(computedAmount)}</span>
              </div>
              {!selectedProduct && (
                <div className={s.formGroup} style={{ marginTop: '0.5rem' }}>
                  <label>Amount * <small>(enter manually — no product selected)</small></label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    className={s.formInput}
                  />
                </div>
              )}
            </div>

            {/* Row 3: Payment Mode + Status */}
            <div className={s.grid2}>
              <div className={s.formGroup}>
                <label>Payment Mode *</label>
                <CustomSelect
                  options={[...new Set([...defaultPaymentModes, ...paymentModes])].map((m) => ({ label: m, value: m }))}
                  value={form.paymentMode}
                  onChange={(val) => setForm({ ...form, paymentMode: String(val) })}
                  align="left"
                  minWidth="100%"
                />
              </div>
              <div className={s.formGroup}>
                <label>Status *</label>
                <CustomSelect
                  options={[...new Set([...defaultStatuses, ...statuses])].map((st) => ({ label: st, value: st }))}
                  value={form.status}
                  onChange={(val) => setForm({ ...form, status: String(val) })}
                  align="left"
                  minWidth="100%"
                />
              </div>
            </div>

            {/* Pending Amount */}
            <div className={s.formGroup}>
              <label>Pending Amount</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.pendingAmount}
                onChange={(e) => setForm({ ...form, pendingAmount: e.target.value })}
                className={s.formInput}
              />
            </div>

            <div className={s.formGroup}>
              <label>Notes</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} className={s.formTextarea} />
            </div>

            <div className={s.formActions}>
              <button type="button" onClick={cancelForm} className={s.cancelBtn}>Cancel</button>
              <button
                type="submit"
                disabled={saving || (!selectedProduct && !form.amount)}
                className={s.saveBtn}
              >
                {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
              </button>
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
                <th className={`${s.th} ${s.thSortable}`} onClick={() => handleSort('date')}>Date{sortField === 'date' ? (sortOrder === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</th>
                <th className={`${s.th} ${s.thSortable}`} onClick={() => handleSort('patientName')}>Patient Name{sortField === 'patientName' ? (sortOrder === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</th>
                <th className={s.th}>Product</th>
                <th className={`${s.th} ${s.thSortable}`} onClick={() => handleSort('amount')}>Amount{sortField === 'amount' ? (sortOrder === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</th>
                <th className={`${s.th} ${s.thSortable}`} onClick={() => handleSort('paymentMode')}>Payment Mode{sortField === 'paymentMode' ? (sortOrder === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</th>
                <th className={`${s.th} ${s.thSortable}`} onClick={() => handleSort('status')}>Status{sortField === 'status' ? (sortOrder === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</th>
                <th className={s.th}>Pending</th>
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
                  <td className={s.td}>
                    {sale.product ? (
                      <>
                        <p className={s.productName}>{sale.product.name}</p>
                        <p className={s.productSub}>{sale.product.sku}{sale.therapyPrice ? ` + Therapy: ${currency(sale.therapyPrice)}` : ''}</p>
                      </>
                    ) : (
                      <span className={s.cellText}>—</span>
                    )}
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

          <div className={s.pagination}>
            <button onClick={() => goToPage(page - 1)} disabled={page <= 1} className={s.pageBtn}>
              Prev
            </button>
            <span className={s.pageInfo}>Page {page} of {totalPages} ({total} sales)</span>
            <button onClick={() => goToPage(page + 1)} disabled={page >= totalPages} className={s.pageBtn}>
              Next
            </button>
            <CustomSelect
              options={[10, 20, 30, 50].map((n) => ({ label: `${n} / page`, value: n }))}
              value={pageSize}
              onChange={(val) => {
                const next = Number(val);
                setPageSize(next);
                setPage(1);
                fetchSales(1, next);
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
