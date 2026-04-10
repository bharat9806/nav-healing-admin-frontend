'use client';

import { isAxiosError } from 'axios';
import { useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import { fetchCurrentUser } from '@/lib/current-user';
import { exportToExcel } from '@/lib/exportExcel';
import { Product, ProductSaleItem, User } from '@/types';
import { CustomSelect } from '@/components/ui/CustomSelect';
import s from './product-sales.module.scss';

type ProductSaleFormState = {
  productId: string;
  date: string;
  quantity: string;
  notes: string;
};

type ProductLookupSelectProps = {
  products: Product[];
  value: string;
  onChange: (id: string) => void;
  onSearch: (query?: string) => void;
  loading: boolean;
  placeholder: string;
  label?: string;
  required?: boolean;
  emptyOptionLabel?: string;
  inputClassName?: string;
};

const initialForm = (): ProductSaleFormState => ({
  productId: '',
  date: new Date().toISOString().slice(0, 10),
  quantity: '1',
  notes: '',
});

function ProductLookupSelect({
  products,
  value,
  onChange,
  onSearch,
  loading,
  placeholder,
  label,
  required,
  emptyOptionLabel,
  inputClassName,
}: ProductLookupSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = products.find((product) => String(product.id) === value);
  const closedValue = value
    ? selected
      ? `${selected.name} (${selected.sku})`
      : ''
    : emptyOptionLabel || '';
  const showSearchAction = open && query.trim().length > 0;

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

  const handleSearch = () => {
    onSearch(query.trim() || undefined);
  };

  return (
    <div className={`${s.formGroup} ${!label ? s.formGroupCompact : ''}`} ref={wrapRef}>
      {label && <label>{label}{required ? ' *' : ''}</label>}
      <div className={s.comboWrap}>
        <input
          ref={inputRef}
          type="text"
          className={`${inputClassName || s.formInput} ${s.comboInput}`}
          placeholder={placeholder}
          value={open ? query : closedValue}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) {
              setOpen(true);
            }
          }}
          onFocus={() => {
            setOpen(true);
            if (!products.length) {
              onSearch();
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (showSearchAction) {
                handleSearch();
              }
            }
          }}
          required={required && !value}
          autoComplete="off"
        />

        {showSearchAction && (
          <button
            type="button"
            className={s.comboSearchBtn}
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleSearch}
            aria-label="Search products"
          >
            <SearchIcon />
          </button>
        )}

        {!showSearchAction && value && (
          <button
            type="button"
            className={s.comboClear}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onChange('');
              setQuery('');
              setOpen(true);
              inputRef.current?.focus();
              onSearch();
            }}
            aria-label="Clear selected product"
          >
            x
          </button>
        )}

        {open && (
          <ul className={s.comboList}>
            {emptyOptionLabel && (
              <li
                className={`${s.comboItem} ${value === '' ? s.comboItemActive : ''}`}
                onMouseDown={() => {
                  onChange('');
                  setOpen(false);
                  setQuery('');
                }}
              >
                <span className={s.comboItemName}>{emptyOptionLabel}</span>
              </li>
            )}

            {loading ? (
              <li className={s.comboEmpty}>Loading products...</li>
            ) : showSearchAction ? (
              <li className={s.comboHint}>Click the search button to fetch matching products</li>
            ) : products.length === 0 ? (
              <li className={s.comboEmpty}>No products found</li>
            ) : (
              products.map((product) => (
                <li
                  key={product.id}
                  className={`${s.comboItem} ${String(product.id) === value ? s.comboItemActive : ''}`}
                  onMouseDown={() => {
                    onChange(String(product.id));
                    setOpen(false);
                    setQuery('');
                  }}
                >
                  <span className={s.comboItemName}>{product.name}</span>
                  <span className={s.comboItemSku}>{product.sku} | Stock: {product.currentStock}</span>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function mergeProductLists(existing: Product[], incoming: Product[]) {
  const byId = new Map<number, Product>();

  for (const product of existing) {
    byId.set(product.id, product);
  }

  for (const product of incoming) {
    byId.set(product.id, product);
  }

  return Array.from(byId.values());
}

export default function ProductSalesPage() {
  const [items, setItems] = useState<ProductSaleItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const [showInlineForm, setShowInlineForm] = useState(false);
  const [editing, setEditing] = useState<ProductSaleItem | null>(null);
  const [form, setForm] = useState<ProductSaleFormState>(initialForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ProductSaleItem | null>(null);
  const [sortField, setSortField] = useState('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const selectedProduct = products.find((product) => String(product.id) === form.productId);

  const fetchProducts = (query?: string) => {
    setProductsLoading(true);

    const params = new URLSearchParams();
    params.set('limit', '10');
    if (query?.trim()) {
      params.set('search', query.trim());
    }

    return api.get(`/products/options?${params.toString()}`)
      .then((res) => {
        const nextProducts = (res.data || []) as Product[];
        setProducts((prev) => mergeProductLists(prev, nextProducts));
      })
      .catch(() => {
        if (!products.length) {
          setProducts([]);
        }
      })
      .finally(() => {
        setProductsLoading(false);
      });
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder((current) => current === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const fetchData = (nextPage = page, nextPageSize = pageSize) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (productFilter) params.set('productId', productFilter);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    params.set('page', String(nextPage));
    params.set('limit', String(nextPageSize));
    params.set('sortBy', sortField);
    params.set('order', sortOrder);

    api.get(`/product-sales?${params.toString()}`)
      .then((salesRes) => {
        setItems(salesRes.data.data);
        setTotalPages(salesRes.data.meta.totalPages);
        setTotal(salesRes.data.meta.total);
      })
      .catch(() => {
        setItems([]);
        setTotalPages(1);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchProducts();
    fetchCurrentUser().then(setCurrentUser).catch(() => {});
  }, []);

  useEffect(() => {
    fetchData(page);
  }, [productFilter, dateFrom, dateTo, page, pageSize, sortField, sortOrder]);

  const goToPage = (nextPage: number) => {
    setPage(nextPage);
  };

  const openCreate = () => {
    if (products.length === 0) {
      fetchProducts();
    }
    setEditing(null);
    setForm(initialForm());
    setError('');
    setShowInlineForm(true);
  };

  const openEdit = (item: ProductSaleItem) => {
    if (item.product) {
      setProducts((prev) => mergeProductLists(prev, [item.product as Product]));
    }

    setEditing(item);
    setForm({
      productId: String(item.productId),
      date: item.date.slice(0, 10),
      quantity: String(item.quantity),
      notes: item.notes || '',
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
      productId: Number(form.productId),
      date: form.date,
      quantity: Number(form.quantity),
      notes: form.notes || undefined,
    };

    try {
      if (editing) {
        await api.put(`/product-sales/${editing.id}`, payload);
      } else {
        await api.post('/product-sales', payload);
      }

      setShowInlineForm(false);
      setEditing(null);
      fetchData();
    } catch (err) {
      const message = isAxiosError<{ message?: string }>(err)
        ? err.response?.data?.message
        : undefined;
      setError(message || 'Failed to save product sale');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await api.delete(`/product-sales/${deleteTarget.id}`);
    setDeleteTarget(null);
    fetchData();
  };

  const handleExport = async () => {
    if (currentUser && currentUser.role !== 'SUPER_ADMIN' && !currentUser.canExportProductSales) return;

    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (productFilter) params.set('productId', productFilter);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    params.set('limit', '10000');

    const res = await api.get(`/product-sales?${params.toString()}`);
    const rows = (res.data.data as ProductSaleItem[]).map((item) => ({
      Date: item.date.slice(0, 10),
      Product: item.product?.name || item.productId,
      Category: item.product?.category || '',
      Quantity: item.quantity,
      Notes: item.notes || '',
      'Created At': new Date(item.createdAt).toLocaleDateString(),
    }));

    exportToExcel(rows, `product_sales_${new Date().toISOString().slice(0, 10)}`);
  };

  return (
    <div className={s.page}>
      <div className={s.header}>
        <h1 className={s.pageTitle}>Product Sales</h1>
        <div className={s.headerActions}>
          {(currentUser?.role === 'SUPER_ADMIN' || currentUser?.canExportProductSales) && (
            <button onClick={handleExport} className={s.exportBtn}>Export Excel</button>
          )}
          <button onClick={openCreate} className={s.addBtn}>+ Add Entry</button>
        </div>
      </div>

      {!showInlineForm && (
        <div className={s.filterPanel}>
          <div className={s.filterRow}>
            <div className={s.searchWrapper}>
              <input
                type="text"
                placeholder="Search by product name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (page === 1) fetchData(1); else setPage(1);
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
                    if (page === 1) fetchData(1); else setPage(1);
                  }}
                  aria-label="Clear search"
                >
                  x
                </button>
              )}
            </div>
            <button onClick={() => { if (page === 1) fetchData(1); else setPage(1); }} className={s.searchBtn}>Search</button>
            <ProductLookupSelect
              products={products}
              value={productFilter}
              onChange={(id) => {
                setProductFilter(id);
                setPage(1);
              }}
              onSearch={fetchProducts}
              loading={productsLoading}
              placeholder="All Products"
              emptyOptionLabel="All Products"
              inputClassName={s.filterProductInput}
            />
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={s.dateInput} />
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={s.dateInput} />
          </div>
        </div>
      )}

      {showInlineForm && (
        <div className={s.inlineFormWrap}>
          <form onSubmit={handleSubmit} className={s.inlineForm}>
            <h2 className={s.inlineFormTitle}>{editing ? 'Edit Product Sale' : 'New Product Sale'}</h2>
            {error && <div className={s.error}>{error}</div>}

            <div className={s.grid2}>
              <ProductLookupSelect
                products={products}
                value={form.productId}
                onChange={(id) => setForm({ ...form, productId: id })}
                onSearch={fetchProducts}
                loading={productsLoading}
                placeholder="Search product..."
                label="Product"
                required
              />

              <div className={s.formGroup}>
                <label>Date *</label>
                <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={s.formInput} required />
              </div>
            </div>

            <div className={s.grid2}>
              <div className={s.formGroup}>
                <label>Quantity *</label>
                <input type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className={s.formInput} required />
              </div>
              <div className={s.formGroup}>
                <label>Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className={s.formTextarea} />
              </div>
            </div>

            {selectedProduct && (
              <div className={s.stockHint}>
                <strong>{selectedProduct.name}</strong> stock: {selectedProduct.currentStock}. Reorder level: {selectedProduct.reorderLevel}.
              </div>
            )}

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
      ) : items.length === 0 ? (
        <div className={s.emptyBox}>
          <div className={s.emptyText}>No product sales found</div>
        </div>
      ) : (
        <div className={s.tableWrap}>
          <div className={s.mobileList}>
            {items.map((item) => (
              <article key={`mobile-${item.id}`} className={s.mobileCard}>
                <div className={s.mobileCardTop}>
                  <div className={s.mobileCardHeader}>
                    <div>
                      <p className={s.productName}>{item.product?.name || '-'}</p>
                      <p className={s.productSub}>
                        {new Date(item.date).toLocaleDateString('en-GB')}
                        {item.product?.sku ? ` | ${item.product.sku}` : ''}
                      </p>
                    </div>
                    <span className={s.quantityBadge}>{item.quantity} sold</span>
                  </div>
                  {item.product?.category && (
                    <span className={s.mobileCategory}>{item.product.category}</span>
                  )}
                </div>

                <div className={s.mobileMetaGrid}>
                  <div className={s.mobileMetaItem}>
                    <span className={s.mobileMetaLabel}>Stock Left</span>
                    <span className={s.cellText}>{item.product?.currentStock ?? '-'}</span>
                  </div>
                  <div className={s.mobileMetaItem}>
                    <span className={s.mobileMetaLabel}>Created</span>
                    <span className={s.cellText}>{new Date(item.createdAt).toLocaleDateString('en-GB')}</span>
                  </div>
                </div>

                <div className={s.mobileNotes}>
                  <span className={s.mobileMetaLabel}>Notes</span>
                  <span className={s.cellText}>{item.notes || '-'}</span>
                </div>

                <div className={s.mobileActions}>
                  <button onClick={() => openEdit(item)} className={s.mobileEditBtn}>Edit</button>
                  <button onClick={() => setDeleteTarget(item)} className={s.mobileDeleteBtn}>Delete</button>
                </div>
              </article>
            ))}
          </div>

          <table className={s.table}>
            <thead className={s.thead}>
              <tr>
                <th className={`${s.th} ${s.thSortable}`} onClick={() => handleSort('date')}>Date{sortField === 'date' ? (sortOrder === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</th>
                <th className={s.th}>Product</th>
                <th className={`${s.th} ${s.thSortable}`} onClick={() => handleSort('quantity')}>Quantity Sold{sortField === 'quantity' ? (sortOrder === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</th>
                <th className={s.th}>Stock Left</th>
                <th className={s.th}>Notes</th>
                <th className={`${s.th} ${s.thRight}`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className={s.tr}>
                  <td className={s.td}><span className={s.cellText}>{new Date(item.date).toLocaleDateString('en-GB')}</span></td>
                  <td className={s.td}>
                    <p className={s.productName}>{item.product?.name || '-'}</p>
                    <p className={s.productSub}>{item.product?.sku || ''} {item.product?.category ? `| ${item.product.category}` : ''}</p>
                  </td>
                  <td className={s.td}><span className={s.quantityText}>{item.quantity}</span></td>
                  <td className={s.td}><span className={s.cellText}>{item.product?.currentStock ?? '-'}</span></td>
                  <td className={s.td}><span className={s.cellText}>{item.notes || '-'}</span></td>
                  <td className={`${s.td} ${s.tdRight}`}>
                    <button onClick={() => openEdit(item)} className={s.editBtn}>Edit</button>
                    <button onClick={() => setDeleteTarget(item)} className={s.deleteBtn}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className={s.pagination}>
            <button onClick={() => goToPage(page - 1)} disabled={page <= 1} className={s.pageBtn}>Prev</button>
            <span className={s.pageInfo}>Page {page} of {totalPages} ({total} entries)</span>
            <button onClick={() => goToPage(page + 1)} disabled={page >= totalPages} className={s.pageBtn}>Next</button>
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
            <h3 className={s.deleteTitle}>Delete Entry</h3>
            <p className={s.deleteMsg}>Delete this product sale entry for "{deleteTarget.product?.name || 'product'}"?</p>
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
