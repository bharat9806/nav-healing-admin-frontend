'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { User } from '@/types';
import s from './users.module.scss';

const roleCls = (role: string) => {
  switch (role) {
    case 'SUPER_ADMIN': return s.roleSuperAdmin;
    case 'ADMIN':       return s.roleAdmin;
    default:            return s.roleTeamMember;
  }
};

interface EditForm {
  role: string; isActive: boolean; isDoctor: boolean;
  canManageProducts: boolean; canManageLeads: boolean;
  canManageUsers: boolean; canViewDashboard: boolean;
}

interface CreateForm {
  username: string; email: string; password: string; role: string; isDoctor: boolean;
  canManageProducts: boolean; canManageLeads: boolean;
  canManageUsers: boolean; canViewDashboard: boolean;
}

const PERMISSIONS = [
  { key: 'canViewDashboard',    label: 'View Dashboard' },
  { key: 'canManageProducts',   label: 'Manage Products' },
  { key: 'canManageLeads',      label: 'Manage Leads' },
  { key: 'canManageUsers',      label: 'Manage Users' },
];

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [showInlineForm, setShowInlineForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    role: 'ADMIN', isActive: true, isDoctor: false,
    canManageProducts: true, canManageLeads: true,
    canManageUsers: false, canViewDashboard: true,
  });
  const [saving, setSaving] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>({
    username: '', email: '', password: '', role: 'TEAM_MEMBER', isDoctor: false,
    canManageProducts: false, canManageLeads: true,
    canManageUsers: false, canViewDashboard: true,
  });
  const [formError, setFormError] = useState('');

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/users');
      setUsers(res.data);
    } catch { setError('Failed to load users'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleToggle = async (id: number) => {
    try { await api.put(`/users/${id}/toggle`); fetchUsers(); } catch {}
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try { await api.delete(`/users/${deletingId}`); setShowDeleteModal(false); fetchUsers(); }
    catch (err: any) { setError(err.response?.data?.message || 'Failed to delete'); }
  };

  const openCreate = () => {
    setEditingUser(null);
    setCreateForm({ username: '', email: '', password: '', role: 'TEAM_MEMBER', isDoctor: false, canManageProducts: false, canManageLeads: true, canManageUsers: false, canViewDashboard: true });
    setFormError('');
    setShowInlineForm(true);
  };

  const openEdit = (user: User) => {
    setEditingUser(user);
    setEditForm({
      role: user.role, isActive: user.isActive, isDoctor: user.isDoctor,
      canManageProducts: user.canManageProducts, canManageLeads: user.canManageLeads,
      canManageUsers: user.canManageUsers, canViewDashboard: user.canViewDashboard,
    });
    setFormError('');
    setShowInlineForm(true);
  };

  const cancelForm = () => { setShowInlineForm(false); setEditingUser(null); setFormError(''); };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setFormError('');
    try {
      await api.post('/users', createForm);
      setShowInlineForm(false);
      setCreateForm({ username: '', email: '', password: '', role: 'TEAM_MEMBER', isDoctor: false, canManageProducts: false, canManageLeads: true, canManageUsers: false, canViewDashboard: true });
      fetchUsers();
    } catch (err: any) { setFormError(err.response?.data?.message || 'Failed to create user'); }
    finally { setSaving(false); }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setSaving(true); setFormError('');
    try { await api.put(`/users/${editingUser.id}`, editForm); setShowInlineForm(false); setEditingUser(null); fetchUsers(); }
    catch (err: any) { setFormError(err.response?.data?.message || 'Failed to update'); }
    finally { setSaving(false); }
  };

  const filtered = users.filter(u =>
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={s.page}>
      <div className={s.header}>
        <div>
          <h2 className={s.pageTitle}>Users</h2>
          <p className={s.pageSubtitle}>{users.length} total users</p>
        </div>
        <button onClick={openCreate} className={s.addBtn}>+ Add User</button>
      </div>

      {error && <div className={s.error}>{error}</div>}

      {showInlineForm && (
        <div className={s.inlineFormWrap}>
          <form onSubmit={editingUser ? handleEdit : handleCreate} className={s.inlineForm}>
            <h2 className={s.inlineFormTitle}>{editingUser ? `Edit — ${editingUser.username}` : 'New User'}</h2>
            {formError && <div className={s.formError}>{formError}</div>}
            {!editingUser && (
              <>
                <div className={s.formGroup}>
                  <label>Username</label>
                  <input type="text" required value={createForm.username} onChange={e => setCreateForm(p => ({ ...p, username: e.target.value }))} className={s.formInput} />
                </div>
                <div className={s.formGroup}>
                  <label>Email</label>
                  <input type="email" required value={createForm.email} onChange={e => setCreateForm(p => ({ ...p, email: e.target.value }))} className={s.formInput} />
                </div>
                <div className={s.formGroup}>
                  <label>Password</label>
                  <input type="password" required minLength={6} value={createForm.password} onChange={e => setCreateForm(p => ({ ...p, password: e.target.value }))} className={s.formInput} />
                </div>
                <div className={s.formGroup}>
                  <label>Role</label>
                  <select value={createForm.role} onChange={e => setCreateForm(p => ({ ...p, role: e.target.value }))} className={s.formSelect}>
                    <option value="SUPER_ADMIN">Super Admin</option>
                    <option value="ADMIN">Admin</option>
                    <option value="TEAM_MEMBER">Team Member</option>
                  </select>
                </div>
                <div className={s.checkboxRow}>
                  <input type="checkbox" id="c-isDoctor" checked={createForm.isDoctor} onChange={e => setCreateForm(p => ({ ...p, isDoctor: e.target.checked }))} />
                  <label htmlFor="c-isDoctor">Is Doctor</label>
                </div>
                {createForm.role !== 'SUPER_ADMIN' && (
                  <div className={s.permissionsBox}>
                    <p className={s.permissionsTitle}>Permissions</p>
                    {PERMISSIONS.map(({ key, label }) => (
                      <div key={key} className={s.checkboxRow}>
                        <input type="checkbox" id={`c-${key}`} checked={(createForm as any)[key]} onChange={e => setCreateForm(p => ({ ...p, [key]: e.target.checked }))} />
                        <label htmlFor={`c-${key}`}>{label}</label>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
            {editingUser && (
              <>
                <div className={s.formGroup}>
                  <label>Role</label>
                  <select value={editForm.role} onChange={e => setEditForm(p => ({ ...p, role: e.target.value }))} className={s.formSelect}>
                    <option value="SUPER_ADMIN">Super Admin</option>
                    <option value="ADMIN">Admin</option>
                    <option value="TEAM_MEMBER">Team Member</option>
                  </select>
                </div>
                <div className={s.checkboxRow}>
                  <input type="checkbox" id="userActive" checked={editForm.isActive} onChange={e => setEditForm(p => ({ ...p, isActive: e.target.checked }))} />
                  <label htmlFor="userActive">Active</label>
                </div>
                <div className={s.checkboxRow}>
                  <input type="checkbox" id="userIsDoctor" checked={editForm.isDoctor} onChange={e => setEditForm(p => ({ ...p, isDoctor: e.target.checked }))} />
                  <label htmlFor="userIsDoctor">Is Doctor</label>
                </div>
                {editForm.role !== 'SUPER_ADMIN' && (
                  <div className={s.permissionsBox}>
                    <p className={s.permissionsTitle}>Permissions</p>
                    {PERMISSIONS.map(({ key, label }) => (
                      <div key={key} className={s.checkboxRow}>
                        <input type="checkbox" id={key} checked={(editForm as any)[key]} onChange={e => setEditForm(p => ({ ...p, [key]: e.target.checked }))} />
                        <label htmlFor={key}>{label}</label>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
            <div className={s.formActions}>
              <button type="button" onClick={cancelForm} className={s.cancelBtn}>Cancel</button>
              <button type="submit" disabled={saving} className={s.saveBtn}>{saving ? 'Saving...' : editingUser ? 'Save Changes' : 'Create User'}</button>
            </div>
          </form>
        </div>
      )}

      {!showInlineForm && (
        <div className={s.searchBox}>
          <input type="text" placeholder="Search by username or email..." value={search}
            onChange={e => setSearch(e.target.value)} className={s.searchInput} />
        </div>
      )}

      {!showInlineForm && (
      <div className={s.tableWrap}>
        <div className={s.tableScroll}>
          <table className={s.table}>
            <thead className={s.thead}>
              <tr>
                <th className={s.th}>User</th>
                <th className={s.th}>Role</th>
                <th className={`${s.th} ${s.hideLg}`}>Joined</th>
                <th className={s.th}>Status</th>
                <th className={`${s.th} ${s.thRight}`}>Actions</th>
              </tr>
            </thead>
            <tbody className={s.tbody}>
              {loading ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i} className={s.tr}>
                    <td colSpan={5} className={s.td}>
                      <div style={{ height: '2rem', backgroundColor: '#1f2937', borderRadius: '0.375rem', animation: 'pulse 2s infinite' }} />
                    </td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr className={s.emptyRow}><td colSpan={5}>No users found</td></tr>
              ) : (
                filtered.map(user => (
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
                      <span className={`${s.rolePill} ${roleCls(user.role)}`}>
                        {user.role.replace(/_/g, ' ')}
                      </span>
                      {user.isDoctor && <span className={s.doctorBadge}>Doctor</span>}
                    </td>
                    <td className={`${s.td} ${s.hideLg}`}>
                      <span className={s.joinedDate}>
                        {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </td>
                    <td className={s.td}>
                      <button onClick={() => handleToggle(user.id)}
                        className={`${s.statusBtn} ${user.isActive ? s.statusActive : s.statusInactive}`}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className={`${s.td} ${s.tdRight}`}>
                      <div className={s.actions}>
                        <button onClick={() => openEdit(user)} className={s.editBtn}>Edit</button>
                        <button onClick={() => { setDeletingId(user.id); setShowDeleteModal(true); }} className={s.deleteBtn}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {showDeleteModal && (
        <div className={s.overlay}>
          <div className={s.deleteModal}>
            <div className={s.deleteIconWrap}><span>!</span></div>
            <h3 className={s.deleteTitle}>Delete User?</h3>
            <p className={s.deleteMsg}>This action cannot be undone.</p>
            <div className={s.deleteActions}>
              <button onClick={() => setShowDeleteModal(false)} className={s.deleteCancelBtn}>Cancel</button>
              <button onClick={handleDelete} className={s.deleteConfirmBtn}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
