'use client';

import { isAxiosError } from 'axios';
import { useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import api from '@/lib/api';
import { fetchCurrentUser } from '@/lib/current-user';
import { exportToExcel } from '@/lib/exportExcel';
import { Product, User } from '@/types';
import s from './products.module.scss';

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:4000';
const categories = ['Herbs', 'Oils', 'Powders', 'Capsules', 'Drops', 'Other'];

type ProductFormState = {
  sku: string;
  name: string;
  description: string;
  price: string;
  category: string;
  isActive: boolean;
  currentStock: string;
  reorderLevel: string;
};

type ProductFormProps = {
  editing: Product | null;
  error: string;
  form: ProductFormState;
  imagePreview: string;
  saving: boolean;
  onSubmit: (e: React.FormEvent) => Promise<void>;
  onCancel: () => void;
  onFormChange: (next: ProductFormState) => void;
  onImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

function ProductForm({
  editing,
  error,
  form,
  imagePreview,
  saving,
  onSubmit,
  onCancel,
  onFormChange,
  onImageChange,
}: ProductFormProps) {
  return (
    <form onSubmit={onSubmit} className={s.inlineForm}>
      <h2 className={s.inlineFormTitle}>{editing ? 'Edit Product' : 'New Product'}</h2>
      {error && <div className={s.error}>{error}</div>}
      <div className={s.grid2}>
        <div className={s.formGroup}>
          <label>SKU / Product Code</label>
          <input
            type="text"
            value={form.sku}
            onChange={(e) => onFormChange({ ...form, sku: e.target.value.toUpperCase() })}
            className={s.formInput}
            placeholder="Auto-generated if left blank"
          />
        </div>
        <div className={s.formGroup}>
          <label>Category *</label>
          <select
            value={form.category}
            onChange={(e) => onFormChange({ ...form, category: e.target.value })}
            className={s.formSelect}
          >
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div className={s.formGroup}>
        <label>Name *</label>
        <input
          type="text"
          required
          value={form.name}
          onChange={(e) => onFormChange({ ...form, name: e.target.value })}
          className={s.formInput}
        />
      </div>
      <div className={s.formGroup}>
        <label>Description</label>
        <textarea
          value={form.description}
          onChange={(e) => onFormChange({ ...form, description: e.target.value })}
          rows={2}
          className={s.formTextarea}
        />
      </div>
      <div className={s.grid3}>
        <div className={s.formGroup}>
          <label>Price *</label>
          <input
            type="number"
            step="0.01"
            required
            value={form.price}
            onChange={(e) => onFormChange({ ...form, price: e.target.value })}
            className={s.formInput}
          />
        </div>
        <div className={s.formGroup}>
          <label>Current Stock</label>
          <input
            type="number"
            min="0"
            value={form.currentStock}
            onChange={(e) => onFormChange({ ...form, currentStock: e.target.value })}
            className={s.formInput}
          />
        </div>
        <div className={s.formGroup}>
          <label>Reorder Level</label>
          <input
            type="number"
            min="0"
            value={form.reorderLevel}
            onChange={(e) => onFormChange({ ...form, reorderLevel: e.target.value })}
            className={s.formInput}
          />
        </div>
      </div>
      <div className={s.formGroup}>
        <label>Product Image</label>
        <input type="file" accept="image/*" onChange={onImageChange} className={s.fileInput} />
        {imagePreview && <img src={imagePreview} alt="Preview" className={s.imagePreview} />}
      </div>
      <div className={s.checkboxRow}>
        <input
          type="checkbox"
          checked={form.isActive}
          onChange={(e) => onFormChange({ ...form, isActive: e.target.checked })}
        />
        <label>Active</label>
      </div>
      <div className={s.formActions}>
        <button type="button" onClick={onCancel} className={s.cancelBtn}>Cancel</button>
        <button type="submit" disabled={saving} className={s.saveBtn}>{saving ? 'Saving...' : editing ? 'Update' : 'Create'}</button>
      </div>
    </form>
  );
}

const initialForm = (): ProductFormState => ({
  sku: '',
  name: '',
  description: '',
  price: '',
  category: 'Herbs',
  isActive: true,
  currentStock: '0',
  reorderLevel: '5',
});

export default function ProductsPage() {
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [lowStockCount, setLowStockCount] = useState(0);

  const [showInlineForm, setShowInlineForm] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductFormState>(initialForm());
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState('');
  const [importError, setImportError] = useState('');

  const fetchProducts = (p = page, nextLowStockOnly = lowStockOnly) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (catFilter) params.set('category', catFilter);
    if (nextLowStockOnly) params.set('lowStock', 'true');
    params.set('page', String(p));
    params.set('limit', '20');
    api.get(`/products?${params.toString()}`)
      .then((res) => {
        setProducts(res.data.data);
        setTotalPages(res.data.meta.totalPages);
        setTotal(res.data.meta.total);
        setLowStockCount(res.data.summary?.lowStockCount ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCurrentUser().then(setCurrentUser).catch(() => {});
  }, []);

  useEffect(() => {
    fetchProducts(page);
  }, [catFilter, page]);

  const goToPage = (p: number) => {
    setPage(p);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(initialForm());
    setImageFile(null);
    setImagePreview('');
    setError('');
    setShowInlineForm(true);
  };

  const cancelCreate = () => {
    setShowInlineForm(false);
    setError('');
  };

  const openEdit = (product: Product) => {
    setEditing(product);
    setForm({
      sku: product.sku,
      name: product.name,
      description: product.description || '',
      price: String(product.price),
      category: product.category,
      isActive: product.isActive,
      currentStock: String(product.currentStock),
      reorderLevel: String(product.reorderLevel),
    });
    setImageFile(null);
    setImagePreview(product.image ? `${API_BASE}${product.image}` : '');
    setError('');
    setShowInlineForm(true);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const fd = new FormData();
    if (form.sku.trim()) fd.append('sku', form.sku.trim());
    fd.append('name', form.name);
    fd.append('description', form.description);
    fd.append('price', form.price);
    fd.append('category', form.category);
    fd.append('isActive', String(form.isActive));
    fd.append('currentStock', form.currentStock || '0');
    fd.append('reorderLevel', form.reorderLevel || '5');
    if (imageFile) fd.append('image', imageFile);

    try {
      if (editing) {
        await api.put(`/products/${editing.id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      } else {
        await api.post('/products', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
      setShowInlineForm(false);
      fetchProducts();
    } catch (error) {
      const message = isAxiosError<{ message?: string }>(error)
        ? error.response?.data?.message
        : undefined;
      setError(message || 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: number) => {
    await api.put(`/products/${id}/toggle`);
    fetchProducts();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await api.delete(`/products/${deleteTarget.id}`);
    setDeleteTarget(null);
    fetchProducts();
  };

  const downloadSampleTemplate = () => {
    const rows = [
      {
        sku: 'PRD-1001',
        name: 'Ashwagandha Powder',
        description: 'Stress support herbal powder',
        price: 499,
        category: 'Powders',
        isActive: true,
        currentStock: 80,
        reorderLevel: 15,
      },
      {
        sku: 'PRD-1002',
        name: 'Neem Oil',
        description: 'Cold-pressed neem oil',
        price: 299,
        category: 'Oils',
        isActive: true,
        currentStock: 24,
        reorderLevel: 10,
      },
      {
        sku: 'PRD-1003',
        name: 'Tulsi Drops',
        description: 'Daily immunity drops',
        price: 199,
        category: 'Drops',
        isActive: false,
        currentStock: 6,
        reorderLevel: 8,
      },
    ];

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Products');
    XLSX.writeFile(wb, 'product-import-template.xlsx');
  };

  const handleImportClick = () => {
    setImportError('');
    setImportMessage('');
    importInputRef.current?.click();
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportError('');
    setImportMessage('');

    const fd = new FormData();
    fd.append('file', file);

    try {
      const response = await api.post<{
        message: string;
        importedCount: number;
        createdCount: number;
        updatedCount: number;
      }>('/products/import', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImportMessage(
        `${response.data.message}. Created: ${response.data.createdCount}, Updated: ${response.data.updatedCount}.`,
      );
      setPage(1);
      fetchProducts(1);
    } catch (error) {
      const responseData = isAxiosError(error) ? error.response?.data : undefined;
      const details = (responseData as { errors?: string[] } | undefined)?.errors;
      const message =
        typeof responseData?.message === 'string'
          ? responseData.message
          : Array.isArray(details)
            ? details.join(', ')
            : 'Failed to import products';
      setImportError(message);
    } finally {
      e.target.value = '';
      setImporting(false);
    }
  };

  const handleExport = async () => {
    if (currentUser && currentUser.role !== 'SUPER_ADMIN' && !currentUser.canExportProducts) return;
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (catFilter) params.set('category', catFilter);
    if (lowStockOnly) params.set('lowStock', 'true');
    params.set('limit', '10000');
    const res = await api.get(`/products?${params.toString()}`);
    const allProducts: Product[] = res.data.data;
    const rows = allProducts.map((product) => ({
      SKU: product.sku,
      Name: product.name,
      Category: product.category,
      Price: Number(product.price).toFixed(2),
      'Current Stock': product.currentStock,
      'Reorder Level': product.reorderLevel,
      Description: product.description || '',
      Active: product.isActive ? 'Yes' : 'No',
      'Created At': new Date(product.createdAt).toLocaleDateString(),
    }));
    exportToExcel(rows, `products_${new Date().toISOString().slice(0, 10)}`);
  };

  return (
    <div className={s.page}>
      <div className={s.header}>
        <h1 className={s.pageTitle}>Products</h1>
        <div className={s.headerActions}>
          <button onClick={downloadSampleTemplate} className={s.exportBtn}>Download Sample Excel</button>
          <button onClick={handleImportClick} disabled={importing} className={s.exportBtn}>
            {importing ? 'Importing...' : 'Import Excel'}
          </button>
          {(currentUser?.role === 'SUPER_ADMIN' || currentUser?.canExportProducts) && (
            <button onClick={handleExport} className={s.exportBtn}>Export Excel</button>
          )}
          <button onClick={openCreate} className={s.addBtn}>+ Add Product</button>
        </div>
      </div>

      <input
        ref={importInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleImportFile}
        style={{ display: 'none' }}
      />

      <div className={s.statsRow}>
        <div className={s.statCard}>
          <span className={s.statLabel}>Low Stock Items</span>
          <strong className={s.statValue}>{lowStockCount}</strong>
        </div>
        <div className={s.statCard}>
          <span className={s.statLabel}>View</span>
          <button
            type="button"
            onClick={() => {
              const next = !lowStockOnly;
              setLowStockOnly(next);
              setPage(1);
              fetchProducts(1, next);
            }}
            className={`${s.filterChip} ${lowStockOnly ? s.filterChipActive : ''}`}
          >
            {lowStockOnly ? 'Showing Low Stock Only' : 'Show Low Stock Only'}
          </button>
        </div>
      </div>

      {(importMessage || importError) && (
        <div className={importError ? s.error : s.importSuccess}>
          {importError || importMessage}
        </div>
      )}

      {showInlineForm && (
        <div className={s.inlineFormWrap}>
          <ProductForm
            editing={editing}
            error={error}
            form={form}
            imagePreview={imagePreview}
            saving={saving}
            onSubmit={handleSubmit}
            onCancel={cancelCreate}
            onFormChange={setForm}
            onImageChange={handleImageChange}
          />
        </div>
      )}

      {!showInlineForm && (
        <div className={s.filters}>
          <div className={s.searchWrapper}>
            <input
              type="text"
              placeholder="Search by name or SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (page === 1) fetchProducts(1); else setPage(1);
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
                  if (page === 1) fetchProducts(1); else setPage(1);
                }}
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>
          <select
            value={catFilter}
            onChange={(e) => {
              setCatFilter(e.target.value);
              setPage(1);
            }}
            className={s.select}
          >
            <option value="">All Categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      )}

      {!showInlineForm && (loading ? (
        <div className={s.skeletonList}>
          {[...Array(5)].map((_, i) => <div key={i} className={s.skeletonRow} />)}
        </div>
      ) : products.length === 0 ? (
        <div className={s.emptyBox}>
          <div className={s.emptyText}>No products found</div>
        </div>
      ) : (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead className={s.thead}>
              <tr>
                <th className={s.th}>Product</th>
                <th className={s.th}>SKU</th>
                <th className={`${s.th} ${s.hideMd}`}>Category</th>
                <th className={s.th}>Price</th>
                <th className={s.th}>Inventory</th>
                <th className={s.th}>Status</th>
                <th className={`${s.th} ${s.thRight}`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => {
                const isLowStock = product.currentStock <= product.reorderLevel;
                return (
                  <tr key={product.id} className={s.tr}>
                    <td className={s.td}>
                      <div className={s.productCell}>
                        {product.image
                          ? <img src={`${API_BASE}${product.image}`} alt={product.name} className={s.productImg} />
                          : <div className={s.productImgPlaceholder}>P</div>
                        }
                        <div>
                          <p className={s.productName}>{product.name}</p>
                          {product.description && <p className={s.productDesc}>{product.description}</p>}
                        </div>
                      </div>
                    </td>
                    <td className={s.td}><span className={s.skuBadge}>{product.sku}</span></td>
                    <td className={`${s.td} ${s.hideMd}`}><span className={s.categoryText}>{product.category}</span></td>
                    <td className={s.td}><span className={s.price}>Rs.{Number(product.price).toFixed(2)}</span></td>
                    <td className={s.td}>
                      <div className={s.stockCell}>
                        <strong className={isLowStock ? s.stockLow : s.stockOk}>{product.currentStock}</strong>
                        <span className={s.stockMeta}>Reorder at {product.reorderLevel}</span>
                      </div>
                    </td>
                    <td className={s.td}>
                      <div className={s.statusColumn}>
                        <button onClick={() => handleToggle(product.id)} className={`${s.statusBtn} ${product.isActive ? s.statusActive : s.statusInactive}`}>
                          {product.isActive ? 'Active' : 'Inactive'}
                        </button>
                        {isLowStock && <span className={s.lowStockBadge}>Low Stock</span>}
                      </div>
                    </td>
                    <td className={`${s.td} ${s.tdRight}`}>
                      <button onClick={() => openEdit(product)} className={s.editBtn}>Edit</button>
                      <button onClick={() => setDeleteTarget(product)} className={s.deleteBtn}>Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className={s.pagination}>
              <button onClick={() => goToPage(page - 1)} disabled={page <= 1} className={s.pageBtn}>
                Prev
              </button>
              <span className={s.pageInfo}>
                Page {page} of {totalPages} ({total} products)
              </span>
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
            <h3 className={s.deleteTitle}>Delete Product</h3>
            <p className={s.deleteMsg}>Are you sure you want to delete "{deleteTarget.name}"? This cannot be undone.</p>
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
