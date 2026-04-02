'use client';

import { isAxiosError } from 'axios';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { fetchCurrentUser } from '@/lib/current-user';
import { exportToExcel } from '@/lib/exportExcel';
import { Product, ProductSaleItem, User } from '@/types';
import s from './product-sales.module.scss';

type ProductSaleFormState = {
  productId: string;
  date: string;
  quantity: string;
  notes: string;
};

const initialForm = (): ProductSaleFormState => ({
  productId: '',
  date: new Date().toISOString().slice(0, 10),
  quantity: '1',
  notes: '',
});

export default function ProductSalesPage() {
  const [items, setItems] = useState<ProductSaleItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
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

  const fetchProducts = () => {
    api.get('/products?limit=1000')
      .then((res) => {
        setProducts(res.data.data || []);
      })
      .catch(() => {
        setProducts([]);
      });
  };

  const fetchData = (nextPage = page) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (productFilter) params.set('productId', productFilter);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    params.set('page', String(nextPage));
    params.set('limit', '20');

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
    fetchData();
    fetchCurrentUser().then(setCurrentUser).catch(() => {});
  }, []);

  const goToPage = (nextPage: number) => {
    setPage(nextPage);
    fetchData(nextPage);
  };

  const openCreate = () => {
    if (products.length === 0) fetchProducts();
    setEditing(null);
    setForm(initialForm());
    setError('');
    setShowInlineForm(true);
  };

  const openEdit = (item: ProductSaleItem) => {
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
      if (editing) await api.put(`/product-sales/${editing.id}`, payload);
      else await api.post('/product-sales', payload);

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
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {(currentUser?.role === 'SUPER_ADMIN' || currentUser?.canExportProductSales) && (
            <button onClick={handleExport} className={s.exportBtn}>Export Excel</button>
          )}
          <button onClick={openCreate} className={s.addBtn}>+ Add Entry</button>
        </div>
      </div>

      {!showInlineForm && (
        <div className={s.filterPanel}>
          <div className={s.filterRowPrimary}>
            <input
              type="text"
              placeholder="Search by product name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setPage(1);
                  fetchData(1);
                }
              }}
              className={s.searchInput}
            />
            <button onClick={() => { setPage(1); fetchData(1); }} className={s.searchBtn}>Search</button>
          </div>
          <div className={s.filterRowSecondary}>
            <select
              value={productFilter}
              onChange={(e) => {
                setProductFilter(e.target.value);
                setPage(1);
                setTimeout(() => fetchData(1), 0);
              }}
              className={s.select}
            >
              <option value="">All Products</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>{product.name}</option>
              ))}
            </select>
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
              <div className={s.formGroup}>
                <label>Product *</label>
                <select value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })} className={s.formSelect} required>
                  <option value="">Select product</option>
                  {products.filter((product) => product.isActive).map((product) => (
                    <option key={product.id} value={product.id}>{product.name}</option>
                  ))}
                </select>
              </div>
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
          <table className={s.table}>
            <thead className={s.thead}>
              <tr>
                <th className={s.th}>Date</th>
                <th className={s.th}>Product</th>
                <th className={s.th}>Quantity Sold</th>
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
                    <p className={s.productSub}>{item.product?.category || ''}</p>
                  </td>
                  <td className={s.td}><span className={s.quantityText}>{item.quantity}</span></td>
                  <td className={s.td}><span className={s.cellText}>{item.notes || '-'}</span></td>
                  <td className={`${s.td} ${s.tdRight}`}>
                    <button onClick={() => openEdit(item)} className={s.editBtn}>Edit</button>
                    <button onClick={() => setDeleteTarget(item)} className={s.deleteBtn}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className={s.pagination}>
              <button onClick={() => goToPage(page - 1)} disabled={page <= 1} className={s.pageBtn}>Prev</button>
              <span className={s.pageInfo}>Page {page} of {totalPages} ({total} entries)</span>
              <button onClick={() => goToPage(page + 1)} disabled={page >= totalPages} className={s.pageBtn}>Next</button>
            </div>
          )}
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
