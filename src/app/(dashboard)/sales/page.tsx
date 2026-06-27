'use client';

import { isAxiosError } from 'axios';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import { fetchCurrentUser } from '@/lib/current-user';
import { exportToExcel } from '@/lib/exportExcel';
import { generateOrderInvoice } from '@/lib/generateOrderInvoice';
import { Sale, SaleItem, SaleProductsResponse, User } from '@/types';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { SkeletonList } from '@/components/ui/Loader';
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
  category: string;
  subcategory?: string;
};

type SaleFormState = {
  date: string;
  patientName: string;
  therapyPrice: string;
  discount: string;
  amount: string;
  paymentMode: string;
  status: string;
  pendingAmount: string;
  notes: string;
};

type SaleItemForm = {
  productId: number;
  quantity: number;
  product?: ProductOption;
  // Per-sale overrides. Empty string / undefined means "use the product value".
  // These never modify the master product record.
  nameOverride?: string;
  priceOverride?: string;
};

const initialItem = (): SaleItemForm => ({
  productId: 0,
  quantity: 1,
});

// Effective values for an item row, falling back to the master product.
const itemName = (item: SaleItemForm) =>
  (item.nameOverride && item.nameOverride.trim()) || item.product?.name || '';

const itemUnitPrice = (item: SaleItemForm) =>
  item.priceOverride !== undefined && item.priceOverride !== ''
    ? Number(item.priceOverride)
    : Number(item.product?.price || 0);

const initialForm = (): SaleFormState => ({
  date: new Date().toISOString().slice(0, 10),
  patientName: '',
  therapyPrice: '',
  discount: '',
  amount: '',
  paymentMode: 'Cash',
  status: 'Paid',
  pendingAmount: '0',
  notes: '',
});

const currency = (value: number | string) => `Rs. ${Number(value || 0).toFixed(2)}`;
const patientHistoryHref = (patientName: string) => `/sales/patients/${encodeURIComponent(patientName)}`;

const getSaleItems = (sale: Sale): SaleItemForm[] => {
  if (sale.items?.length) {
    return sale.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      nameOverride: item.customName ?? item.product?.name ?? '',
      priceOverride: item.unitPrice != null ? String(item.unitPrice) : '',
      product: item.product
        ? {
            id: item.product.id,
            name: item.product.name,
            sku: item.product.sku,
            price: Number(item.unitPrice || item.product.price),
            currentStock: item.product.currentStock,
            reorderLevel: item.product.reorderLevel,
            category: item.product.category,
            subcategory: item.product.subcategory,
          }
        : undefined,
    }));
  }

  if (sale.product && sale.productId) {
    return [
      {
        productId: sale.productId,
        quantity: 1,
        product: {
          id: sale.product.id,
          name: sale.product.name,
          sku: sale.product.sku,
          price: Number(sale.product.price),
          currentStock: sale.product.currentStock,
          reorderLevel: sale.product.reorderLevel,
          category: sale.product.category,
          subcategory: sale.product.subcategory,
        },
      },
    ];
  }

  return [initialItem()];
};

const getSaleProductCount = (sale: Sale) => {
  if (typeof sale.itemCount === 'number') return sale.itemCount;
  if (sale.items?.length) return sale.items.length;
  if (sale.productId) return 1;
  return 0;
};

const describeSaleItems = (sale: Sale) => {
  const count = getSaleProductCount(sale);
  return count > 0 ? `${count} ${count === 1 ? 'product' : 'products'}` : 'No product';
};

const statusClass = (status: string) => {
  const normalized = status.toLowerCase();
  if (normalized === 'pending') return `${s.statusBadge} ${s.statusPending}`;
  if (normalized === 'partial') return `${s.statusBadge} ${s.statusPartial}`;
  if (normalized === 'cancelled') return `${s.statusBadge} ${s.statusCancelled}`;
  return s.statusBadge;
};

