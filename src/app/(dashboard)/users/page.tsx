'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { User } from '@/types';
import { CustomSelect } from '@/components/ui/CustomSelect';
import s from './users.module.scss';

const roleCls = (role: string) => {
  switch (role) {
    case 'SUPER_ADMIN':
      return s.roleSuperAdmin;
    case 'ADMIN':
      return s.roleAdmin;
    default:
      return s.roleTeamMember;
  }
};

interface EditForm {
  userCode: string;
  role: string;
  isActive: boolean;
  isDoctor: boolean;
  canManageProducts: boolean;
  canManageProductSales: boolean;
  canManageLeads: boolean;
  canManageSales: boolean;
  canExportProducts: boolean;
  canExportProductSales: boolean;
  canExportLeads: boolean;
  canExportSales: boolean;
  canManageUsers: boolean;
  canViewDashboard: boolean;
}

interface CreateForm {
  username: string;
  email: string;
  password: string;
  userCode: string;
  role: string;
  isDoctor: boolean;
  canManageProducts: boolean;
  canManageProductSales: boolean;
  canManageLeads: boolean;
  canManageSales: boolean;
  canExportProducts: boolean;
  canExportProductSales: boolean;
  canExportLeads: boolean;
  canExportSales: boolean;
  canManageUsers: boolean;
  canViewDashboard: boolean;
}

const PAGE_PERMISSIONS = [
  { key: 'canViewDashboard', label: 'View Dashboard' },
  { key: 'canManageProducts', label: 'Manage Products' },
  { key: 'canManageProductSales', label: 'Manage Product Sales' },
  { key: 'canManageLeads', label: 'Manage Leads' },
  { key: 'canManageSales', label: 'Manage Sales' },
  { key: 'canManageUsers', label: 'Manage Users' },
] as const;

const EXPORT_PERMISSIONS = [
  {
    key: 'canExportProducts',
    label: 'Export Products',
    dependsOn: 'canManageProducts',
  },
  {
    key: 'canExportProductSales',
    label: 'Export Product Sales',
    dependsOn: 'canManageProductSales',
  },
  {
    key: 'canExportLeads',
    label: 'Export Leads',
    dependsOn: 'canManageLeads',
  },
  {
    key: 'canExportSales',
    label: 'Export Sales',
    dependsOn: 'canManageSales',
  },
] as const;

type PermissionForm = EditForm | CreateForm;
type PagePermissionKey = (typeof PAGE_PERMISSIONS)[number]['key'];
type ExportPermissionKey = (typeof EXPORT_PERMISSIONS)[number]['key'];
type ExportDependencyKey = (typeof EXPORT_PERMISSIONS)[number]['dependsOn'];

const initialEditForm = (): EditForm => ({
  userCode: '',
  role: 'ADMIN',
  isActive: true,
  isDoctor: false,
  canManageProducts: true,
  canManageProductSales: true,
  canManageLeads: true,
  canManageSales: true,
  canExportProducts: true,
  canExportProductSales: true,
  canExportLeads: true,
  canExportSales: true,
  canManageUsers: false,
  canViewDashboard: true,
});

const initialCreateForm = (): CreateForm => ({
  username: '',
  email: '',
  password: '',
  userCode: '',
  role: 'TEAM_MEMBER',
  isDoctor: false,
  canManageProducts: false,
  canManageProductSales: false,
  canManageLeads: true,
  canManageSales: true,
  canExportProducts: false,
  canExportProductSales: false,
  canExportLeads: false,
  canExportSales: false,
  canManageUsers: false,
  canViewDashboard: true,
});

const syncDependentExports = <T extends PermissionForm>(
  form: T,
  pageKey: PagePermissionKey,
  checked: boolean,
): T => {
  if (checked) return { ...form, [pageKey]: checked };

  const exportPermission = EXPORT_PERMISSIONS.find(
    (permission) => permission.dependsOn === pageKey,
  );

  if (!exportPermission) {
    return { ...form, [pageKey]: checked };
  }

  return {
    ...form,
    [pageKey]: checked,
    [exportPermission.key]: false,
  };
};

