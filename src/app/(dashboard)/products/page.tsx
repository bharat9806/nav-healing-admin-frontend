'use client';

import { isAxiosError } from 'axios';
import { useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import api from '@/lib/api';
import { fetchCurrentUser } from '@/lib/current-user';
import { exportToExcel } from '@/lib/exportExcel';
import { Company, Product, User } from '@/types';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { TypeableSelect } from '@/components/ui/TypeableSelect';
import { SkeletonList } from '@/components/ui/Loader';
import s from './products.module.scss';

// Backend-served images go through the same-origin /backend-static proxy (next.config.ts).
const API_BASE = '/backend-static';

type CategoryOption = {
  id: number;
  name: string;
  subcategories: { id: number; name: string }[];
};

type ImportPreviewRow = {
  rowNumber: number;
  name: string;
  description: string;
  price: number;
  category: string;
  subcategory: string;
  isActive: boolean;
  currentStock: number;
  reorderLevel: number;
  expiryDate: string | null;
  sku: string;
  companyId: number | null;
  companyName: string | null;
  plannedSku: string;
  status: 'new' | 'update' | 'duplicate';
  match: {
    id: number;
    sku: string;
    name: string;
    price: number | string;
    category: string;
    currentStock: number;
  } | null;
};

type ImportPreview = {
  rows: ImportPreviewRow[];
  summary: { total: number; new: number; update: number; duplicate: number };
};

type DuplicateDecision = 'skip' | 'create' | 'update';

type ProductFormState = {
  sku: string;
  name: string;
  description: string;
  price: string;
  category: string;
  subcategory: string;
  companyId: string;
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
  categoryOptions: CategoryOption[];
  companyOptions: Company[];
  skuPreview: string;
  onSubmit: (e: React.FormEvent) => Promise<void>;
  onCancel: () => void;
  onFormChange: (next: ProductFormState) => void;
  onImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAddCompany: (name: string, prefix: string) => Promise<Company | null>;
};

const ADD_COMPANY = '__add_company__';

function ProductForm({
  editing,
  error,
  form,
  imagePreview,
  saving,
  categoryOptions,
  companyOptions,
  skuPreview,
  onSubmit,
  onCancel,
  onFormChange,
  onImageChange,
  onAddCompany,
}: ProductFormProps) {
  const selectedCategory = categoryOptions.find((c) => c.name === form.category);
  const subcategoryOptions = selectedCategory?.subcategories ?? [];
  const subcategorySelectOptions = [
    { label: 'Select subcategory', value: '' },
    ...subcategoryOptions.map((option) => ({ label: option.name, value: option.name })),
  ];

  const [addingCompany, setAddingCompany] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyPrefix, setNewCompanyPrefix] = useState('');
  const [companyError, setCompanyError] = useState('');
  const [savingCompany, setSavingCompany] = useState(false);

  const companySelectOptions = [
    { label: 'Select company', value: '' },
    ...companyOptions.map((c) => ({ label: `${c.name} (${c.skuPrefix})`, value: String(c.id) })),
    { label: '+ Add new company', value: ADD_COMPANY },
  ];

  const handleCompanySelect = (val: string | number) => {
    const value = String(val);
    if (value === ADD_COMPANY) {
      setAddingCompany(true);
      setCompanyError('');
      return;
    }
    setAddingCompany(false);
    onFormChange({ ...form, companyId: value });
  };

  const handleSaveCompany = async () => {
    setCompanyError('');
    const name = newCompanyName.trim();
    const prefix = newCompanyPrefix.trim().toUpperCase();
    if (!name || !prefix) {
      setCompanyError('Both company name and prefix are required');
      return;
    }
    if (!/^[A-Z]{2,10}$/.test(prefix)) {
      setCompanyError('Prefix must be 2–10 letters (A–Z) only');
      return;
    }
    setSavingCompany(true);
    const created = await onAddCompany(name, prefix);
    setSavingCompany(false);
    if (created) {
      setAddingCompany(false);
      setNewCompanyName('');
      setNewCompanyPrefix('');
      onFormChange({ ...form, companyId: String(created.id) });
    } else {
      setCompanyError('Could not create company (name or prefix may already exist)');
    }
  };

  return (
    <form onSubmit={onSubmit} className={s.inlineForm}>
      <h2 className={s.inlineFormTitle}>{editing ? 'Edit Product' : 'New Product'}</h2>
      {error && <div className={s.error}>{error}</div>}
      <div className={s.productMetaRow}>
        <div className={s.formGroup}>
          <label>Company {editing ? '' : '*'}</label>
          <CustomSelect
            className={s.formSelectWrap}
            fullWidth
            options={companySelectOptions}
            value={addingCompany ? ADD_COMPANY : form.companyId}
            onChange={handleCompanySelect}
            align="left"
            minWidth="100%"
          />
          {addingCompany && (
            <div className={s.addCompanyBox}>
              <input
                type="text"
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
                className={s.formInput}
                placeholder="Company name (e.g. Rudhra)"
              />
              <input
                type="text"
                value={newCompanyPrefix}
                onChange={(e) => setNewCompanyPrefix(e.target.value.toUpperCase())}
                className={s.formInput}
                placeholder="Prefix (e.g. RUD)"
                maxLength={10}
              />
              <div className={s.addCompanyActions}>
                <button type="button" onClick={() => { setAddingCompany(false); setCompanyError(''); }} className={s.cancelBtn}>Cancel</button>
                <button type="button" onClick={handleSaveCompany} disabled={savingCompany} className={s.saveBtn}>
                  {savingCompany ? 'Saving...' : 'Save company'}
                </button>
              </div>
              {companyError && <div className={s.error}>{companyError}</div>}
            </div>
          )}
        </div>
        <div className={s.formGroup}>
          <label>SKU / Product Code</label>
          <input
            type="text"
            value={editing ? form.sku : (form.companyId ? skuPreview : form.sku)}
            onChange={(e) => onFormChange({ ...form, sku: e.target.value.toUpperCase() })}
            className={s.formInput}
            readOnly={!editing && !!form.companyId}
            placeholder={form.companyId ? 'Auto-generated from company' : 'Auto-generated if left blank'}
          />
          {!editing && !!form.companyId && (
            <span className={s.fieldHint}>Auto-generated when you save</span>
          )}
        </div>
        <div className={s.formGroup}>
          <label>Category *</label>
          <CustomSelect
            className={s.formSelectWrap}
            fullWidth
            options={categoryOptions.map((c) => ({ label: c.name, value: c.name }))}
            value={form.category}
            onChange={(val) => onFormChange({ ...form, category: String(val), subcategory: '' })}
            align="left"
            minWidth="100%"
          />
        </div>
        <div className={s.formGroup}>
          <label>Subcategory</label>
          <TypeableSelect
            className={s.formSelectWrap}
            fullWidth
            options={subcategorySelectOptions}
            value={form.subcategory}
            onChange={(val) => onFormChange({ ...form, subcategory: val })}
            align="left"
            minWidth="100%"
            placeholder="Select subcategory"
            customOptionLabel="Type custom subcategory"
            customPlaceholder="Type subcategory"
          />
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
  category: '',
  subcategory: '',
  companyId: '',
  isActive: true,
  currentStock: '0',
  reorderLevel: '5',
});