function SearchableProductSelect({
  value,
  selectedProduct,
  onProductChange,
}: {
  value: number;
  selectedProduct: ProductOption | undefined;
  onProductChange: (product?: ProductOption) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProductOption[]>([]);
  const [searching, setSearching] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch results whenever the query changes (debounced 300ms)
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
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open]);

  // Load initial results when dropdown opens
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
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (p: ProductOption) => {
    onProductChange(p);
    setOpen(false);
    setQuery('');
  };

  return (
    <div className={s.comboWrap} ref={wrapRef}>
      <input
        ref={inputRef}
        type="text"
        className={s.formInput}
        placeholder="Search product by name or SKU..."
        value={open ? query : selectedProduct ? `${selectedProduct.name} (${selectedProduct.sku})` : ''}
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
      {value > 0 && !open && (
        <button
          type="button"
          className={s.comboClear}
          onClick={() => {
            onProductChange(undefined);
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
                onProductChange(undefined);
                setOpen(false);
                setQuery('');
              }}
            >
              <span className={s.comboItemName}>— No product —</span>
            </li>
            {searching ? (
              <li className={s.comboEmpty}>Searching...</li>
            ) : results.length === 0 ? (
              <li className={s.comboEmpty}>No products found</li>
            ) : (
              results.map((p) => (
                <li
                  key={p.id}
                  className={`${s.comboItem} ${p.id === value ? s.comboItemActive : ''}`}
                  onMouseDown={() => handleSelect(p)}
                >
                  <span className={s.comboItemName}>{p.name}</span>
                  <span className={s.comboItemSku}>{p.sku} • Rs. {Number(p.price).toFixed(2)}</span>
                </li>
              ))
            )}
          </ul>
        )}
    </div>
  );
}

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
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const [showInlineForm, setShowInlineForm] = useState(false);
  const [editing, setEditing] = useState<Sale | null>(null);
  const [showColMenu, setShowColMenu] = useState(false);
  const [openProductPopover, setOpenProductPopover] = useState<number | null>(null);
  const [saleProductsById, setSaleProductsById] = useState<Record<number, SaleProductsResponse>>({});
  const [loadingProductSaleId, setLoadingProductSaleId] = useState<number | null>(null);
  const [visibleCols, setVisibleCols] = useState({
    products: true,
    amount: true,
    paymentMode: true,
    status: true,
    pending: true,
    notes: true,
  });
  const toggleCol = (col: keyof typeof visibleCols) =>
    setVisibleCols(p => ({ ...p, [col]: !p[col] }));
  const [form, setForm] = useState<SaleFormState>(initialForm());
  const [items, setItems] = useState<SaleItemForm[]>([initialItem()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Sale | null>(null);
  const [sortField, setSortField] = useState('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const therapyPrice = Number(form.therapyPrice || 0);
  const discount = Number(form.discount || 0);
  const validItems = items.filter((item) => item.productId > 0 && item.product);
  const itemsTotal = validItems.reduce(
    (sum, item) => sum + itemUnitPrice(item) * item.quantity,
    0,
  );
  const subtotalAmount = validItems.length > 0 ? itemsTotal + therapyPrice : Number(form.amount || 0);
  const computedAmount = Math.max(0, subtotalAmount - discount);
  const summaryTotalAmount = sales.reduce((sum, sale) => sum + Number(sale.amount || 0), 0);
  const summaryPendingAmount = sales.reduce((sum, sale) => sum + Number(sale.pendingAmount || 0), 0);
  const summaryReceivedAmount = summaryTotalAmount - summaryPendingAmount;

  useEffect(() => {
    if (openProductPopover === null) return;
    const close = () => setOpenProductPopover(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [openProductPopover]);

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
    setItems([initialItem()]);
    setError('');
    setShowInlineForm(true);
  };

  const openEdit = (sale: Sale) => {
    setError('');
    api.get<Sale>(`/sales/${sale.id}`)
      .then((res) => {
        const fullSale = res.data;
        setEditing(fullSale);
        setForm({
          date: fullSale.date.slice(0, 10),
          patientName: fullSale.patientName,
          therapyPrice: fullSale.therapyPrice ? String(fullSale.therapyPrice) : '',
          discount: fullSale.discount ? String(fullSale.discount) : '',
          amount: String(fullSale.amount),
          paymentMode: fullSale.paymentMode,
          status: fullSale.status,
          pendingAmount: String(fullSale.pendingAmount),
          notes: fullSale.notes || '',
        });
        setItems(getSaleItems(fullSale));
        setShowInlineForm(true);
      })
      .catch(() => {
        setError('Failed to load sale details');
      });
  };

  const toggleProductsPopover = async (sale: Sale, event: React.MouseEvent) => {
    event.stopPropagation();

    if (openProductPopover === sale.id) {
      setOpenProductPopover(null);
      return;
    }

    setOpenProductPopover(sale.id);

    if (saleProductsById[sale.id]) {
      return;
    }

    setLoadingProductSaleId(sale.id);
    try {
      const res = await api.get<SaleProductsResponse>(`/sales/${sale.id}/products`);
      setSaleProductsById((current) => ({
        ...current,
        [sale.id]: res.data,
      }));
    } finally {
      setLoadingProductSaleId(null);
    }
  };

  const cancelForm = () => {
    setShowInlineForm(false);
    setEditing(null);
    setItems([initialItem()]);
    setError('');
  };

  const addItem = () => setItems((current) => [...current, initialItem()]);

  const updateItem = (index: number, patch: Partial<SaleItemForm>) => {
    setItems((current) =>
      current.map((item, itemIndex) => (
        itemIndex === index ? { ...item, ...patch } : item
      )),
    );
  };

  const removeItem = (index: number) => {
    setItems((current) => (
      current.length === 1 ? [initialItem()] : current.filter((_, itemIndex) => itemIndex !== index)
    ));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    const payload = {
      date: form.date,
      patientName: form.patientName,
      items: validItems.length
        ? validItems.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: itemUnitPrice(item),
            // Only send a name override when it differs from the master product.
            name:
              itemName(item) !== (item.product?.name ?? '')
                ? itemName(item)
                : undefined,
          }))
        : undefined,
      therapyPrice: form.therapyPrice ? Number(form.therapyPrice) : undefined,
      discount: discount > 0 ? discount : undefined,
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
      setItems([initialItem()]);
      fetchSales();
    } catch (err) {
      const message = isAxiosError<{ message?: string | string[] }>(err)
        ? err.response?.data?.message
        : undefined;
      setError(Array.isArray(message) ? message.join(', ') : message || 'Failed to save sale');
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
      Products: describeSaleItems(sale),
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
        <div className={s.headerActions}>
          {(currentUser?.role === 'SUPER_ADMIN' || currentUser?.canExportSales) && (
            <button onClick={handleExport} className={s.exportBtn}>Export Excel</button>
          )}
          <button onClick={openCreate} className={s.addBtn}>+ Add Sale</button>
        </div>
      </div>

      {!showInlineForm && (
        <div className={s.summaryRow}>
          <div className={s.summaryCard}>
            <span className={s.summaryLabel}>Current Sales</span>
            <strong className={s.summaryValue}>{currency(summaryTotalAmount)}</strong>
          </div>
          <div className={s.summaryCard}>
            <span className={s.summaryLabel}>Received Amount</span>
            <strong className={`${s.summaryValue} ${s.summaryValueReceived}`}>{currency(summaryReceivedAmount)}</strong>
          </div>
          <div className={s.summaryCard}>
            <span className={s.summaryLabel}>Pending Amount</span>
            <strong className={`${s.summaryValue} ${s.summaryValuePending}`}>{currency(summaryPendingAmount)}</strong>
          </div>
        </div>
      )}

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
          <div className={s.colMenuWrap}>
            <button
              type="button"
              onClick={() => setShowColMenu(p => !p)}
              className={`${s.colMenuBtn} ${showColMenu ? s.colMenuBtnActive : ''}`}
              title="Toggle columns"
            >
              Columns
            </button>
            {showColMenu && (
              <div className={s.colMenu}>
                {([
                  ['products',    'Products'],
                  ['amount',      'Amount'],
                  ['paymentMode', 'Payment Mode'],
                  ['status',      'Status'],
                  ['pending',     'Pending'],
                  ['notes',       'Notes'],
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

            <div className={s.formGroup}>
              <div className={s.itemsHeader}>
                <label>Products (optional)</label>
                <button type="button" onClick={addItem} className={s.addItemBtn}>+ Add Product</button>
              </div>
              {items.length > 0 && (
                <div className={s.itemColHeader}>
                  <span>Product</span>
                  <span className={s.itemColCenter}>Qty</span>
                  <span className={s.itemColRight}>Subtotal</span>
                  <span />
                </div>
              )}
              <div className={s.itemsList}>
                {items.map((item, index) => (
                  <div key={`${item.productId}-${index}`} className={s.itemRow}>
                    <div className={s.itemProductCell}>
                      <SearchableProductSelect
                        value={item.productId}
                        selectedProduct={item.product}
                        onProductChange={(product) => {
                          updateItem(index, {
                            productId: product?.id || 0,
                            product,
                            // Seed editable overrides from the chosen product so
                            // the inputs show its name/price, ready to be tweaked.
                            nameOverride: product ? product.name : '',
                            priceOverride: product ? String(product.price) : '',
                          });
                        }}
                      />
                      {item.product && (
                        <div className={s.itemOverrideRow}>
                          <input
                            type="text"
                            value={item.nameOverride ?? ''}
                            onChange={(e) => updateItem(index, { nameOverride: e.target.value })}
                            placeholder="Name on this sale"
                            className={s.formInput}
                            title="Name shown on this sale only — does not change the product"
                          />
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.priceOverride ?? ''}
                            onChange={(e) => updateItem(index, { priceOverride: e.target.value })}
                            placeholder="Price"
                            className={s.formInput}
                            title="Unit price for this sale only — does not change the product"
                          />
                        </div>
                      )}
                    </div>
                    <div className={s.itemQuantityCell}>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        inputMode="numeric"
                        value={item.quantity}
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (raw === '' || raw === '0') {
                            updateItem(index, { quantity: '' as unknown as number });
                          } else {
                            updateItem(index, { quantity: Math.max(1, parseInt(raw, 10) || 1) });
                          }
                        }}
                        onBlur={(e) => {
                          const val = parseInt(e.target.value, 10);
                          updateItem(index, { quantity: isNaN(val) || val < 1 ? 1 : val });
                        }}
                        className={s.formInput}
                      />
                    </div>
                    <div className={s.itemPriceCell}>
                      <span className={s.itemPriceText}>
                        {item.product ? currency(itemUnitPrice(item) * item.quantity) : '—'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className={s.removeItemBtn}
                      aria-label="Remove product"
                      title="Remove product"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className={s.grid2}>
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
              <div className={s.formGroup}>
                <label>Discount (optional)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.discount}
                  onChange={(e) => setForm({ ...form, discount: e.target.value })}
                  className={s.formInput}
                />
              </div>
            </div>

            <div className={s.amountBreakdown}>
              {validItems.map((item, index) => (
                <div key={`${item.productId}-${index}`} className={s.breakdownRow}>
                  <span>{itemName(item)} x{item.quantity}</span>
                  <span>{currency(itemUnitPrice(item) * item.quantity)}</span>
                </div>
              ))}
              {therapyPrice > 0 && (
                <div className={s.breakdownRow}>
                  <span>Therapy</span>
                  <span>{currency(therapyPrice)}</span>
                </div>
              )}
              {discount > 0 && (
                <>
                  <div className={s.breakdownRow}>
                    <span>Subtotal</span>
                    <span>{currency(subtotalAmount)}</span>
                  </div>
                  <div className={`${s.breakdownRow} ${s.breakdownDiscount}`}>
                    <span>Discount</span>
                    <span>- {currency(discount)}</span>
                  </div>
                </>
              )}
              <div className={`${s.breakdownRow} ${s.breakdownTotal}`}>
                <span>Total Amount</span>
                <span>{currency(computedAmount)}</span>
              </div>
              {validItems.length === 0 && (
                <div className={s.formGroup}>
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
                  fullWidth
                />
              </div>
              <div className={s.formGroup}>
                <label>Status *</label>
                <CustomSelect
                  options={[...new Set([...defaultStatuses, ...statuses])].map((st) => ({ label: st, value: st }))}
                  value={form.status}
                  onChange={(val) => setForm({ ...form, status: String(val) })}
                  align="left"
                  fullWidth
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
                type="button"
                className={s.invoiceBtn}
                disabled={!form.patientName.trim()}
                onClick={() => {
                  // Same TAX-INVOICE format as leads/website orders.
                  const invItems = validItems.map((it) => ({
                    name: itemName(it),
                    qty: it.quantity,
                    unitPrice: itemUnitPrice(it),
                  }));
                  // Therapy / consultation becomes a line item so it's taxed and shown like any product.
                  if (therapyPrice > 0) {
                    invItems.push({ name: 'Therapy / Consultation', qty: 1, unitPrice: therapyPrice });
                  }
                  const year = new Date(form.date).getFullYear();
                  const invoiceNumber = editing
                    ? `NNH-${year}-${String(editing.id).padStart(3, '0')}`
                    : `NNH-${year}-${String(Math.floor(1000 + Math.random() * 9000))}`;
                  generateOrderInvoice({
                    invoiceNumber,
                    date: form.date,
                    customerName: form.patientName,
                    paymentMethod: form.paymentMode,
                    items: invItems,
                    subtotal: subtotalAmount,
                    discountAmount: discount || undefined,
                    discountLabel: discount > 0 ? 'Discount' : undefined,
                    totalAmount: computedAmount,
                  });
                }}
              >
                ↓ Download Invoice
              </button>
              <button
                type="submit"
                disabled={saving || (!validItems.length && !form.amount)}
                className={s.saveBtn}
              >
                {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}

      {!showInlineForm && (loading ? (
        <SkeletonList rows={5} />
      ) : sales.length === 0 ? (
        <div className={s.emptyBox}>
          <div className={s.emptyText}>No sales found</div>
        </div>
      ) : (
        <div className={s.tableWrap}>
          <div className={s.mobileList}>
            {sales.map((sale) => (
              <article key={`mobile-${sale.id}`} className={s.mobileCard}>
                <div className={s.mobileCardTop}>
                  <div className={s.mobileCardHeader}>
                    <div>
                      <Link href={patientHistoryHref(sale.patientName)} className={s.patientLink}>
                        {sale.patientName}
                      </Link>
                      <p className={s.noteText}>{sale.date.slice(0, 10)}</p>
                    </div>
                    <span className={statusClass(sale.status)}>{sale.status}</span>
                  </div>

                  <div className={s.mobileAmountRow}>
                    <span className={s.amountText}>{currency(sale.amount)}</span>
                    <span className={s.pendingText}>Pending {currency(sale.pendingAmount)}</span>
                  </div>
                </div>

                <div className={s.mobileMetaGrid}>
                  <div className={s.mobileMetaItem}>
                    <span className={s.mobileMetaLabel}>Payment</span>
                    <span className={s.cellText}>{sale.paymentMode}</span>
                  </div>
                  <div className={s.mobileMetaItem}>
                    <span className={s.mobileMetaLabel}>Products</span>
                    <span className={s.cellText}>{describeSaleItems(sale)}</span>
                  </div>
                </div>

                {((sale.items?.length ?? 0) > 0 || sale.product) && (
                  <div className={s.mobileProductBlock}>
                    {((sale.items?.length ?? 0) > 0
                      ? sale.items ?? []
                      : [{
                          id: 0,
                          saleId: sale.id,
                          productId: sale.productId || 0,
                          quantity: 1,
                          unitPrice: sale.product?.price || 0,
                          product: sale.product,
                        } as SaleItem]
                    ).map((item, index) => (
                      <p key={`${sale.id}-${item.productId}-${index}`} className={index === 0 ? s.productName : s.productSub}>
                        {item.customName || item.product?.name || `Product #${item.productId}`} x{item.quantity}
                      </p>
                    ))}
                    {sale.therapyPrice ? <p className={s.productSub}>Therapy: {currency(sale.therapyPrice)}</p> : null}
                      {sale.therapyPrice ? ` • Therapy: ${currency(sale.therapyPrice)}` : ''}
                  </div>
                )}

                <div className={s.mobileNotes}>
                  <span className={s.mobileMetaLabel}>Notes</span>
                  <span className={s.cellText}>{sale.notes || '-'}</span>
                </div>

                <div className={s.mobileActions}>
                  <button onClick={() => openEdit(sale)} className={s.mobileEditBtn}>Edit</button>
                  <button onClick={() => setDeleteTarget(sale)} className={s.mobileDeleteBtn}>Delete</button>
                </div>
              </article>
            ))}
          </div>

          <table className={s.table}>
            <thead className={s.thead}>
              <tr>
                <th className={`${s.th} ${s.thSortable}`} onClick={() => handleSort('date')}>Date{sortField === 'date' ? (sortOrder === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</th>
                <th className={`${s.th} ${s.thSortable}`} onClick={() => handleSort('patientName')}>Patient Name{sortField === 'patientName' ? (sortOrder === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</th>
                {visibleCols.products    && <th className={s.th}>Products</th>}
                {visibleCols.amount      && <th className={`${s.th} ${s.thSortable}`} onClick={() => handleSort('amount')}>Amount{sortField === 'amount' ? (sortOrder === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</th>}
                {visibleCols.paymentMode && <th className={`${s.th} ${s.thSortable}`} onClick={() => handleSort('paymentMode')}>Payment Mode{sortField === 'paymentMode' ? (sortOrder === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</th>}
                {visibleCols.status      && <th className={`${s.th} ${s.thSortable}`} onClick={() => handleSort('status')}>Status{sortField === 'status' ? (sortOrder === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</th>}
                {visibleCols.pending     && <th className={s.th}>Pending</th>}
                {visibleCols.notes       && <th className={s.th}>Notes</th>}
                <th className={`${s.th} ${s.thRight}`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((sale) => (
                <tr key={sale.id} className={s.tr}>
                  <td className={s.td}><span className={s.cellText}>{sale.date.slice(0, 10)}</span></td>
                  <td className={s.td}>
                    <Link href={patientHistoryHref(sale.patientName)} className={s.patientLink}>
                      {sale.patientName}
                    </Link>
                  </td>
                  {visibleCols.products && <td className={s.td}>
                    {(() => {
                      const itemCount = getSaleProductCount(sale);
                      const saleProducts = saleProductsById[sale.id];
                      const isLoadingProducts = loadingProductSaleId === sale.id;
                      const allItems: { name: string; qty: number }[] = saleProducts
                        ? [
                            ...saleProducts.products.map((item) => ({
                              name: item.name,
                              qty: item.quantity,
                            })),
                            ...(saleProducts.therapyPrice ? [{ name: 'Therapy', qty: 0 }] : []),
                          ]
                        : Array.from({ length: itemCount }, () => ({ name: 'Loading...', qty: 0 }));


                      if (allItems.length === 0) return <span className={s.cellText}>—</span>;

                      const isOpen = openProductPopover === sale.id;
                      return (
                        <div className={s.productPopoverWrap}>
                          <button
                            type="button"
                            className={`${s.productBadge} ${isOpen ? s.productBadgeActive : ''}`}
                            onClick={(e) => void toggleProductsPopover(sale, e)}
                          >
                            {itemCount} {itemCount === 1 ? 'product' : 'products'}
                            <span className={s.productBadgeArrow}>⌄</span>
                          </button>
                          {isOpen && (
                            <div className={s.productPopover} onClick={e => e.stopPropagation()}>
                              <p className={s.productPopoverTitle}>Products</p>
                              {isLoadingProducts ? (
                                <div className={s.productPopoverItem}>
                                  <span className={s.productPopoverName}>Loading...</span>
                                </div>
                              ) : allItems.map((item, i) => (
                                <div key={i} className={s.productPopoverItem}>
                                  <span className={s.productPopoverName}>{item.name}</span>
                                  {item.qty > 0 && <span className={s.productPopoverQty}>×{item.qty}</span>}
                                  {item.qty === 0 && saleProducts?.therapyPrice && <span className={s.productPopoverQty}>{currency(saleProducts.therapyPrice)}</span>}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </td>}
                  {visibleCols.amount      && <td className={s.td}><span className={s.amountText}>{currency(sale.amount)}</span></td>}
                  {visibleCols.paymentMode && <td className={s.td}><span className={s.cellText}>{sale.paymentMode}</span></td>}
                  {visibleCols.status      && <td className={s.td}><span className={statusClass(sale.status)}>{sale.status}</span></td>}
                  {visibleCols.pending     && <td className={s.td}><span className={s.pendingText}>{currency(sale.pendingAmount)}</span></td>}
                  {visibleCols.notes       && <td className={s.td}><span className={s.cellText}>{sale.notes || '—'}</span></td>}
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