function PermissionSection<T extends PermissionForm>({
  title,
  description,
  items,
  values,
  onToggle,
  disabledByDependency = false,
}: {
  title: string;
  description: string;
  items: ReadonlyArray<
    | { key: PagePermissionKey; label: string }
    | { key: ExportPermissionKey; label: string; dependsOn: ExportDependencyKey }
  >;
  values: T;
  onToggle: (key: string, checked: boolean) => void;
  disabledByDependency?: boolean;
}) {
  return (
    <section className={s.permissionsCard}>
      <div className={s.sectionHead}>
        <h3 className={s.sectionTitle}>{title}</h3>
        <p className={s.sectionText}>{description}</p>
      </div>
      <div className={s.permissionsGrid}>
        {items.map((item) => {
          const dependencyDisabled =
            disabledByDependency && 'dependsOn' in item
              ? !values[item.dependsOn]
              : false;

          return (
            <label
              key={item.key}
              className={`${s.permissionTile} ${
                dependencyDisabled ? s.permissionTileDisabled : ''
              }`}
            >
              <input
                type="checkbox"
                checked={values[item.key]}
                disabled={dependencyDisabled}
                onChange={(e) => onToggle(item.key, e.target.checked)}
              />
              <span className={s.permissionCopy}>
                <span className={s.permissionLabel}>{item.label}</span>
                {'dependsOn' in item && (
                  <span className={s.permissionHint}>
                    {dependencyDisabled
                      ? 'Enable page access first'
                      : 'Excel export allowed'}
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </div>
    </section>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [error, setError] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [showInlineForm, setShowInlineForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState<EditForm>(initialEditForm());
  const [saving, setSaving] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>(initialCreateForm());
  const [formError, setFormError] = useState('');
  const [sortField, setSortField] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('sortBy', sortField);
      params.set('order', sortOrder);
      const res = await api.get(`/users?${params.toString()}`);
      setUsers(res.data);
    } catch {
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [sortField, sortOrder]);

  const handleToggle = async (id: number) => {
    try {
      await api.put(`/users/${id}/toggle`);
      fetchUsers();
    } catch {}
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await api.delete(`/users/${deletingId}`);
      setShowDeleteModal(false);
      fetchUsers();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete');
    }
  };

  const openCreate = () => {
    setEditingUser(null);
    setCreateForm(initialCreateForm());
    setFormError('');
    setShowInlineForm(true);
  };

  const openEdit = (user: User) => {
    setEditingUser(user);
    setEditForm({
      userCode: user.userCode,
      role: user.role,
      isActive: user.isActive,
      isDoctor: user.isDoctor,
      canManageProducts: user.canManageProducts,
      canManageProductSales: user.canManageProductSales,
      canManageLeads: user.canManageLeads,
      canManageSales: user.canManageSales,
      canExportProducts: user.canExportProducts,
      canExportProductSales: user.canExportProductSales,
      canExportLeads: user.canExportLeads,
      canExportSales: user.canExportSales,
      canManageUsers: user.canManageUsers,
      canViewDashboard: user.canViewDashboard,
    });
    setFormError('');
    setShowInlineForm(true);
  };

  const cancelForm = () => {
    setShowInlineForm(false);
    setEditingUser(null);
    setFormError('');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      const { password, ...rest } = createForm;
      const payload = createForm.role === 'SUPER_ADMIN' ? createForm : rest;
      await api.post('/users', payload);
      setShowInlineForm(false);
      setCreateForm(initialCreateForm());
      fetchUsers();
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to create user');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setSaving(true);
    setFormError('');
    try {
      await api.put(`/users/${editingUser.id}`, editForm);
      setShowInlineForm(false);
      setEditingUser(null);
      fetchUsers();
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const handleCreatePagePermissionChange = (
    key: PagePermissionKey,
    checked: boolean,
  ) => {
    setCreateForm((prev) => syncDependentExports(prev, key, checked));
  };

  const handleEditPagePermissionChange = (
    key: PagePermissionKey,
    checked: boolean,
  ) => {
    setEditForm((prev) => syncDependentExports(prev, key, checked));
  };

  const filtered = users.filter(
    (u) =>
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()),
  );
  const totalFiltered = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const paginatedUsers = filtered.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [search, pageSize]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const goToPage = (nextPage: number) => {
    setPage(nextPage);
  };

  return (
    <div className={s.page}>
      <div className={s.header}>
        <div>
          <h2 className={s.pageTitle}>Users</h2>
          <p className={s.pageSubtitle}>{users.length} total users</p>
        </div>
        <button onClick={openCreate} className={s.addBtn}>
          + Add User
        </button>
      </div>

      {error && <div className={s.error}>{error}</div>}

      {showInlineForm && (
        <div className={s.inlineFormWrap}>
          <form
            onSubmit={editingUser ? handleEdit : handleCreate}
            className={s.inlineForm}
          >
            <h2 className={s.inlineFormTitle}>
              {editingUser ? `Edit - ${editingUser.username}` : 'New User'}
            </h2>
            {formError && <div className={s.formError}>{formError}</div>}

            {!editingUser && (
              <>
                <section className={s.formSection}>
                  <div className={s.sectionHead}>
                    <h3 className={s.sectionTitle}>Account Details</h3>
                    <p className={s.sectionText}>
                      Add the user&apos;s login details and assign a role.
                    </p>
                  </div>
                  <div className={s.formGridTwo}>
                    <div className={s.formGroup}>
                      <label>Username</label>
                      <input
                        type="text"
                        required
                        value={createForm.username}
                        onChange={(e) =>
                          setCreateForm((p) => ({
                            ...p,
                            username: e.target.value,
                          }))
                        }
                        className={s.formInput}
                      />
                    </div>
                    <div className={s.formGroup}>
                      <label>Email</label>
                      <input
                        type="email"
                        required
                        value={createForm.email}
                        onChange={(e) =>
                          setCreateForm((p) => ({ ...p, email: e.target.value }))
                        }
                        className={s.formInput}
                      />
                    </div>
                    <div className={s.formGroup}>
                      <label>User Code</label>
                      <input
                        type="text"
                        value={createForm.userCode}
                        onChange={(e) =>
                          setCreateForm((p) => ({
                            ...p,
                            userCode: e.target.value.toUpperCase(),
                          }))
                        }
                        className={s.formInput}
                        placeholder="Auto-generated if left blank"
                      />
                    </div>
                  </div>
                  <div className={s.formGridTwo}>
                    {createForm.role === 'SUPER_ADMIN' && (
                      <div className={s.formGroup}>
                        <label>Password</label>
                        <input
                          type="password"
                          required
                          minLength={6}
                          value={createForm.password}
                          onChange={(e) =>
                            setCreateForm((p) => ({
                              ...p,
                              password: e.target.value,
                            }))
                          }
                          className={s.formInput}
                        />
                      </div>
                    )}
                    <div className={s.formGroup}>
                      <label>Role</label>
                      <CustomSelect
                        options={[
                          { label: 'Super Admin', value: 'SUPER_ADMIN' },
                          { label: 'Admin', value: 'ADMIN' },
                          { label: 'Team Member', value: 'TEAM_MEMBER' },
                        ]}
                        value={createForm.role}
                        onChange={(val) => setCreateForm((p) => ({ ...p, role: String(val) }))}
                        align="left"
                        minWidth="100%"
                      />
                    </div>
                  </div>
                  <div className={s.checkboxRow}>
                    <input
                      type="checkbox"
                      id="c-isDoctor"
                      checked={createForm.isDoctor}
                      onChange={(e) =>
                        setCreateForm((p) => ({
                          ...p,
                          isDoctor: e.target.checked,
                        }))
                      }
                    />
                    <label htmlFor="c-isDoctor">Is Doctor</label>
                  </div>
                </section>

                {createForm.role !== 'SUPER_ADMIN' && (
                  <div className={s.permissionsLayout}>
                    <PermissionSection
                      title="Page Access"
                      description="Choose which parts of the app this user can work with."
                      items={PAGE_PERMISSIONS}
                      values={createForm}
                      onToggle={(key, checked) =>
                        handleCreatePagePermissionChange(
                          key as PagePermissionKey,
                          checked,
                        )
                      }
                    />
                    <PermissionSection
                      title="Export Access"
                      description="Decide which pages can export Excel for this user."
                      items={EXPORT_PERMISSIONS}
                      values={createForm}
                      onToggle={(key, checked) =>
                        setCreateForm((p) => ({
                          ...p,
                          [key]: checked,
                        }))
                      }
                      disabledByDependency
                    />
                  </div>
                )}
              </>
            )}

            {editingUser && (
              <>
                <section className={s.formSection}>
                  <div className={s.sectionHead}>
                    <h3 className={s.sectionTitle}>Account Settings</h3>
                    <p className={s.sectionText}>
                      Update role, status, and doctor access here.
                    </p>
                  </div>
                  <div className={s.formGridTwo}>
                    <div className={s.formGroup}>
                      <label>User Code</label>
                      <input
                        type="text"
                        value={editForm.userCode}
                        onChange={(e) =>
                          setEditForm((p) => ({
                            ...p,
                            userCode: e.target.value.toUpperCase(),
                          }))
                        }
                        className={s.formInput}
                      />
                    </div>
                    <div className={s.formGroup}>
                      <label>Role</label>
                      <CustomSelect
                        options={[
                          { label: 'Super Admin', value: 'SUPER_ADMIN' },
                          { label: 'Admin', value: 'ADMIN' },
                          { label: 'Team Member', value: 'TEAM_MEMBER' },
                        ]}
                        value={editForm.role}
                        onChange={(val) => setEditForm((p) => ({ ...p, role: String(val) }))}
                        align="left"
                        minWidth="100%"
                      />
                    </div>
                  </div>
                  <div className={s.formInlineChecks}>
                    <div className={s.checkboxRow}>
                      <input
                        type="checkbox"
                        id="userActive"
                        checked={editForm.isActive}
                        onChange={(e) =>
                          setEditForm((p) => ({
                            ...p,
                            isActive: e.target.checked,
                          }))
                        }
                      />
                      <label htmlFor="userActive">Active</label>
                    </div>
                    <div className={s.checkboxRow}>
                      <input
                        type="checkbox"
                        id="userIsDoctor"
                        checked={editForm.isDoctor}
                        onChange={(e) =>
                          setEditForm((p) => ({
                            ...p,
                            isDoctor: e.target.checked,
                          }))
                        }
                      />
                      <label htmlFor="userIsDoctor">Is Doctor</label>
                    </div>
                  </div>
                </section>

                {editForm.role !== 'SUPER_ADMIN' && (
                  <div className={s.permissionsLayout}>
                    <PermissionSection
                      title="Page Access"
                      description="Enable only the modules this user should open and manage."
                      items={PAGE_PERMISSIONS}
                      values={editForm}
                      onToggle={(key, checked) =>
                        handleEditPagePermissionChange(
                          key as PagePermissionKey,
                          checked,
                        )
                      }
                    />
                    <PermissionSection
                      title="Export Access"
                      description="Keep Excel exports separate from regular page permissions."
                      items={EXPORT_PERMISSIONS}
                      values={editForm}
                      onToggle={(key, checked) =>
                        setEditForm((p) => ({
                          ...p,
                          [key]: checked,
                        }))
                      }
                      disabledByDependency
                    />
                  </div>
                )}
              </>
            )}

            <div className={s.formActions}>
              <button
                type="button"
                onClick={cancelForm}
                className={s.cancelBtn}
              >
                Cancel
              </button>
              <button type="submit" disabled={saving} className={s.saveBtn}>
                {saving
                  ? 'Saving...'
                  : editingUser
                    ? 'Save Changes'
                    : 'Create User'}
              </button>
            </div>
          </form>
        </div>
      )}

      {!showInlineForm && (
        <div className={s.searchBox}>
          <input
            type="text"
            placeholder="Search by username or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={s.searchInput}
          />
        </div>
      )}

      {!showInlineForm && (
        <div className={s.tableWrap}>
          <div className={s.mobileList}>
            {loading ? (
              [...Array(4)].map((_, i) => (
                <div key={i} className={s.mobileSkeletonCard} />
              ))
            ) : filtered.length === 0 ? (
              <div className={s.emptyBox}>
                <div className={s.emptyText}>No users found</div>
              </div>
            ) : (
              paginatedUsers.map((user) => (
                <article key={`mobile-${user.id}`} className={s.mobileCard}>
                  <div className={s.mobileCardHeader}>
                    <div className={s.userCell}>
                      <div className={s.avatar}>
                        <span>{user.username.charAt(0).toUpperCase()}</span>
                      </div>
                      <div>
                        <p className={s.username}>{user.username}</p>
                        <p className={s.email}>{user.email}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleToggle(user.id)}
                      className={`${s.statusBtn} ${user.isActive ? s.statusActive : s.statusInactive}`}
                    >
                      {user.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </div>

                  <div className={s.mobileRoleRow}>
                    <span className={`${s.rolePill} ${roleCls(user.role)}`}>
                      {user.role.replace(/_/g, ' ')}
                    </span>
                    {user.isDoctor && <span className={s.doctorBadge}>Doctor</span>}
                  </div>

                  <div className={s.mobileMetaGrid}>
                    <div className={s.mobileMetaItem}>
                      <span className={s.mobileMetaLabel}>User Code</span>
                      <span className={s.email}>{user.userCode || '-'}</span>
                    </div>
                    <div className={s.mobileMetaItem}>
                      <span className={s.mobileMetaLabel}>Joined</span>
                      <span className={s.joinedDate}>
                        {new Date(user.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>

                  <div className={s.mobileActions}>
                    <button onClick={() => openEdit(user)} className={s.mobileEditBtn}>
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        setDeletingId(user.id);
                        setShowDeleteModal(true);
                      }}
                      className={s.mobileDeleteBtn}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>

          <div className={s.tableScroll}>
            <table className={s.table}>
              <thead className={s.thead}>
                <tr>
                  <th className={`${s.th} ${s.thSortable}`} onClick={() => handleSort('username')}>User{sortField === 'username' ? (sortOrder === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</th>
                  <th className={`${s.th} ${s.thSortable}`} onClick={() => handleSort('userCode')}>User Code{sortField === 'userCode' ? (sortOrder === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</th>
                  <th className={`${s.th} ${s.thSortable}`} onClick={() => handleSort('role')}>Role{sortField === 'role' ? (sortOrder === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</th>
                  <th className={`${s.th} ${s.hideLg} ${s.thSortable}`} onClick={() => handleSort('createdAt')}>Joined{sortField === 'createdAt' ? (sortOrder === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</th>
                  <th className={s.th}>Status</th>
                  <th className={`${s.th} ${s.thRight}`}>Actions</th>
                </tr>
              </thead>
              <tbody className={s.tbody}>
                {loading ? (
                  [...Array(4)].map((_, i) => (
                    <tr key={i} className={s.tr}>
                      <td colSpan={6} className={s.td}>
                        <div
                          style={{
                            height: '2rem',
                            backgroundColor: 'var(--shell-elevated)',
                            borderRadius: '0.375rem',
                            animation: 'pulse 2s infinite',
                          }}
                        />
                      </td>
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr className={s.emptyRow}>
                    <td colSpan={6}>No users found</td>
                  </tr>
                ) : (
                  paginatedUsers.map((user) => (
                    <tr key={user.id} className={s.tr}>
                      <td className={s.td}>
                        <div className={s.userCell}>
                          <div className={s.avatar}>
                            <span>{user.username.charAt(0).toUpperCase()}</span>
                          </div>
                          <div>
                            <p className={s.username}>{user.username}</p>
                            <p className={s.email}>{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className={s.td}>
                        <span className={s.email}>{user.userCode}</span>
                      </td>
                      <td className={s.td}>
                        <span className={`${s.rolePill} ${roleCls(user.role)}`}>
                          {user.role.replace(/_/g, ' ')}
                        </span>
                        {user.isDoctor && (
                          <span className={s.doctorBadge}>Doctor</span>
                        )}
                      </td>
                      <td className={`${s.td} ${s.hideLg}`}>
                        <span className={s.joinedDate}>
                          {new Date(user.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      </td>
                      <td className={s.td}>
                        <button
                          onClick={() => handleToggle(user.id)}
                          className={`${s.statusBtn} ${
                            user.isActive ? s.statusActive : s.statusInactive
                          }`}
                        >
                          {user.isActive ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className={`${s.td} ${s.tdRight}`}>
                        <div className={s.actions}>
                          <button
                            onClick={() => openEdit(user)}
                            className={s.editBtn}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              setDeletingId(user.id);
                              setShowDeleteModal(true);
                            }}
                            className={s.deleteBtn}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className={s.pagination}>
            <button
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1}
              className={s.pageBtn}
            >
              Prev
            </button>
            <span className={s.pageInfo}>
              Page {page} of {totalPages} ({totalFiltered} users)
            </span>
            <button
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages}
              className={s.pageBtn}
            >
              Next
            </button>
            <CustomSelect
              options={[10, 20, 30, 50].map((n) => ({ label: `${n} / page`, value: n }))}
              value={pageSize}
              onChange={(val) => {
                const next = Number(val);
                setPageSize(next);
                setPage(1);
              }}
              align="right"
              direction="up"
            />
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className={s.overlay}>
          <div className={s.deleteModal}>
            <div className={s.deleteIconWrap}>
              <span>!</span>
            </div>
            <h3 className={s.deleteTitle}>Delete User?</h3>
            <p className={s.deleteMsg}>This action cannot be undone.</p>
            <div className={s.deleteActions}>
              <button
                onClick={() => setShowDeleteModal(false)}
                className={s.deleteCancelBtn}
              >
                Cancel
              </button>
              <button onClick={handleDelete} className={s.deleteConfirmBtn}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