export default function ProductsPage() {
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([]);
  const [companyOptions, setCompanyOptions] = useState<Company[]>([]);
  const [skuPreview, setSkuPreview] = useState('');
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [sortField, setSortField] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
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
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [duplicateDecisions, setDuplicateDecisions] = useState<Record<number, DuplicateDecision>>({});
  const [committing, setCommitting] = useState(false);
  const [commitError, setCommitError] = useState('');

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const fetchProducts = (p = page, nextLowStockOnly = lowStockOnly, nextPageSize = pageSize) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (catFilter) params.set('category', catFilter);
    if (nextLowStockOnly) params.set('lowStock', 'true');
    params.set('page', String(p));
    params.set('limit', String(nextPageSize));
    params.set('sortBy', sortField);
    params.set('order', sortOrder);
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
    api.get('/categories').then((res) => {
      const cats: CategoryOption[] = res.data;
      setCategoryOptions(cats);
      // Set default category for the new-product form
      setForm((prev) => ({ ...prev, category: prev.category || (cats[0]?.name ?? '') }));
    }).catch(() => {});
    api.get('/companies').then((res) => {
      setCompanyOptions(res.data as Company[]);
    }).catch(() => {});
  }, []);

  // Preview the next auto-generated SKU whenever a company is selected on a new product.
  useEffect(() => {
    if (editing || !form.companyId) {
      setSkuPreview('');
      return;
    }
    let cancelled = false;
    api.get(`/companies/${form.companyId}/next-sku`)
      .then((res) => { if (!cancelled) setSkuPreview(res.data.sku ?? ''); })
      .catch(() => { if (!cancelled) setSkuPreview(''); });
    return () => { cancelled = true; };
  }, [form.companyId, editing]);

  const handleAddCompany = async (name: string, prefix: string): Promise<Company | null> => {
    try {
      const res = await api.post('/companies', { name, skuPrefix: prefix });
      const created = res.data as Company;
      setCompanyOptions((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      return created;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    fetchProducts(page);
  }, [catFilter, page, pageSize, sortField, sortOrder]);

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
      subcategory: product.subcategory || '',
      companyId: product.companyId != null ? String(product.companyId) : '',
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
    if (!editing && !form.companyId) {
      setError('Please select a company so the SKU can be generated');
      return;
    }
    setSaving(true);
    setError('');
    const fd = new FormData();
    // When a company is chosen on a new product, the backend auto-generates
    // the SKU from the company prefix — don't send a manual sku.
    if (form.companyId) {
      fd.append('companyId', form.companyId);
      if (editing && form.sku.trim()) fd.append('sku', form.sku.trim());
    } else if (form.sku.trim()) {
      fd.append('sku', form.sku.trim());
    }
    fd.append('name', form.name);
    fd.append('description', form.description);
    fd.append('price', form.price);
    fd.append('category', form.category);
    fd.append('subcategory', form.subcategory);
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
    // "sku" is optional — leave it blank and give a "company" (name or SKU
    // prefix) and the SKU is auto-generated during import.
    const rows = [
      {
        sku: '',
        company: 'RUD',
        name: 'Ashwagandha Powder',
        description: 'Stress support herbal powder',
        price: 499,
        category: 'Powder',
        subcategory: 'Herbal Support',
        isActive: true,
        currentStock: 80,
        reorderLevel: 15,
      },
      {
        sku: '',
        company: 'VRI',
        name: 'Neem Oil',
        description: 'Cold-pressed neem oil',
        price: 299,
        category: 'Oil',
        subcategory: 'Skin Care',
        isActive: true,
        currentStock: 24,
        reorderLevel: 10,
      },
      {
        sku: 'PRD-1003',
        company: '',
        name: 'Tulsi Drops',
        description: 'Daily immunity drops',
        price: 199,
        category: 'Drops',
        subcategory: 'Immunity',
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

  const extractApiError = (error: unknown, fallback: string) => {
    const responseData = isAxiosError(error) ? error.response?.data : undefined;
    const details = (responseData as { errors?: string[] } | undefined)?.errors;
    if (Array.isArray(details) && details.length > 0) return details.join(' • ');
    return typeof responseData?.message === 'string' ? responseData.message : fallback;
  };

  // Step 1: upload the sheet and get a classified preview (no DB writes).
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportError('');
    setImportMessage('');

    const fd = new FormData();
    fd.append('file', file);

    try {
      const response = await api.post<ImportPreview>('/products/import/preview', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const preview = response.data;
      const decisions: Record<number, DuplicateDecision> = {};
      preview.rows.forEach((row) => {
        if (row.status === 'duplicate') decisions[row.rowNumber] = 'skip';
      });
      setDuplicateDecisions(decisions);
      setCommitError('');
      setImportPreview(preview);
    } catch (error) {
      setImportError(extractApiError(error, 'Failed to read the Excel file'));
    } finally {
      e.target.value = '';
      setImporting(false);
    }
  };

  // Step 2: send the reviewed rows to be applied in one transaction.
  const handleCommitImport = async () => {
    if (!importPreview) return;
    setCommitting(true);
    setCommitError('');

    const rows = importPreview.rows.map((row) => {
      const base = {
        name: row.name,
        description: row.description || undefined,
        price: Number(row.price),
        category: row.category,
        subcategory: row.subcategory || undefined,
        isActive: row.isActive,
        currentStock: row.currentStock,
        reorderLevel: row.reorderLevel,
        expiryDate: row.expiryDate || undefined,
        companyId: row.companyId ?? undefined,
      };
      if (row.status === 'update') {
        return { ...base, action: 'update' as const, targetSku: row.sku };
      }
      if (row.status === 'duplicate') {
        const decision = duplicateDecisions[row.rowNumber] ?? 'skip';
        if (decision === 'update' && row.match) {
          return { ...base, action: 'update' as const, targetSku: row.match.sku };
        }
        if (decision === 'create') {
          return { ...base, action: 'create' as const, sku: row.sku || undefined };
        }
        return { ...base, action: 'skip' as const };
      }
      return { ...base, action: 'create' as const, sku: row.sku || undefined };
    });

    try {
      const response = await api.post<{
        message: string;
        createdCount: number;
        updatedCount: number;
        skippedCount: number;
      }>('/products/import/commit', { rows });
      setImportMessage(
        `${response.data.message}. Created: ${response.data.createdCount}, Updated: ${response.data.updatedCount}, Skipped: ${response.data.skippedCount}.`,
      );
      setImportPreview(null);
      setDuplicateDecisions({});
      setPage(1);
      fetchProducts(1);
    } catch (error) {
      setCommitError(extractApiError(error, 'Failed to import products'));
    } finally {
      setCommitting(false);
    }
  };

  const closeImportPreview = () => {
    setImportPreview(null);
    setDuplicateDecisions({});
    setCommitError('');
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
      Subcategory: product.subcategory || '',
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
          {(currentUser?.role === 'SUPER_ADMIN' || currentUser?.canManageProducts) && (
            <>
              <button onClick={downloadSampleTemplate} className={s.exportBtn}>Download Sample Excel</button>
              <button onClick={handleImportClick} disabled={importing} className={s.exportBtn}>
                {importing ? 'Reading file...' : 'Import Excel'}
              </button>
            </>
          )}
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
            categoryOptions={categoryOptions}
            companyOptions={companyOptions}
            skuPreview={skuPreview}
            onSubmit={handleSubmit}
            onCancel={cancelCreate}
            onFormChange={setForm}
            onImageChange={handleImageChange}
            onAddCompany={handleAddCompany}
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
          <CustomSelect
            options={[{ label: 'All Categories', value: '' }, ...categoryOptions.map((c) => ({ label: c.name, value: c.name }))]}
            value={catFilter}
            onChange={(val) => { setCatFilter(String(val)); setPage(1); }}
            align="left"
            minWidth="10rem"
          />
        </div>
      )}

      {!showInlineForm && (loading ? (
        <SkeletonList rows={5} />
      ) : products.length === 0 ? (
        <div className={s.emptyBox}>
          <div className={s.emptyText}>No products found</div>
        </div>
      ) : (
        <div className={s.tableWrap}>
          <div className={s.mobileList}>
            {products.map((product) => {
              const isLowStock = product.currentStock <= product.reorderLevel;
              return (
                <article key={`mobile-${product.id}`} className={s.mobileCard}>
                  <div className={s.mobileCardTop}>
                    <div className={s.productCell}>
                      {product.image
                        ? <img src={`${API_BASE}${product.image}`} alt={product.name} className={s.productImg} />
                        : <div className={s.productImgPlaceholder}>P</div>
                      }
                      <div>
                        <p className={s.productName}>{product.name}</p>
                        <span className={s.skuBadge}>{product.sku}</span>
                        {product.description && <p className={s.productDesc}>{product.description}</p>}
                      </div>
                    </div>
                    <button onClick={() => handleToggle(product.id)} className={`${s.statusBtn} ${product.isActive ? s.statusActive : s.statusInactive}`}>
                      {product.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </div>

                  <div className={s.mobileMetaGrid}>
                    <div className={s.mobileMetaItem}>
                      <span className={s.mobileMetaLabel}>Category</span>
                      <span className={s.categoryText}>{product.category}{product.subcategory ? ` / ${product.subcategory}` : ''}</span>
                    </div>
                    <div className={s.mobileMetaItem}>
                      <span className={s.mobileMetaLabel}>Price</span>
                      <span className={s.price}>Rs.{Number(product.price).toFixed(2)}</span>
                    </div>
                    <div className={s.mobileMetaItem}>
                      <span className={s.mobileMetaLabel}>Inventory</span>
                      <div className={s.stockCell}>
                        <strong className={isLowStock ? s.stockLow : s.stockOk}>{product.currentStock}</strong>
                        <span className={s.stockMeta}>Reorder at {product.reorderLevel}</span>
                      </div>
                    </div>
                    <div className={s.mobileMetaItem}>
                      <span className={s.mobileMetaLabel}>Status</span>
                      {isLowStock ? <span className={s.lowStockBadge}>Low Stock</span> : <span className={s.mobileHealthy}>In Stock</span>}
                    </div>
                  </div>

                  <div className={s.mobileActions}>
                    <button onClick={() => openEdit(product)} className={s.mobileEditBtn}>Edit</button>
                    <button onClick={() => setDeleteTarget(product)} className={s.mobileDeleteBtn}>Delete</button>
                  </div>
                </article>
              );
            })}
          </div>

          <table className={s.table}>
            <thead className={s.thead}>
              <tr>
                <th className={`${s.th} ${s.thSortable}`} onClick={() => handleSort('name')}>Product{sortField === 'name' ? (sortOrder === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</th>
                <th className={`${s.th} ${s.thSortable}`} onClick={() => handleSort('sku')}>SKU{sortField === 'sku' ? (sortOrder === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</th>
                <th className={`${s.th} ${s.hideMd} ${s.thSortable}`} onClick={() => handleSort('category')}>Category{sortField === 'category' ? (sortOrder === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</th>
                <th className={`${s.th} ${s.thSortable}`} onClick={() => handleSort('price')}>Price{sortField === 'price' ? (sortOrder === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</th>
                <th className={`${s.th} ${s.thSortable}`} onClick={() => handleSort('currentStock')}>Inventory{sortField === 'currentStock' ? (sortOrder === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</th>
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
                    <td className={`${s.td} ${s.hideMd}`}><span className={s.categoryText}>{product.category}{product.subcategory ? ` / ${product.subcategory}` : ''}</span></td>
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
            <CustomSelect
              options={[10, 20, 30, 50].map((n) => ({ label: `${n} / page`, value: n }))}
              value={pageSize}
              onChange={(val) => {
                const next = Number(val);
                setPageSize(next);
                setPage(1);
                fetchProducts(1, lowStockOnly, next);
              }}
              align="right"
              direction="up"
            />
          </div>
        </div>
      ))}

      {importPreview && (
        <div className={s.overlay}>
          <div className={s.importModal}>
            <h3 className={s.importTitle}>Review Import</h3>
            <p className={s.importSummary}>
              {importPreview.summary.total} rows —{' '}
              <span className={s.importChipNew}>{importPreview.summary.new} new</span>{' '}
              <span className={s.importChipUpdate}>{importPreview.summary.update} updates</span>{' '}
              <span className={s.importChipDup}>{importPreview.summary.duplicate} possible duplicates</span>
            </p>
            <p className={s.importHint}>Nothing is saved until you confirm.</p>

            <div className={s.importScroll}>
              {importPreview.summary.duplicate > 0 && (
                <div className={s.importSection}>
                  <h4 className={s.importSectionTitle}>Possible duplicates — choose what to do</h4>
                  {importPreview.rows.filter((r) => r.status === 'duplicate').map((row) => (
                    <div key={row.rowNumber} className={s.importDupCard}>
                      <div className={s.importDupCompare}>
                        <div>
                          <span className={s.importDupLabel}>In your sheet</span>
                          <strong>{row.name}</strong>
                          <span className={s.importDupMeta}>₹{row.price} · {row.category}{row.companyName ? ` · ${row.companyName}` : ''}</span>
                        </div>
                        <div>
                          <span className={s.importDupLabel}>Already in system</span>
                          <strong>{row.match?.name}</strong>
                          <span className={s.importDupMeta}>₹{Number(row.match?.price)} · {row.match?.sku} · stock {row.match?.currentStock}</span>
                        </div>
                      </div>
                      <div className={s.importDupActions}>
                        {([
                          ['skip', 'Skip'],
                          ['update', 'Update existing'],
                          ['create', 'Create anyway'],
                        ] as [DuplicateDecision, string][]).map(([value, label]) => (
                          <label key={value} className={s.importDupOption}>
                            <input
                              type="radio"
                              name={`dup-${row.rowNumber}`}
                              checked={(duplicateDecisions[row.rowNumber] ?? 'skip') === value}
                              onChange={() =>
                                setDuplicateDecisions((prev) => ({ ...prev, [row.rowNumber]: value }))
                              }
                            />
                            {label}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {importPreview.summary.new > 0 && (
                <div className={s.importSection}>
                  <h4 className={s.importSectionTitle}>New products (will be created)</h4>
                  <table className={s.importTable}>
                    <thead>
                      <tr><th>Name</th><th>SKU</th><th>Company</th><th>Category</th><th>Price</th><th>Stock</th></tr>
                    </thead>
                    <tbody>
                      {importPreview.rows.filter((r) => r.status === 'new').map((row) => (
                        <tr key={row.rowNumber}>
                          <td>{row.name}</td>
                          <td>{row.plannedSku || '—'}</td>
                          <td>{row.companyName || '—'}</td>
                          <td>{row.category}</td>
                          <td>₹{row.price}</td>
                          <td>{row.currentStock}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {importPreview.summary.update > 0 && (
                <div className={s.importSection}>
                  <h4 className={s.importSectionTitle}>Updates (SKU already exists)</h4>
                  <table className={s.importTable}>
                    <thead>
                      <tr><th>SKU</th><th>Name</th><th>New price</th><th>New stock</th></tr>
                    </thead>
                    <tbody>
                      {importPreview.rows.filter((r) => r.status === 'update').map((row) => (
                        <tr key={row.rowNumber}>
                          <td>{row.sku}</td>
                          <td>{row.name}</td>
                          <td>₹{row.price}</td>
                          <td>{row.currentStock}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {commitError && <div className={s.error}>{commitError}</div>}

            <div className={s.deleteActions}>
              <button onClick={closeImportPreview} className={s.deleteCancelBtn} disabled={committing}>
                Cancel
              </button>
              <button onClick={handleCommitImport} className={s.addBtn} disabled={committing}>
                {committing ? 'Importing...' : 'Confirm Import'}
              </button>
            </div>
          </div>
        </div>
      )}

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
