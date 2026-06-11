'use client';
import { useState, useEffect, useCallback } from 'react';

interface Task { _id: string; title: string; description: string; location: string; priority: string; dueDate: string; assigneeId: { _id: string; name: string } | null; creatorId: { _id: string; name: string } | null; status: string; resolutionNote: string; createdAt: string; }
interface User { _id: string; name: string; }

const PRIORITY_COLORS: Record<string, string> = { low: 'badge-info', medium: 'badge-warning', high: 'badge-danger', urgent: 'badge-danger' };
const STATUS_COLORS: Record<string, string> = { open: 'badge-info', in_progress: 'badge-warning', completed: 'badge-success', closed: 'badge-neutral', overdue: 'badge-danger' };

export default function MaintenancePage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [form, setForm] = useState({ title: '', description: '', location: '', priority: 'medium', dueDate: '', assigneeId: '' });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: string } | null>(null);
  const showToast = (m: string, t = 'success') => { setToast({ message: m, type: t }); setTimeout(() => setToast(null), 3500); };

  const fetchTasks = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (filterStatus) params.set('status', filterStatus);
      if (filterPriority) params.set('priority', filterPriority);
      const res = await fetch(`/api/maintenance?${params}`); const d = await res.json();
      if (d.success) setTasks(d.data.tasks);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [filterStatus, filterPriority]);

  const fetchUsers = useCallback(async () => {
    try { const res = await fetch('/api/users?limit=100'); const d = await res.json(); if (d.success) setUsers(d.data.users); } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const handleCreate = async () => {
    if (!form.title.trim() || !form.dueDate || !form.assigneeId) { showToast('Title, due date, and assignee required', 'error'); return; }
    setSaving(true);
    try { const res = await fetch('/api/maintenance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) }); const d = await res.json(); if (d.success) { showToast('Task created'); setShowModal(false); setForm({ title: '', description: '', location: '', priority: 'medium', dueDate: '', assigneeId: '' }); fetchTasks(); } else showToast(d.message, 'error'); } catch { showToast('Error', 'error'); } finally { setSaving(false); }
  };

  const handleAction = async (id: string, action: string, note = '') => {
    try { const res = await fetch(`/api/maintenance/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, note }) }); const d = await res.json(); if (d.success) { showToast(d.message); fetchTasks(); } else showToast(d.message, 'error'); } catch { showToast('Error', 'error'); }
  };

  const isOverdue = (t: Task) => new Date(t.dueDate) < new Date() && !['closed', 'completed'].includes(t.status);

  return (
    <div className="page-container">
      {toast && <div className="toast-container"><div className={`toast toast-${toast.type === 'error' ? 'error' : 'success'}`}><span className="toast-icon">{toast.type === 'error' ? '✕' : '✓'}</span><div className="toast-content"><div className="toast-title">{toast.message}</div></div></div></div>}
      <div className="page-header">
        <div><h1>Maintenance</h1><p className="page-subtitle">Track and manage physical maintenance tasks</p></div>
        <button className="btn btn-primary btn-md" onClick={() => setShowModal(true)}>+ Create Task</button>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
        <div className="select-wrapper"><select className="form-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ minWidth: '140px' }}><option value="">All Status</option><option value="open">Open</option><option value="in_progress">In Progress</option><option value="completed">Completed</option><option value="closed">Closed</option></select></div>
        <div className="select-wrapper"><select className="form-select" value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} style={{ minWidth: '140px' }}><option value="">All Priority</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select></div>
      </div>

      {loading ? <div className="loading-screen"><div className="spinner spinner-lg" /></div> : tasks.length === 0 ? (
        <div className="card"><div className="empty-state"><div className="empty-state-icon">🔧</div><div className="empty-state-title">No tasks</div><div className="empty-state-description">Create a maintenance task to track issues.</div></div></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {tasks.map((t) => (
            <div key={t._id} className="card" style={{ borderLeft: isOverdue(t) ? '3px solid var(--status-danger)' : t.priority === 'urgent' ? '3px solid var(--status-danger)' : t.priority === 'high' ? '3px solid var(--status-warning)' : 'none' }}>
              <div style={{ padding: 'var(--space-5) var(--space-6)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-4)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: 'var(--text-md)' }}>{t.title}</span>
                    <span className={`badge ${PRIORITY_COLORS[t.priority] || 'badge-neutral'}`}>{t.priority}</span>
                    <span className={`badge ${STATUS_COLORS[t.status] || 'badge-neutral'} badge-dot`}>{t.status.replace('_', ' ')}</span>
                    {isOverdue(t) && <span className="badge badge-danger badge-dot">Overdue!</span>}
                  </div>
                  {t.description && <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>{t.description}</div>}
                  <div style={{ display: 'flex', gap: 'var(--space-4)', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                    {t.location && <span>📍 {t.location}</span>}
                    <span>📅 Due: {new Date(t.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                    <span>👤 {t.assigneeId?.name || '—'}</span>
                    <span>Created by {t.creatorId?.name || '—'}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {t.status === 'open' && <button className="btn btn-primary btn-sm" onClick={() => handleAction(t._id, 'complete', 'Work completed')}>✓ Complete</button>}
                  {t.status === 'completed' && <button className="btn btn-primary btn-sm" onClick={() => handleAction(t._id, 'close', 'Verified and closed')}>✓ Close</button>}
                  {['completed', 'closed'].includes(t.status) && t.status !== 'open' && <button className="btn btn-ghost btn-sm" onClick={() => handleAction(t._id, 'reopen', 'Reopened for review')}>↺ Reopen</button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}><div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header"><h3 className="modal-title">Create Task</h3><button className="modal-close" onClick={() => setShowModal(false)}>✕</button></div>
          <div className="modal-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
              <div className="form-group" style={{ gridColumn: '1/-1' }}><label className="form-label required">Title</label><input className="form-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Issue title" autoFocus /></div>
              <div className="form-group" style={{ gridColumn: '1/-1' }}><label className="form-label">Description</label><textarea className="form-input form-textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} /></div>
              <div className="form-group"><label className="form-label">Location</label><input className="form-input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="On premises" /></div>
              <div className="form-group"><label className="form-label required">Priority</label><div className="select-wrapper"><select className="form-select" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select></div></div>
              <div className="form-group"><label className="form-label required">Due Date</label><input type="date" className="form-input" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></div>
              <div className="form-group"><label className="form-label required">Assign To</label><div className="select-wrapper"><select className="form-select" value={form.assigneeId} onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}><option value="">Select user...</option>{users.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}</select></div></div>
            </div>
          </div>
          <div className="modal-footer"><button className="btn btn-secondary btn-md" onClick={() => setShowModal(false)}>Cancel</button><button className={`btn btn-primary btn-md ${saving ? 'btn-loading' : ''}`} onClick={handleCreate} disabled={saving}>Create Task</button></div>
        </div></div>
      )}
    </div>
  );
}
