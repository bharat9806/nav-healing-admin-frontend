'use client';

import { isAxiosError } from 'axios';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '@/lib/api';
import { fetchCurrentUser } from '@/lib/current-user';
import { PatientSaleHistoryResponse, User } from '@/types';
import s from './patient-history.module.scss';

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

type SaleItemForm = {
  productId: number;
  quantity: number;
  product?: ProductOption;
};

type RepeatVisitFormState = {
  date: string;
  therapyPrice: string;
  paymentMode: string;
  status: string;
  pendingAmount: string;
  notes: string;
};

const currency = (value: number | string) => `Rs. ${Number(value || 0).toFixed(2)}`;

const formatDate = (value?: string) => {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-CA');
};

const initialItem = (): SaleItemForm => ({
  productId: 0,
  quantity: 1,
});

const initialForm = (): RepeatVisitFormState => ({
  date: new Date().toISOString().slice(0, 10),
  therapyPrice: '',
  paymentMode: 'Cash',
  status: 'Paid',
  pendingAmount: '0',
  notes: '',
});

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

  const loadInitialResults = () => {
    setSearching(true);
    api
      .get<ProductOption[]>('/products/options?limit=10')
      .then((res) => setResults(res.data || []))
      .catch(() => setResults([]))
      .finally(() => setSearching(false));
  };

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

  const handleSelect = (product: ProductOption) => {
    onProductChange(product);
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
          if (!results.length && !searching) {
            loadInitialResults();
          }
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
          aria-label="Clear selected product"
        >
          x
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
            <span className={s.comboItemName}>No product</span>
          </li>
          {searching ? (
            <li className={s.comboEmpty}>Searching...</li>
          ) : results.length === 0 ? (
            <li className={s.comboEmpty}>No products found</li>
          ) : (
            results.map((product) => (
              <li
                key={product.id}
                className={`${s.comboItem} ${product.id === value ? s.comboItemActive : ''}`}
                onMouseDown={() => handleSelect(product)}
              >
                <span className={s.comboItemName}>{product.name}</span>
                <span className={s.comboItemSku}>{product.sku} | Rs. {Number(product.price).toFixed(2)}</span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

export default function PatientHistoryPage() {
  const params = useParams<{ patientName: string }>();
  const patientParam = typeof params?.patientName === 'string' ? params.patientName : '';
  const patientName = useMemo(() => decodeURIComponent(patientParam), [patientParam]);

  const [history, setHistory] = useState<PatientSaleHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const [showAddVisitForm, setShowAddVisitForm] = useState(false);
  const [form, setForm] = useState<RepeatVisitFormState>(initialForm());
  const [items, setItems] = useState<SaleItemForm[]>([initialItem()]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const therapyPrice = Number(form.therapyPrice || 0);
  const validItems = items.filter((item) => item.productId > 0 && item.product);
  const itemsTotal = validItems.reduce(
    (sum, item) => sum + Number(item.product?.price || 0) * item.quantity,
    0,
  );
  const computedAmount = itemsTotal + therapyPrice;
  const canManageSales = currentUser?.role === 'SUPER_ADMIN' || currentUser?.canManageSales;

  const loadHistory = useCallback(() => {
    if (!patientName) {
      setError('Patient name is missing');
      setLoading(false);
      return Promise.resolve();
    }

    setLoading(true);
    setError('');

    return api
      .get<PatientSaleHistoryResponse>(`/sales/patients/${encodeURIComponent(patientName)}/history`)
      .then((res) => setHistory(res.data))
      .catch(() => {
        setHistory(null);
        setError('Failed to load patient history');
      })
      .finally(() => setLoading(false));
  }, [patientName]);

  useEffect(() => {
    fetchCurrentUser().then(setCurrentUser).catch(() => {});
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    setForm(initialForm());
    setItems([initialItem()]);
    setSaveError('');
    setShowAddVisitForm(false);
  }, [patientName]);

  const addItem = () => setItems((current) => [...current, initialItem()]);

  const updateItem = (index: number, patch: Partial<SaleItemForm>) => {
    setItems((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    );
  };

  const removeItem = (index: number) => {
    setItems((current) =>
      current.length === 1 ? [initialItem()] : current.filter((_, itemIndex) => itemIndex !== index),
    );
  };

  const resetVisitForm = () => {
    setForm(initialForm());
    setItems([initialItem()]);
    setSaveError('');
    setShowAddVisitForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (validItems.length === 0) {
      setSaveError('Add at least one product for this visit.');
      return;
    }

    setSaving(true);
    setSaveError('');

    try {
      await api.post('/sales', {
        date: form.date,
        patientName,
        items: validItems.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
        therapyPrice: form.therapyPrice ? Number(form.therapyPrice) : undefined,
        amount: computedAmount,
        paymentMode: form.paymentMode,
        status: form.status,
        pendingAmount: Number(form.pendingAmount || 0),
        notes: form.notes || undefined,
      });

      await loadHistory();
      resetVisitForm();
    } catch (err) {
      const message = isAxiosError<{ message?: string | string[] }>(err)
        ? err.response?.data?.message
        : undefined;
      setSaveError(Array.isArray(message) ? message.join(', ') : message || 'Failed to save visit');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={s.page}>
      <div className={s.header}>
        <div>
          <Link href="/sales" className={s.backLink}>Back to Sales</Link>
          <h1 className={s.title}>{history?.patientName || patientName || 'Patient History'}</h1>
          <p className={s.subtitle}>
            See every visit from the first recorded sale to the most recently updated one.
          </p>
        </div>

        {canManageSales && !loading && history ? (
          <button
            type="button"
            className={s.primaryAction}
            onClick={() => {
              setShowAddVisitForm((current) => !current);
              setSaveError('');
            }}
          >
            {showAddVisitForm ? 'Close Form' : 'Add Repeat Visit'}
          </button>
        ) : null}
      </div>

      {loading ? (
        <div className={s.stateCard}>Loading patient history...</div>
      ) : error ? (
        <div className={s.stateCard}>{error}</div>
      ) : !history ? (
        <div className={s.stateCard}>No history found for this patient.</div>
      ) : (
        <>
          {canManageSales && showAddVisitForm ? (
            <section className={s.formCard}>
              <div className={s.formHeader}>
                <div>
                  <h2 className={s.formTitle}>Add new visit for {history.patientName}</h2>
                  <p className={s.formSubtitle}>
                    Record the date and products given to this repeat customer in one place.
                  </p>
                </div>
                <div className={s.totalBadge}>Visit Total: {currency(computedAmount)}</div>
              </div>

              <form onSubmit={handleSubmit} className={s.formLayout}>
                <div className={s.formRow}>
                  <div className={s.formGroup}>
                    <label htmlFor="visit-date">Visit Date</label>
                    <input
                      id="visit-date"
                      type="date"
                      className={s.formInput}
                      value={form.date}
                      onChange={(e) => setForm((current) => ({ ...current, date: e.target.value }))}
                      required
                    />
                  </div>

                  <div className={s.formGroup}>
                    <label htmlFor="patient-name">Customer</label>
                    <input
                      id="patient-name"
                      type="text"
                      className={s.formInput}
                      value={history.patientName}
                      readOnly
                    />
                  </div>

                  <div className={s.formGroup}>
                    <label htmlFor="therapy-price">Therapy Price</label>
                    <input
                      id="therapy-price"
                      type="number"
                      min="0"
                      step="0.01"
                      className={s.formInput}
                      value={form.therapyPrice}
                      onChange={(e) => setForm((current) => ({ ...current, therapyPrice: e.target.value }))}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className={s.productsSection}>
                  <div className={s.productsHeader}>
                    <h3 className={s.sectionTitle}>Products Given</h3>
                    <button type="button" className={s.secondaryAction} onClick={addItem}>
                      + Add Product
                    </button>
                  </div>

                  <div className={s.productEditorList}>
                    {items.map((item, index) => (
                      <div key={`visit-item-${index}`} className={s.productEditorRow}>
                        <div className={s.productField}>
                          <label>Product</label>
                          <SearchableProductSelect
                            value={item.productId}
                            selectedProduct={item.product}
                            onProductChange={(product) =>
                              updateItem(index, {
                                productId: product?.id || 0,
                                product,
                              })}
                          />
                        </div>

                        <div className={s.qtyField}>
                          <label>Qty</label>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            className={s.formInput}
                            value={item.quantity}
                            onChange={(e) =>
                              updateItem(index, {
                                quantity: Math.max(1, Number(e.target.value) || 1),
                              })}
                          />
                        </div>

                        <div className={s.pricePreview}>
                          <span className={s.metaLabel}>Line Total</span>
                          <strong className={s.lineTotal}>
                            {currency((Number(item.product?.price || 0) * item.quantity).toFixed(2))}
                          </strong>
                        </div>

                        <button
                          type="button"
                          className={s.removeItemBtn}
                          onClick={() => removeItem(index)}
                          aria-label={`Remove product row ${index + 1}`}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={s.formRow}>
                  <div className={s.formGroup}>
                    <label htmlFor="payment-mode">Payment Mode</label>
                    <select
                      id="payment-mode"
                      className={s.formInput}
                      value={form.paymentMode}
                      onChange={(e) => setForm((current) => ({ ...current, paymentMode: e.target.value }))}
                    >
                      {defaultPaymentModes.map((mode) => (
                        <option key={mode} value={mode}>{mode}</option>
                      ))}
                    </select>
                  </div>

                  <div className={s.formGroup}>
                    <label htmlFor="payment-status">Status</label>
                    <select
                      id="payment-status"
                      className={s.formInput}
                      value={form.status}
                      onChange={(e) => setForm((current) => ({ ...current, status: e.target.value }))}
                    >
                      {defaultStatuses.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </div>

                  <div className={s.formGroup}>
                    <label htmlFor="pending-amount">Pending Amount</label>
                    <input
                      id="pending-amount"
                      type="number"
                      min="0"
                      step="0.01"
                      className={s.formInput}
                      value={form.pendingAmount}
                      onChange={(e) => setForm((current) => ({ ...current, pendingAmount: e.target.value }))}
                    />
                  </div>
                </div>

                <div className={s.formGroup}>
                  <label htmlFor="visit-notes">Notes</label>
                  <textarea
                    id="visit-notes"
                    className={s.textarea}
                    value={form.notes}
                    onChange={(e) => setForm((current) => ({ ...current, notes: e.target.value }))}
                    placeholder="Add visit notes, symptoms, or follow-up context..."
                    rows={4}
                  />
                </div>

                {saveError ? <p className={s.formError}>{saveError}</p> : null}

                <div className={s.formActions}>
                  <button type="button" className={s.ghostAction} onClick={resetVisitForm}>
                    Cancel
                  </button>
                  <button type="submit" className={s.primaryAction} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Visit'}
                  </button>
                </div>
              </form>
            </section>
          ) : null}

          <div className={s.summaryGrid}>
            <div className={s.summaryCard}>
              <span className={s.summaryLabel}>First Visit</span>
              <strong className={s.summaryValue}>{formatDate(history.firstVisitDate)}</strong>
            </div>
            <div className={s.summaryCard}>
              <span className={s.summaryLabel}>Last Visit</span>
              <strong className={s.summaryValue}>{formatDate(history.lastVisitDate)}</strong>
            </div>
            <div className={s.summaryCard}>
              <span className={s.summaryLabel}>Total Visits</span>
              <strong className={s.summaryValue}>{history.totalVisits}</strong>
            </div>
            <div className={s.summaryCard}>
              <span className={s.summaryLabel}>Last Updated</span>
              <strong className={s.summaryValue}>{formatDate(history.lastUpdatedAt)}</strong>
            </div>
            <div className={s.summaryCard}>
              <span className={s.summaryLabel}>Total Amount</span>
              <strong className={s.summaryValue}>{currency(history.totalAmount)}</strong>
            </div>
            <div className={s.summaryCard}>
              <span className={s.summaryLabel}>Pending Amount</span>
              <strong className={`${s.summaryValue} ${s.pendingValue}`}>{currency(history.totalPendingAmount)}</strong>
            </div>
          </div>

          <div className={s.timeline}>
            {history.visits.map((visit, index) => (
              <article key={visit.id} className={s.visitCard}>
                <div className={s.visitHeader}>
                  <div>
                    <p className={s.visitLabel}>Visit {index + 1}</p>
                    <h2 className={s.visitDate}>{formatDate(visit.date)}</h2>
                  </div>
                  <div className={s.visitMeta}>
                    <span className={s.statusBadge}>{visit.status}</span>
                    <span className={s.amount}>{currency(visit.amount)}</span>
                  </div>
                </div>

                <div className={s.visitGrid}>
                  <div className={s.metaBlock}>
                    <span className={s.metaLabel}>Payment Mode</span>
                    <span className={s.metaValue}>{visit.paymentMode}</span>
                  </div>
                  <div className={s.metaBlock}>
                    <span className={s.metaLabel}>Pending</span>
                    <span className={`${s.metaValue} ${s.pendingText}`}>{currency(visit.pendingAmount)}</span>
                  </div>
                  <div className={s.metaBlock}>
                    <span className={s.metaLabel}>Products</span>
                    <span className={s.metaValue}>{visit.itemCount} {visit.itemCount === 1 ? 'item' : 'items'}</span>
                  </div>
                  <div className={s.metaBlock}>
                    <span className={s.metaLabel}>Updated</span>
                    <span className={s.metaValue}>{formatDate(visit.updatedAt)}</span>
                  </div>
                </div>

                <div className={s.medicineBlock}>
                  <h3 className={s.sectionTitle}>Medicines Given</h3>
                  {visit.products.length > 0 ? (
                    <div className={s.productList}>
                      {visit.products.map((product, productIndex) => (
                        <div key={`${visit.id}-${product.name}-${productIndex}`} className={s.productRow}>
                          <span className={s.productName}>{product.name}</span>
                          <span className={s.productQty}>x{product.quantity}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className={s.emptyText}>No medicines recorded for this visit.</p>
                  )}

                  {visit.therapyPrice ? (
                    <div className={s.therapyRow}>
                      <span className={s.metaLabel}>Therapy</span>
                      <span className={s.metaValue}>{currency(visit.therapyPrice)}</span>
                    </div>
                  ) : null}
                </div>

                <div className={s.notesBlock}>
                  <h3 className={s.sectionTitle}>Notes</h3>
                  <p className={s.notesText}>{visit.notes || 'No notes added for this visit.'}</p>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
