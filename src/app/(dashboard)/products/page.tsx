'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { exportToExcel } from '@/lib/exportExcel';
import { Product } from '@/types';
import s from './products.module.scss';

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:4000';
const categories = ['Herbs', 'Oils', 'Powders', 'Capsules', 'Drops', 'Other'];

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const [showInlineForm, setShowInlineForm] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState({ name: '', description: '', price: '', category: 'Herbs', isActive: true });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  const fetchProducts = () => {
    setLoading(true);
    api.get('/products').then((res) => setProducts(res.data)).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { fetchProducts(); }, []);

  const filtered = products.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = !catFilter || p.category === catFilter;
    return matchSearch && matchCat;
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', description: '', price: '', category: 'Herbs', isActive: true });
    setImageFile(null); setImagePreview(''); setError('');
    setShowInlineForm(true);
  };

  const cancelCreate = () => { setShowInlineForm(false); setError(''); };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({ name: p.name, description: p.description || '', price: String(p.price), category: p.category, isActive: p.isActive });
    setImageFile(null);
    setImagePreview(p.image ? `${API_BASE}${p.image}` : '');
    setError('');
    setShowModal(true);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setImageFile(file); setImagePreview(URL.createObjectURL(file)); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError('');
    const fd = new FormData();
    fd.append('name', form.name); fd.append('description', form.description);
    fd.append('price', form.price); fd.append('category', form.category);
    fd.append('isActive', String(form.isActive));
    if (imageFile) fd.append('image', imageFile);
    try {
      if (editing) { await api.put(`/products/${editing.id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }); setShowModal(false); }
      else { await api.post('/products', fd, { headers: { 'Content-Type': 'multipart/form-data' } }); setShowInlineForm(false); }
      fetchProducts();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save product');
    } finally { setSaving(false); }
  };

  const handleToggle = async (id: number) => { await api.put(`/products/${id}/toggle`); fetchProducts(); };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await api.delete(`/products/${deleteTarget.id}`);
    setDeleteTarget(null); fetchProducts();
  };

  const handleExport = () => {
    const rows = filtered.map((p) => ({
      ID: p.id,
      Name: p.name,
      Category: p.category,
      Price: Number(p.price).toFixed(2),
      Description: p.description || '',
      Active: p.isActive ? 'Yes' : 'No',
      'Created At': new Date(p.createdAt).toLocaleDateString(),
    }));
    exportToExcel(rows, `products_${new Date().toISOString().slice(0, 10)}`);
  };

  const ProductForm = () => (
    <form onSubmit={handleSubmit} className={s.inlineForm}>
      <h2 className={s.inlineFormTitle}>{editing ? 'Edit Product' : 'New Product'}</h2>
      {error && <div className={s.error}>{error}</div>}
      <div className={s.formGroup}>
        <label>Name *</label>
        <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={s.formInput} />
      </div>
      <div className={s.formGroup}>
        <label>Description</label>
        <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className={s.formTextarea} />
      </div>
      <div className={s.grid2}>
        <div className={s.formGroup}>
          <label>Price *</label>
          <input type="number" step="0.01" required value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className={s.formInput} />
        </div>
        <div className={s.formGroup}>
          <label>Category *</label>
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={s.formSelect}>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div className={s.formGroup}>
        <label>Product Image</label>
        <input type="file" accept="image/*" onChange={handleImageChange} className={s.fileInput} />
        {imagePreview && <img src={imagePreview} alt="Preview" className={s.imagePreview} />}
      </div>
      <div className={s.checkboxRow}>
        <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
        <label>Active</label>
      </div>
      <div className={s.formActions}>
        <button type="button" onClick={editing ? () => setShowModal(false) : cancelCreate} className={s.cancelBtn}>Cancel</button>
        <button type="submit" disabled={saving} className={s.saveBtn}>{saving ? 'Saving...' : editing ? 'Update' : 'Create'}</button>
      </div>
    </form>
  );

  return (
    <div className={s.page}>
      <div className={s.header}>
        <h1 className={s.pageTitle}>Products</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={handleExport} className={s.exportBtn}>↓ Export Excel</button>
          <button onClick={openCreate} className={s.addBtn}>+ Add Product</button>
        </div>
      </div>

      <div className={s.filters}>
        <input type="text" placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} className={s.searchInput} />
        <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className={s.select}>
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {loading ? (
        <div className={s.skeletonList}>
          {[...Array(5)].map((_, i) => <div key={i} className={s.skeletonRow} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className={s.emptyBox}>
          {showInlineForm ? <ProductForm /> : <div className={s.emptyText}>No products found</div>}
        </div>
      ) : (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead className={s.thead}>
              <tr>
                <th className={s.th}>Product</th>
                <th className={`${s.th} ${s.hideMd}`}>Category</th>
                <th className={s.th}>Price</th>
                <th className={s.th}>Status</th>
                <th className={`${s.th} ${s.thRight}`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className={s.tr}>
                  <td className={s.td}>
                    <div className={s.productCell}>
                      {p.image
                        ? <img src={`${API_BASE}${p.image}`} alt={p.name} className={s.productImg} />
                        : <div className={s.productImgPlaceholder}>🌿</div>
                      }
                      <div>
                        <p className={s.productName}>{p.name}</p>
                        {p.description && <p className={s.productDesc}>{p.description}</p>}
                      </div>
                    </div>
                  </td>
                  <td className={`${s.td} ${s.hideMd}`}><span className={s.categoryText}>{p.category}</span></td>
                  <td className={s.td}><span className={s.price}>&#8377;{Number(p.price).toFixed(2)}</span></td>
                  <td className={s.td}>
                    <button onClick={() => handleToggle(p.id)} className={`${s.statusBtn} ${p.isActive ? s.statusActive : s.statusInactive}`}>
                      {p.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className={`${s.td} ${s.tdRight}`}>
                    <button onClick={() => openEdit(p)} className={s.editBtn}>Edit</button>
                    <button onClick={() => setDeleteTarget(p)} className={s.deleteBtn}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className={s.overlay}>
          <div className={s.modal}><ProductForm /></div>
        </div>
      )}

      {deleteTarget && (
        <div className={s.overlay}>
          <div className={s.deleteModal}>
            <h3 className={s.deleteTitle}>Delete Product</h3>
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
