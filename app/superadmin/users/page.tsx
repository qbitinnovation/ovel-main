'use client';

import { useState, useEffect, useCallback } from 'react';

interface UserPosition {
  _id: string;
  name: string;
  isActive: boolean;
}

interface UserRecord {
  _id: string;
  name: string;
  email: string;
  phone: string;
  userType: string;
  portalType: string;
  positionId: UserPosition | null;
  isActive: boolean;
  isArchived: boolean;
  lastLogin: string | null;
  createdAt: string;
}

const portalOptions = [
  { value: 'committee', label: 'Committee Member Portal' },
  { value: 'turf', label: 'Turf Manager Portal' },
  { value: 'shareholder', label: 'Shareholder Portal' },
];

const portalLabel = (portalType: string) =>
  portalOptions.find((portal) => portal.value === portalType)?.label.replace(' Portal', '') || portalType;

export default function UsersPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [positions, setPositions] = useState<UserPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterPortal, setFilterPortal] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Create/Edit User modal
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', portalType: 'committee', positionName: '', password: '' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [tempPasswordDisplay, setTempPasswordDisplay] = useState<string | null>(null);

  // Confirm action modal
  const [confirmAction, setConfirmAction] = useState<{ user: UserRecord; action: string } | null>(null);

  // Reset password modal
  const [resetUser, setResetUser] = useState<UserRecord | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetResult, setResetResult] = useState<string | null>(null);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: string } | null>(null);
  const showToast = (message: string, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const copyText = async (text: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      showToast('Copied to clipboard');
    } catch {
      showToast('Copy failed. Select the text manually.', 'error');
    }
  };

  const fetchUsers = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (filterType) params.set('userType', filterType);
      if (filterPortal) params.set('portalType', filterPortal);
      if (filterStatus) params.set('status', filterStatus);
      params.set('limit', '100');

      const res = await fetch(`/api/users?${params}`);
      const data = await res.json();
      if (data.success) setUsers(data.data.users);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoading(false);
    }
  }, [search, filterType, filterPortal, filterStatus]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const fetchPositions = useCallback(async () => {
    try {
      const res = await fetch('/api/positions');
      const data = await res.json();
      if (data.success) setPositions(data.data || []);
    } catch (err) {
      console.error('Failed to fetch positions:', err);
    }
  }, []);

  useEffect(() => { fetchPositions(); }, [fetchPositions]);

  const openCreateModal = () => {
    setEditingUser(null);
    setForm({ name: '', email: '', phone: '', portalType: 'committee', positionName: '', password: '' });
    setFormError('');
    setTempPasswordDisplay(null);
    setShowModal(true);
  };

  const openEditModal = (u: UserRecord) => {
    setEditingUser(u);
    setForm({ name: u.name, email: u.email, phone: u.phone, portalType: u.portalType, positionName: u.positionId?.name || '', password: '' });
    setFormError('');
    setTempPasswordDisplay(null);
    setShowModal(true);
  };

  const handleSaveUser = async () => {
    if (!form.name.trim()) return setFormError('Full name is required');
    if (!editingUser && !form.email.trim()) return setFormError('Email is required');
    if (!form.phone.trim()) return setFormError('Phone number is required');
    if (form.portalType === 'committee' && !form.positionName.trim()) return setFormError('Committee member position is required');
    setSaving(true); setFormError('');

    try {
      if (editingUser) {
        const res = await fetch(`/api/users/${editingUser._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: form.name, phone: form.phone, portalType: form.portalType, positionName: form.positionName }),
        });
        const data = await res.json();
        if (data.success) { showToast('User updated'); setShowModal(false); fetchUsers(); fetchPositions(); }
        else setFormError(data.message);
      } else {
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (data.success) {
          showToast('User created');
          if (data.data.tempPassword) setTempPasswordDisplay(data.data.tempPassword);
          else { setShowModal(false); }
          fetchUsers();
          fetchPositions();
        } else setFormError(data.message);
      }
    } catch { setFormError('Network error'); }
    finally { setSaving(false); }
  };

  const handleAction = async (user: UserRecord, action: string) => {
    setConfirmAction(null);
    try {
      if (action === 'delete') {
        const res = await fetch(`/api/users/${user._id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) { showToast(data.message); fetchUsers(); }
        else showToast(data.message || 'Failed', 'error');
        return;
      }

      const res = await fetch(`/api/users/${user._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (data.success) { showToast(data.message); fetchUsers(); }
      else showToast(data.message || 'Failed', 'error');
    } catch { showToast('Network error', 'error'); }
  };

  const handleResetPassword = async () => {
    if (!resetUser) return;
    try {
      const res = await fetch(`/api/users/${resetUser._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset-password', password: resetPassword || undefined }),
      });
      const data = await res.json();
      if (data.success) {
        setResetResult(data.data.tempPassword || 'Password reset to provided value');
        showToast('Password reset');
      } else showToast(data.message || 'Failed', 'error');
    } catch { showToast('Network error', 'error'); }
  };

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

  const statusOf = (u: UserRecord) => {
    if (u.isArchived) return { label: 'Archived', cls: 'badge-warning' };
    if (!u.isActive) return { label: 'Inactive', cls: 'badge-danger' };
    return { label: 'Active', cls: 'badge-success' };
  };

  return (
    <div className="page-container">
      {/* Toast */}
      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type === 'error' ? 'error' : 'success'}`}>
            <span className="toast-icon">{toast.type === 'error' ? '✕' : '✓'}</span>
            <div className="toast-content"><div className="toast-title">{toast.message}</div></div>
          </div>
        </div>
      )}

      <div className="page-header">
        <div>
          <h1>Users</h1>
          <p className="page-subtitle">Manage portal users and committee member positions</p>
        </div>
        <button className="btn btn-primary btn-md" onClick={openCreateModal} id="btn-create-user">
          + Create User
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-6)', flexWrap: 'wrap' }}>
        <div className="search-input-wrapper" style={{ flex: '1 1 250px' }}>
          <span className="search-icon">🔍</span>
          <input type="text" className="form-input search-input" placeholder="Search by name, email, or phone..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="select-wrapper" style={{ flex: '0 0 auto' }}>
          <select className="form-select" value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{ minWidth: '140px' }}>
            <option value="">All Types</option>
            <option value="management">Management</option>
            <option value="staff">Staff</option>
          </select>
        </div>
        <div className="select-wrapper" style={{ flex: '0 0 auto' }}>
          <select className="form-select" value={filterPortal} onChange={(e) => setFilterPortal(e.target.value)} style={{ minWidth: '160px' }}>
            <option value="">All Portals</option>
            {portalOptions.map((portal) => (
              <option key={portal.value} value={portal.value}>{portal.label}</option>
            ))}
          </select>
        </div>
        <div className="select-wrapper" style={{ flex: '0 0 auto' }}>
          <select className="form-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ minWidth: '130px' }}>
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="loading-screen"><div className="spinner spinner-lg" /><div className="loading-text">Loading users...</div></div>
      ) : users.length === 0 && !search && !filterType && !filterPortal && !filterStatus ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">👥</div>
            <div className="empty-state-title">No users yet</div>
            <div className="empty-state-description">Create management members and staff accounts to get started.</div>
            <button className="btn btn-primary btn-md" onClick={openCreateModal} style={{ marginTop: 'var(--space-4)' }}>+ Create First User</button>
          </div>
        </div>
      ) : (
        <div className="data-table-wrapper">
          <table className="data-table" id="table-users">
            <thead>
              <tr>
                <th>Name</th>
                <th>Position</th>
                <th>User Type</th>
                <th>Portal</th>
                <th>Status</th>
                <th>Last Login</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const s = statusOf(u);
                return (
                  <tr key={u._id}>
                    <td>
                      <div>
                        <div style={{ fontWeight: 600 }}>{u.name}</div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{u.email}</div>
                      </div>
                    </td>
                    <td>
                      {u.positionId ? (
                        <span className="badge badge-info badge-dot">{u.positionId.name}</span>
                      ) : (
                        <span className="badge badge-neutral">Unassigned</span>
                      )}
                    </td>
                    <td style={{ textTransform: 'capitalize' }}>{u.userType}</td>
                    <td>
                      <span className="badge badge-neutral">
                        {portalLabel(u.portalType)}
                      </span>
                    </td>
                    <td><span className={`badge ${s.cls} badge-dot`}>{s.label}</span></td>
                    <td style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{formatDate(u.lastLogin)}</td>
                    <td>
                      <div className="flex justify-end gap-1" style={{ flexWrap: 'wrap' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEditModal(u)}>✏️</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => { setResetUser(u); setResetPassword(''); setResetResult(null); }} title="Reset Password">🔑</button>
                        {u.isActive && !u.isArchived && (
                          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--status-danger)' }} onClick={() => setConfirmAction({ user: u, action: 'deactivate' })}>⏸</button>
                        )}
                        {!u.isActive && !u.isArchived && (
                          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--status-success)' }} onClick={() => handleAction(u, 'reactivate')}>▶</button>
                        )}
                        {!u.isArchived && (
                          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--status-warning)' }} onClick={() => setConfirmAction({ user: u, action: 'archive' })} title="Archive">📥</button>
                        )}
                        {u.isArchived && (
                          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--status-info)' }} onClick={() => handleAction(u, 'unarchive')} title="Unarchive">📤</button>
                        )}
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ color: 'var(--status-danger)' }}
                          onClick={() => setConfirmAction({ user: u, action: 'delete' })}
                          title="Delete User"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr><td colSpan={7}><div className="empty-state" style={{ padding: 'var(--space-8)' }}><div className="empty-state-icon">🔍</div><div className="empty-state-title">No matching users</div></div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit User Modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => !tempPasswordDisplay && setShowModal(false)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editingUser ? 'Edit User' : 'Create New User'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              {tempPasswordDisplay ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-4)' }}>
                  <div style={{ fontSize: 'var(--text-2xl)', marginBottom: 'var(--space-4)' }}>✅</div>
                  <div style={{ fontWeight: 600, fontSize: 'var(--text-lg)', marginBottom: 'var(--space-4)' }}>User Created Successfully</div>
                  <div style={{ marginBottom: 'var(--space-4)', color: 'var(--text-secondary)' }}>
                    Share these temporary credentials with the user:
                  </div>
                  <div className="selectable-text" style={{ background: 'var(--bg-tertiary)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)' }}>
                    <div>Email: {form.email}</div>
                    <div>Password: <strong>{tempPasswordDisplay}</strong></div>
                  </div>
                  <button
                    className="btn btn-secondary btn-md"
                    style={{ marginTop: 'var(--space-4)' }}
                    onClick={() => copyText(`Email: ${form.email}\nPassword: ${tempPasswordDisplay}`)}
                  >
                    Copy Credentials
                  </button>
                  <div style={{ marginTop: 'var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--status-warning)' }}>
                    ⚠ User will be prompted to change password on first login
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-5)' }}>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label required">Full Name</label>
                    <input type="text" className="form-input" placeholder="e.g. Rajan K" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
                  </div>
                  {!editingUser && (
                    <div className="form-group">
                      <label className="form-label required">Email Address</label>
                      <input type="email" className="form-input" placeholder="e.g. rajan@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                    </div>
                  )}
                  <div className="form-group">
                    <label className="form-label required">Phone Number</label>
                    <input type="tel" className="form-input" placeholder="e.g. +91 98765 43210" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  </div>
                  {!editingUser && (
                    <>
                      <div className="form-group">
                        <label className="form-label required">Portal Type</label>
                        <div className="select-wrapper">
                          <select className="form-select" value={form.portalType} onChange={(e) => setForm({ ...form, portalType: e.target.value, positionName: e.target.value === 'committee' ? form.positionName : '' })}>
                            {portalOptions.map((portal) => (
                              <option key={portal.value} value={portal.value}>{portal.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      {form.portalType === 'committee' && (
                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                          <MemberPositionInput
                            value={form.positionName}
                            positions={positions}
                            onChange={(positionName) => setForm({ ...form, positionName })}
                          />
                        </div>
                      )}
                    </>
                  )}
                  {editingUser && (
                    <>
                      <div className="form-group">
                        <label className="form-label">Portal Type</label>
                        <div className="select-wrapper">
                          <select className="form-select" value={form.portalType} onChange={(e) => setForm({ ...form, portalType: e.target.value, positionName: e.target.value === 'committee' ? form.positionName : '' })}>
                            {portalOptions.map((portal) => (
                              <option key={portal.value} value={portal.value}>{portal.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      {form.portalType === 'committee' && (
                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                          <MemberPositionInput
                            value={form.positionName}
                            positions={positions}
                            onChange={(positionName) => setForm({ ...form, positionName })}
                          />
                        </div>
                      )}
                    </>
                  )}
                  {!editingUser && (
                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                      <label className="form-label">Password <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(leave blank for auto-generated)</span></label>
                      <input type="text" className="form-input" placeholder="Auto-generated if blank" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                    </div>
                  )}
                  {formError && <div className="form-error" style={{ gridColumn: '1 / -1' }}>⚠ {formError}</div>}
                </div>
              )}
            </div>
            <div className="modal-footer">
              {tempPasswordDisplay ? (
                <button className="btn btn-primary btn-md" onClick={() => { setShowModal(false); setTempPasswordDisplay(null); }}>Done</button>
              ) : (
                <>
                  <button className="btn btn-secondary btn-md" onClick={() => setShowModal(false)}>Cancel</button>
                  <button className={`btn btn-primary btn-md ${saving ? 'btn-loading' : ''}`} onClick={handleSaveUser} disabled={saving}>
                    {editingUser ? 'Save Changes' : 'Create User'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetUser && (
        <div className="modal-backdrop" onClick={() => setResetUser(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Reset Password — {resetUser.name}</h3>
              <button className="modal-close" onClick={() => setResetUser(null)}>✕</button>
            </div>
            <div className="modal-body">
              {resetResult ? (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 'var(--text-2xl)', marginBottom: 'var(--space-3)' }}>✅</div>
                  <div className="selectable-text" style={{ background: 'var(--bg-tertiary)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-mono)' }}>
                    New Password: <strong>{resetResult}</strong>
                  </div>
                  <button
                    className="btn btn-secondary btn-md"
                    style={{ marginTop: 'var(--space-4)' }}
                    onClick={() => copyText(resetResult)}
                  >
                    Copy Password
                  </button>
                </div>
              ) : (
                <div className="form-group">
                  <label className="form-label">New Password <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(leave blank for auto-generated)</span></label>
                  <input type="text" className="form-input" placeholder="Auto-generated if blank" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} />
                </div>
              )}
            </div>
            <div className="modal-footer">
              {resetResult ? (
                <button className="btn btn-primary btn-md" onClick={() => setResetUser(null)}>Done</button>
              ) : (
                <>
                  <button className="btn btn-secondary btn-md" onClick={() => setResetUser(null)}>Cancel</button>
                  <button className="btn btn-primary btn-md" onClick={handleResetPassword}>Reset Password</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirm Action Modal */}
      {confirmAction && (
        <div className="modal-backdrop" onClick={() => setConfirmAction(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div className="modal-body" style={{ paddingTop: 'var(--space-8)' }}>
              <div className={`confirm-icon ${confirmAction.action === 'archive' ? 'warning' : 'danger'}`}>
                {confirmAction.action === 'archive' ? '📥' : confirmAction.action === 'delete' ? '!' : '⏸'}
              </div>
              <div className="confirm-title">
                {confirmAction.action === 'delete' ? 'Delete' : confirmAction.action === 'deactivate' ? 'Deactivate' : 'Archive'} {confirmAction.user.name}?
              </div>
              <div className="confirm-message">
                {confirmAction.action === 'delete'
                  ? 'This permanently removes the user account and their checklist records. This cannot be undone.'
                  : confirmAction.action === 'deactivate'
                    ? 'They will not be able to log in but all their data is preserved.'
                    : 'Account becomes inactive. Historical data is fully preserved. Can be unarchived later.'}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-md" onClick={() => setConfirmAction(null)}>Cancel</button>
              <button className={`btn ${confirmAction.action === 'archive' ? 'btn-danger' : 'btn-danger'} btn-md`} onClick={() => handleAction(confirmAction.user, confirmAction.action)}>
                Yes, {confirmAction.action === 'delete' ? 'Delete' : confirmAction.action === 'deactivate' ? 'Deactivate' : 'Archive'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MemberPositionInput({
  value,
  positions,
  onChange,
}: {
  value: string;
  positions: UserPosition[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const activePositions = positions.filter((position) => position.isActive);
  const normalizedValue = value.trim().toLowerCase();
  const matchingPositions = activePositions.filter((position) =>
    position.name.toLowerCase().includes(normalizedValue)
  );
  const visiblePositions = normalizedValue ? matchingPositions : activePositions;
  const shouldShowMenu = open && visiblePositions.length > 0;

  return (
    <div className="position-combobox" onBlur={(e) => {
      if (!e.currentTarget.contains(e.relatedTarget)) {
        setOpen(false);
      }
    }}>
      <label className="form-label required">Member Position</label>
      <div className="position-combobox-control">
        <input
          type="text"
          className="form-input position-combobox-input"
          placeholder="Type or select position"
          value={value}
          role="combobox"
          aria-expanded={open}
          aria-controls="member-position-options"
          onFocus={() => {
            setOpen(visiblePositions.length > 0);
          }}
          onChange={(e) => {
            const nextValue = e.target.value;
            const nextNormalizedValue = nextValue.trim().toLowerCase();
            const hasMatches = activePositions.some((position) =>
              nextNormalizedValue
                ? position.name.toLowerCase().includes(nextNormalizedValue)
                : true
            );

            onChange(nextValue);
            setOpen(hasMatches);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape' || e.key === 'Enter' || e.key === 'Tab') {
              setOpen(false);
            }
          }}
        />
        <button
          type="button"
          className="position-combobox-toggle"
          aria-label={open ? 'Hide positions' : 'Show positions'}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setOpen((current) => (visiblePositions.length > 0 ? !current : false));
          }}
        >
          {open ? '⌃' : '⌄'}
        </button>
      </div>
      {shouldShowMenu && (
        <div
          id="member-position-options"
          className="position-combobox-menu"
          role="listbox"
          onMouseDown={(e) => e.preventDefault()}
        >
          {visiblePositions.map((position) => (
            <button
              key={position._id}
              type="button"
              className="position-combobox-option"
              role="option"
              aria-selected={position.name === value}
              onClick={() => {
                onChange(position.name);
                setOpen(false);
              }}
            >
              <span>{position.name}</span>
              {position.name === value && <span className="position-combobox-check">Selected</span>}
            </button>
          ))}
        </div>
      )}
      <span className="form-helper">
        Select an existing position like President, or type a new one to create it.
      </span>
    </div>
  );
}
