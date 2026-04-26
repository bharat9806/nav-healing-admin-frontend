'use client';

import { isAxiosError } from 'axios';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { fetchCurrentUser } from '@/lib/current-user';
import { Blog, BlogListItem, BlogRelatedFormulation, BlogStatus, User } from '@/types';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import s from './blogs.module.scss';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:4000';

type BlogFormState = {
  title: string;
  slug: string;
  excerpt: string;
  category: string;
  issue: string;
  readTimeMinutes: string;
  authorName: string;
  authorInitials: string;
  content: string;
  heroImageCaption: string;
  relatedFormulations: BlogRelatedFormulation[];
  status: BlogStatus;
  publishedAt: string;
  isActive: boolean;
};

const initialForm = (): BlogFormState => ({
  title: '',
  slug: '',
  excerpt: '',
  category: '',
  issue: '',
  readTimeMinutes: '',
  authorName: '',
  authorInitials: '',
  content: '',
  heroImageCaption: '',
  relatedFormulations: [],
  status: 'DRAFT',
  publishedAt: '',
  isActive: true,
});

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200);

const formatDate = (iso?: string | null) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
};

export default function BlogsPage() {
  const [blogs, setBlogs] = useState<BlogListItem[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | BlogStatus>('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [publishedCount, setPublishedCount] = useState(0);
  const [draftCount, setDraftCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const [showInlineForm, setShowInlineForm] = useState(false);
  const [editing, setEditing] = useState<Blog | null>(null);
  const [form, setForm] = useState<BlogFormState>(initialForm());
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<BlogListItem | null>(null);

  const [sortField, setSortField] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const fetchBlogs = (p = page, nextPageSize = pageSize) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (statusFilter) params.set('status', statusFilter);
    params.set('page', String(p));
    params.set('limit', String(nextPageSize));
    params.set('sortBy', sortField);
    params.set('order', sortOrder);
    api
      .get(`/blogs?${params.toString()}`)
      .then((res) => {
        setBlogs(res.data.data);
        setTotalPages(res.data.meta.totalPages);
        setTotal(res.data.meta.total);
        setPublishedCount(res.data.summary?.publishedCount ?? 0);
        setDraftCount(res.data.summary?.draftCount ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCurrentUser().then(setCurrentUser).catch(() => {});
  }, []);

  useEffect(() => {
    fetchBlogs(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, sortField, sortOrder, statusFilter]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(initialForm());
    setImageFile(null);
    setImagePreview('');
    setSlugTouched(false);
    setError('');
    setSuccessMsg('');
    setShowInlineForm(true);
  };

  const openEdit = async (blog: BlogListItem) => {
    setError('');
    setSuccessMsg('');
    try {
      const res = await api.get<Blog>(`/blogs/${blog.id}`);
      const full = res.data;
      setEditing(full);
      setForm({
        title: full.title,
        slug: full.slug,
        excerpt: full.excerpt ?? '',
        category: full.category ?? '',
        issue: full.issue ?? '',
        readTimeMinutes: full.readTimeMinutes != null ? String(full.readTimeMinutes) : '',
        authorName: full.authorName ?? '',
        authorInitials: full.authorInitials ?? '',
        content: full.content ?? '',
        heroImageCaption: full.heroImageCaption ?? '',
        relatedFormulations: Array.isArray(full.relatedFormulations)
          ? full.relatedFormulations
          : [],
        status: full.status,
        publishedAt: full.publishedAt
          ? new Date(full.publishedAt).toISOString().slice(0, 10)
          : '',
        isActive: full.isActive,
      });
      setImageFile(null);
      setImagePreview(full.heroImage ? `${API_BASE}${full.heroImage}` : '');
      setSlugTouched(true);
      setShowInlineForm(true);
    } catch {
      setError('Could not load this blog.');
    }
  };

  const cancelForm = () => {
    setShowInlineForm(false);
    setError('');
  };

  const handleTitleChange = (next: string) => {
    setForm((prev) => ({
      ...prev,
      title: next,
      slug: slugTouched ? prev.slug : slugify(next),
    }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const setRelated = (idx: number, patch: Partial<BlogRelatedFormulation>) => {
    setForm((prev) => ({
      ...prev,
      relatedFormulations: prev.relatedFormulations.map((row, i) =>
        i === idx ? { ...row, ...patch } : row,
      ),
    }));
  };

  const addRelated = () => {
    setForm((prev) => ({
      ...prev,
      relatedFormulations: [...prev.relatedFormulations, { name: '', dhatu: '' }],
    }));
  };

  const removeRelated = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      relatedFormulations: prev.relatedFormulations.filter((_, i) => i !== idx),
    }));
  };

  const submit = async (status: BlogStatus) => {
    if (!form.title.trim()) {
      setError('Title is required');
      return;
    }
    if (!form.content || form.content === '<p></p>') {
      setError('Article content cannot be empty');
      return;
    }

    setSaving(true);
    setError('');
    setSuccessMsg('');

    const fd = new FormData();
    fd.append('title', form.title.trim());
    if (form.slug.trim()) fd.append('slug', form.slug.trim());
    if (form.excerpt) fd.append('excerpt', form.excerpt);
    if (form.category) fd.append('category', form.category);
    if (form.issue) fd.append('issue', form.issue);
    if (form.readTimeMinutes) fd.append('readTimeMinutes', form.readTimeMinutes);
    if (form.authorName) fd.append('authorName', form.authorName);
    if (form.authorInitials) fd.append('authorInitials', form.authorInitials);
    fd.append('content', form.content);
    if (form.heroImageCaption) fd.append('heroImageCaption', form.heroImageCaption);
    const cleanRelated = form.relatedFormulations.filter((r) => r.name.trim());
    fd.append('relatedFormulations', JSON.stringify(cleanRelated));
    fd.append('status', status);
    if (form.publishedAt) fd.append('publishedAt', new Date(form.publishedAt).toISOString());
    fd.append('isActive', String(form.isActive));
    if (imageFile) fd.append('heroImage', imageFile);

    try {
      if (editing) {
        await api.put(`/blogs/${editing.id}`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        setSuccessMsg(
          status === 'PUBLISHED' ? 'Blog updated and published.' : 'Blog saved.',
        );
      } else {
        await api.post('/blogs', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        setSuccessMsg(
          status === 'PUBLISHED' ? 'Blog published.' : 'Draft saved.',
        );
      }
      setShowInlineForm(false);
      setPage(1);
      fetchBlogs(1);
    } catch (err) {
      const message = isAxiosError<{ message?: string }>(err)
        ? err.response?.data?.message
        : undefined;
      setError(
        Array.isArray(message) ? message.join(', ') : message || 'Failed to save blog',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (blog: BlogListItem) => {
    try {
      if (blog.status === 'PUBLISHED') {
        await api.put(`/blogs/${blog.id}/unpublish`);
      } else {
        await api.put(`/blogs/${blog.id}/publish`);
      }
      fetchBlogs();
    } catch {
      // swallow
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/blogs/${deleteTarget.id}`);
      setDeleteTarget(null);
      fetchBlogs();
    } catch (err) {
      const message = isAxiosError<{ message?: string }>(err)
        ? err.response?.data?.message
        : undefined;
      setError(message || 'Failed to delete blog');
      setDeleteTarget(null);
    }
  };

  const canManage =
    currentUser?.role === 'SUPER_ADMIN' || currentUser?.canManageBlogs;

  return (
    <div className={s.page}>
      <div className={s.header}>
        <h1 className={s.pageTitle}>Blogs</h1>
        {canManage && (
          <div className={s.headerActions}>
            <button onClick={openCreate} className={s.addBtn}>+ New Article</button>
          </div>
        )}
      </div>

      <div className={s.statsRow}>
        <div className={s.statCard}>
          <span className={s.statLabel}>Published</span>
          <strong className={s.statValue}>{publishedCount}</strong>
        </div>
        <div className={s.statCard}>
          <span className={s.statLabel}>Drafts</span>
          <strong className={s.statValue}>{draftCount}</strong>
        </div>
      </div>

      {successMsg && <div className={s.successBanner}>{successMsg}</div>}

      {showInlineForm && canManage && (
        <div className={s.inlineFormWrap}>
          <form onSubmit={(e) => { e.preventDefault(); submit('PUBLISHED'); }} className={s.inlineForm}>
            <h2 className={s.inlineFormTitle}>{editing ? 'Edit Article' : 'New Article'}</h2>
            {error && <div className={s.error}>{error}</div>}

            <div className={s.formGroup}>
              <label>Title *</label>
              <input
                type="text"
                required
                value={form.title}
                onChange={(e) => handleTitleChange(e.target.value)}
                className={s.formInput}
                placeholder="The seven dhatus, read backwards."
              />
            </div>

            <div className={s.grid2}>
              <div className={s.formGroup}>
                <label>Slug</label>
                <input
                  type="text"
                  value={form.slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setForm({ ...form, slug: slugify(e.target.value) });
                  }}
                  className={s.formInput}
                  placeholder="seven-dhatus-read-backwards"
                />
                <p className={s.helperText}>Auto-generated from title. Change only if you know what you're doing.</p>
              </div>
              <div className={s.formGroup}>
                <label>Category</label>
                <input
                  type="text"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value.toUpperCase() })}
                  className={s.formInput}
                  placeholder="PLANT PROFILE"
                />
              </div>
            </div>

            <div className={s.formGroup}>
              <label>Excerpt</label>
              <textarea
                value={form.excerpt}
                onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
                rows={2}
                className={s.formTextarea}
                placeholder="Why Ayurvedic formulation begins with rasa…"
              />
            </div>

            <div className={s.grid3}>
              <div className={s.formGroup}>
                <label>Issue</label>
                <input
                  type="text"
                  value={form.issue}
                  onChange={(e) => setForm({ ...form, issue: e.target.value })}
                  className={s.formInput}
                  placeholder="ISSUE 03"
                />
              </div>
              <div className={s.formGroup}>
                <label>Read time (minutes)</label>
                <input
                  type="number"
                  min="1"
                  value={form.readTimeMinutes}
                  onChange={(e) => setForm({ ...form, readTimeMinutes: e.target.value })}
                  className={s.formInput}
                  placeholder="18"
                />
              </div>
              <div className={s.formGroup}>
                <label>Publish date</label>
                <input
                  type="date"
                  value={form.publishedAt}
                  onChange={(e) => setForm({ ...form, publishedAt: e.target.value })}
                  className={s.formInput}
                />
              </div>
            </div>

            <div className={s.grid2}>
              <div className={s.formGroup}>
                <label>Author name</label>
                <input
                  type="text"
                  value={form.authorName}
                  onChange={(e) => setForm({ ...form, authorName: e.target.value })}
                  className={s.formInput}
                  placeholder="Dr Tanya Sharma"
                />
              </div>
              <div className={s.formGroup}>
                <label>Author initials</label>
                <input
                  type="text"
                  maxLength={3}
                  value={form.authorInitials}
                  onChange={(e) => setForm({ ...form, authorInitials: e.target.value.toUpperCase() })}
                  className={s.formInput}
                  placeholder="TS"
                />
                <p className={s.helperText}>Auto-derived from author name if blank.</p>
              </div>
            </div>

            <div className={s.formGroup}>
              <label>Hero image</label>
              <input type="file" accept="image/*" onChange={handleImageChange} className={s.fileInput} />
              {imagePreview && <img src={imagePreview} alt="Hero preview" className={s.imagePreview} />}
            </div>

            <div className={s.formGroup}>
              <label>Hero image caption</label>
              <input
                type="text"
                value={form.heroImageCaption}
                onChange={(e) => setForm({ ...form, heroImageCaption: e.target.value })}
                className={s.formInput}
                placeholder="Feature image · Monsoon herbs"
              />
            </div>

            <div className={s.formGroup}>
              <label>Article content *</label>
              <RichTextEditor
                value={form.content}
                onChange={(html) => setForm((prev) => ({ ...prev, content: html }))}
                placeholder="Begin with the lede…"
                minHeight="22rem"
              />
            </div>

            <div className={s.formGroup}>
              <label>Related formulations</label>
              <p className={s.helperText}>Shown in the right rail on the article page.</p>
              {form.relatedFormulations.map((row, idx) => (
                <div key={idx} className={s.relatedRow}>
                  <input
                    type="text"
                    value={row.name}
                    onChange={(e) => setRelated(idx, { name: e.target.value })}
                    className={s.formInput}
                    placeholder="Ovanav"
                  />
                  <input
                    type="text"
                    value={row.dhatu ?? ''}
                    onChange={(e) => setRelated(idx, { dhatu: e.target.value })}
                    className={s.formInput}
                    placeholder="FOR RASA & RAKTA DHATU"
                  />
                  <button type="button" onClick={() => removeRelated(idx)} className={s.relatedRemoveBtn}>
                    Remove
                  </button>
                </div>
              ))}
              <button type="button" onClick={addRelated} className={s.relatedAddBtn}>
                + Add related formulation
              </button>
            </div>

            <div className={s.checkboxRow}>
              <input
                id="blog-active"
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              />
              <label htmlFor="blog-active">Active (uncheck to hide from website without deleting)</label>
            </div>

            <div className={s.formActions}>
              <button type="button" onClick={cancelForm} className={s.cancelBtn}>Cancel</button>
              <button
                type="button"
                onClick={() => submit('DRAFT')}
                disabled={saving}
                className={s.draftBtn}
              >
                {saving ? 'Saving…' : 'Save as Draft'}
              </button>
              <button type="submit" disabled={saving} className={s.saveBtn}>
                {saving ? 'Publishing…' : editing && editing.status === 'PUBLISHED' ? 'Update' : 'Publish'}
              </button>
            </div>
          </form>
        </div>
      )}

      {!showInlineForm && (
        <div className={s.filters}>
          <div className={s.searchWrapper}>
            <input
              type="text"
              placeholder="Search by title, slug, or author…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (page === 1) fetchBlogs(1);
                  else setPage(1);
                }
              }}
              className={s.searchInput}
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  if (page === 1) fetchBlogs(1);
                  else setPage(1);
                }}
                className={s.searchClear}
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>
          <CustomSelect
            options={[
              { label: 'All statuses', value: '' },
              { label: 'Published', value: 'PUBLISHED' },
              { label: 'Draft', value: 'DRAFT' },
            ]}
            value={statusFilter}
            onChange={(val) => {
              setStatusFilter(val as '' | BlogStatus);
              setPage(1);
            }}
            align="left"
            minWidth="10rem"
          />
        </div>
      )}

      {!showInlineForm &&
        (loading ? (
          <div className={s.skeletonList}>
            {[...Array(5)].map((_, i) => (
              <div key={i} className={s.skeletonRow} />
            ))}
          </div>
        ) : blogs.length === 0 ? (
          <div className={s.emptyBox}>
            <div className={s.emptyText}>No blogs yet. Click “New Article” to write your first one.</div>
          </div>
        ) : (
          <div className={s.tableWrap}>
            <div className={s.mobileList}>
              {blogs.map((blog) => (
                <article key={`m-${blog.id}`} className={s.mobileCard}>
                  <div className={s.mobileCardTop}>
                    <div className={s.titleCell}>
                      {blog.heroImage ? (
                        <img
                          src={`${API_BASE}${blog.heroImage}`}
                          alt={blog.title}
                          className={s.heroThumb}
                        />
                      ) : (
                        <div className={s.heroPlaceholder}>B</div>
                      )}
                      <div className={s.titleText}>
                        <p className={s.titleName}>{blog.title}</p>
                        <span className={s.titleSlug}>/{blog.slug}</span>
                        {blog.excerpt && <p className={s.titleExcerpt}>{blog.excerpt}</p>}
                      </div>
                    </div>
                  </div>
                  <div className={s.mobileMetaGrid}>
                    <div className={s.mobileMetaItem}>
                      <span className={s.mobileMetaLabel}>Category</span>
                      <span className={s.metaText}>{blog.category || '—'}</span>
                    </div>
                    <div className={s.mobileMetaItem}>
                      <span className={s.mobileMetaLabel}>Author</span>
                      <span className={s.metaText}>{blog.authorName || '—'}</span>
                    </div>
                    <div className={s.mobileMetaItem}>
                      <span className={s.mobileMetaLabel}>Status</span>
                      <button
                        onClick={() => canManage && handleToggleStatus(blog)}
                        className={`${s.statusBadge} ${
                          blog.status === 'PUBLISHED' ? s.statusPublished : s.statusDraft
                        }`}
                      >
                        {blog.status === 'PUBLISHED' ? 'Published' : 'Draft'}
                      </button>
                    </div>
                    <div className={s.mobileMetaItem}>
                      <span className={s.mobileMetaLabel}>Updated</span>
                      <span className={s.dateText}>{formatDate(blog.updatedAt)}</span>
                    </div>
                  </div>
                  {canManage && (
                    <div className={s.mobileActions}>
                      <button onClick={() => openEdit(blog)} className={s.mobileEditBtn}>Edit</button>
                      <button onClick={() => setDeleteTarget(blog)} className={s.mobileDeleteBtn}>Delete</button>
                    </div>
                  )}
                </article>
              ))}
            </div>

            <table className={s.table}>
              <thead className={s.thead}>
                <tr>
                  <th className={`${s.th} ${s.thSortable}`} onClick={() => handleSort('title')}>
                    Article{sortField === 'title' ? (sortOrder === 'asc' ? ' ↑' : ' ↓') : ' ↕'}
                  </th>
                  <th className={`${s.th} ${s.hideMd} ${s.thSortable}`} onClick={() => handleSort('category')}>
                    Category{sortField === 'category' ? (sortOrder === 'asc' ? ' ↑' : ' ↓') : ' ↕'}
                  </th>
                  <th className={`${s.th} ${s.hideMd}`}>Author</th>
                  <th className={`${s.th} ${s.thSortable}`} onClick={() => handleSort('status')}>
                    Status{sortField === 'status' ? (sortOrder === 'asc' ? ' ↑' : ' ↓') : ' ↕'}
                  </th>
                  <th className={`${s.th} ${s.hideMd} ${s.thSortable}`} onClick={() => handleSort('publishedAt')}>
                    Published{sortField === 'publishedAt' ? (sortOrder === 'asc' ? ' ↑' : ' ↓') : ' ↕'}
                  </th>
                  {canManage && <th className={`${s.th} ${s.thRight}`}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {blogs.map((blog) => (
                  <tr key={blog.id} className={s.tr}>
                    <td className={s.td}>
                      <div className={s.titleCell}>
                        {blog.heroImage ? (
                          <img
                            src={`${API_BASE}${blog.heroImage}`}
                            alt={blog.title}
                            className={s.heroThumb}
                          />
                        ) : (
                          <div className={s.heroPlaceholder}>B</div>
                        )}
                        <div className={s.titleText}>
                          <p className={s.titleName}>{blog.title}</p>
                          <span className={s.titleSlug}>/{blog.slug}</span>
                          {blog.excerpt && <p className={s.titleExcerpt}>{blog.excerpt}</p>}
                        </div>
                      </div>
                    </td>
                    <td className={`${s.td} ${s.hideMd}`}>
                      {blog.category ? <span className={s.categoryBadge}>{blog.category}</span> : '—'}
                    </td>
                    <td className={`${s.td} ${s.hideMd}`}>
                      <span className={s.metaText}>{blog.authorName || '—'}</span>
                    </td>
                    <td className={s.td}>
                      <button
                        type="button"
                        onClick={() => canManage && handleToggleStatus(blog)}
                        disabled={!canManage}
                        className={`${s.statusBadge} ${
                          blog.status === 'PUBLISHED' ? s.statusPublished : s.statusDraft
                        }`}
                        title={canManage ? 'Click to toggle' : ''}
                      >
                        {blog.status === 'PUBLISHED' ? 'Published' : 'Draft'}
                      </button>
                      {!blog.isActive && <span className={s.statusBadge + ' ' + s.statusInactive} style={{ marginLeft: '0.4rem' }}>Hidden</span>}
                    </td>
                    <td className={`${s.td} ${s.hideMd}`}>
                      <span className={s.dateText}>{formatDate(blog.publishedAt)}</span>
                    </td>
                    {canManage && (
                      <td className={`${s.td} ${s.tdRight}`}>
                        <button onClick={() => openEdit(blog)} className={s.editBtn}>Edit</button>
                        <button onClick={() => setDeleteTarget(blog)} className={s.deleteBtn}>Delete</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>

            <div className={s.pagination}>
              <button onClick={() => setPage(page - 1)} disabled={page <= 1} className={s.pageBtn}>
                Prev
              </button>
              <span className={s.pageInfo}>
                Page {page} of {totalPages} ({total} blogs)
              </span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page >= totalPages}
                className={s.pageBtn}
              >
                Next
              </button>
              <CustomSelect
                options={[10, 20, 30, 50].map((n) => ({ label: `${n} / page`, value: n }))}
                value={pageSize}
                onChange={(val) => {
                  setPageSize(Number(val));
                  setPage(1);
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
            <h3 className={s.deleteTitle}>Delete blog</h3>
            <p className={s.deleteMsg}>
              Are you sure you want to delete &ldquo;{deleteTarget.title}&rdquo;? This cannot be undone.
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
