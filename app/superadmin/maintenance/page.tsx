'use client';
import { useState, useEffect, useCallback } from 'react';
import { Wrench, MapPin, Calendar, User } from 'lucide-react';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { CustomDatePicker } from '@/components/ui/CustomDatePicker';
import { usePermissions } from '@/components/providers/PermissionsProvider';

interface Task { _id: string; title: string; description: string; location: string; priority: string; dueDate: string; assigneeId: { _id: string; name: string } | null; creatorId: { _id: string; name: string } | null; status: string; resolutionNote: string; estimatedCost?: number; actualCost?: number; linkedMomId?: { _id: string; date: string } | string; createdAt: string; }
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
  const [form, setForm] = useState({ title: '', description: '', location: '', priority: 'medium', dueDate: '', assigneeId: '', estimatedCost: '' });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: string } | null>(null);
  const [completeTask, setCompleteTask] = useState<Task | null>(null);
  const [actualCost, setActualCost] = useState('');
  const [completionNote, setCompletionNote] = useState('');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const showToast = (m: string, t = 'success') => { setToast({ message: m, type: t }); setTimeout(() => setToast(null), 3500); };

  const { checkPermission } = usePermissions();
  const canCreate = checkPermission('maintenance_tasks', 'create_task');
  const canUpdate = checkPermission('maintenance_tasks', 'edit_task');

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
    try {
      const url = editingTaskId ? `/api/maintenance/${editingTaskId}` : '/api/maintenance';
      const method = editingTaskId ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const d = await res.json();
      if (d.success) {
        showToast(editingTaskId ? 'Task updated' : 'Task created');
        setShowModal(false);
        setEditingTaskId(null);
        setForm({ title: '', description: '', location: '', priority: 'medium', dueDate: '', assigneeId: '', estimatedCost: '' });
        fetchTasks();
      } else {
        showToast(d.message, 'error');
      }
    } catch {
      showToast('Error', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleEditClick = (t: Task) => {
    setEditingTaskId(t._id);
    setForm({
      title: t.title,
      description: t.description || '',
      location: t.location || '',
      priority: t.priority,
      dueDate: t.dueDate ? t.dueDate.split('T')[0] : '',
      assigneeId: t.assigneeId && typeof t.assigneeId === 'object' ? t.assigneeId._id : (t.assigneeId || ''),
      estimatedCost: t.estimatedCost ? t.estimatedCost.toString() : ''
    });
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingTaskId(null);
    setForm({ title: '', description: '', location: '', priority: 'medium', dueDate: '', assigneeId: '', estimatedCost: '' });
  };

  const handleAction = async (id: string, action: string, note = '', actualCost?: number) => {
    try { const res = await fetch(`/api/maintenance/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, note, actualCost }) }); const d = await res.json(); if (d.success) { showToast(d.message); fetchTasks(); } else showToast(d.message, 'error'); } catch { showToast('Error', 'error'); }
  };

  const isOverdue = (t: Task) => new Date(t.dueDate) < new Date() && !['closed', 'completed'].includes(t.status);

  return (
    <div className="page-container">
      {toast && <div className="toast-container"><div className={`toast toast-${toast.type === 'error' ? 'error' : 'success'}`}><span className="toast-icon">{toast.type === 'error' ? '✕' : '✓'}</span><div className="toast-content"><div className="toast-title">{toast.message}</div></div></div></div>}
      <div className="page-header">
        <div><h1>Maintenance</h1><p className="page-subtitle">Track and manage physical maintenance tasks</p></div>
        {canCreate && <button className="btn btn-primary btn-md" onClick={() => setShowModal(true)}>+ Create Task</button>}
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
        <div style={{ width: '140px' }}>
          <CustomSelect
            options={[
              { value: '', label: 'All Status' },
              { value: 'open', label: 'Open' },
              { value: 'in_progress', label: 'In Progress' },
              { value: 'completed', label: 'Completed' },
              { value: 'closed', label: 'Closed' }
            ]}
            value={filterStatus}
            onChange={(val) => setFilterStatus(val)}
          />
        </div>
        <div style={{ width: '140px' }}>
          <CustomSelect
            options={[
              { value: '', label: 'All Priority' },
              { value: 'low', label: 'Low' },
              { value: 'medium', label: 'Medium' },
              { value: 'high', label: 'High' },
              { value: 'urgent', label: 'Urgent' }
            ]}
            value={filterPriority}
            onChange={(val) => setFilterPriority(val)}
          />
        </div>
      </div>

      {loading ? <div className="loading-screen"><div className="spinner spinner-lg" /></div> : tasks.length === 0 ? (
        <div className="card"><div className="empty-state"><div className="empty-state-icon"><Wrench size={48} style={{ color: 'var(--text-secondary)', opacity: 0.5 }} /></div><div className="empty-state-title">No tasks</div><div className="empty-state-description">Create a maintenance task to track issues.</div></div></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {tasks.map((t) => (
            <div key={t._id} className="card" style={{ borderLeft: isOverdue(t) ? '3px solid var(--status-danger)' : t.priority === 'urgent' ? '3px solid var(--status-danger)' : t.priority === 'high' ? '3px solid var(--status-warning)' : 'none', padding: 'var(--space-5) var(--space-6)' }}>
              
              {/* Header: Title + Badges and Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 600 }}>{t.title}</h3>
                  <span className={`badge ${PRIORITY_COLORS[t.priority] || 'badge-neutral'}`}>{t.priority}</span>
                  <span className={`badge ${STATUS_COLORS[t.status] || 'badge-neutral'} badge-dot`}>{t.status.replace('_', ' ')}</span>
                  {isOverdue(t) && <span className="badge badge-danger badge-dot">Overdue!</span>}
                  {t.linkedMomId && <span className="badge badge-primary">Assigned from MOM</span>}
                </div>
                
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {canUpdate && t.status === 'open' && <button className="btn btn-secondary btn-sm" onClick={() => handleEditClick(t)}>Edit</button>}
                  {canUpdate && t.status === 'open' && <button className="btn btn-primary btn-sm" onClick={() => { setCompleteTask(t); setActualCost(t.estimatedCost ? t.estimatedCost.toString() : '0'); }}>✓ Complete</button>}
                  {canUpdate && t.status === 'completed' && <button className="btn btn-primary btn-sm" onClick={() => handleAction(t._id, 'close', 'Verified and closed')}>✓ Close</button>}
                </div>
                
              </div>

              {/* Description */}
              {t.description && (
                <div style={{ marginTop: '12px', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                  {t.description}
                </div>
              )}

              {/* Cost Box */}
              <div style={{ marginTop: '16px', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', fontSize: 'var(--text-sm)', background: 'var(--surface-secondary)', padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--surface-glass-border)' }}>
                <div>Est. Cost: <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>₹{t.estimatedCost || 0}</span></div>
                {['completed', 'closed'].includes(t.status) ? (
                  <>
                    <div>Act. Cost: <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>₹{t.actualCost || 0}</span></div>
                    <div>
                      Diff:{' '}
                      <span style={{
                        fontWeight: 700,
                        color: (t.actualCost || 0) > (t.estimatedCost || 0) ? 'var(--status-danger)' : (t.actualCost || 0) < (t.estimatedCost || 0) ? 'var(--status-success)' : 'var(--text-secondary)'
                      }}>
                        {(t.actualCost || 0) > (t.estimatedCost || 0)
                          ? `₹${(t.actualCost || 0) - (t.estimatedCost || 0)} Over`
                          : (t.actualCost || 0) < (t.estimatedCost || 0)
                          ? `₹${(t.estimatedCost || 0) - (t.actualCost || 0)} Under`
                          : 'On Budget'}
                      </span>
                    </div>
                  </>
                ) : (
                  <div style={{ color: 'var(--text-tertiary)', fontSize: '13px', fontStyle: 'italic' }}>Pending completion</div>
                )}
              </div>

              {/* Details Row */}
              <div style={{ marginTop: '16px', display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '13px', color: 'var(--text-tertiary)' }}>
                {t.location && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={14} /> {t.location}</span>}
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={14} /> Due: {new Date(t.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><User size={14} /> {t.assigneeId?.name || '—'}</span>
                <span>Created by {t.creatorId?.name || '—'}</span>
              </div>
              
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-backdrop" onClick={handleCloseModal}><div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header"><h3 className="modal-title">{editingTaskId ? 'Edit Task' : 'Create Task'}</h3><button className="modal-close" onClick={handleCloseModal}>✕</button></div>
          <div className="modal-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
              <div className="form-group" style={{ gridColumn: '1/-1' }}><label className="form-label required">Title</label><input className="form-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Issue title" autoFocus /></div>
              <div className="form-group" style={{ gridColumn: '1/-1' }}><label className="form-label">Description</label><textarea className="form-input form-textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} /></div>
              <div className="form-group"><label className="form-label">Location</label><input className="form-input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="On premises" /></div>
              <div className="form-group">
                <label className="form-label required">Priority</label>
                <div style={{ width: '100%' }}>
                  <CustomSelect
                    options={[
                      { value: 'low', label: 'Low' },
                      { value: 'medium', label: 'Medium' },
                      { value: 'high', label: 'High' },
                      { value: 'urgent', label: 'Urgent' }
                    ]}
                    value={form.priority}
                    onChange={(val) => setForm({ ...form, priority: val })}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label required">Due Date</label>
                <CustomDatePicker value={form.dueDate} onChange={(val) => setForm({ ...form, dueDate: val })} />
              </div>
              <div className="form-group">
                <label className="form-label required">Assign To</label>
                <div style={{ width: '100%' }}>
                  <CustomSelect
                    options={[
                      { value: '', label: 'Select user...' },
                      ...users.map((u) => ({ value: u._id, label: u.name }))
                    ]}
                    value={form.assigneeId}
                    onChange={(val) => setForm({ ...form, assigneeId: val })}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Estimated Cost (₹)</label>
                <input
                  type="number"
                  className="form-input"
                  value={form.estimatedCost}
                  onChange={(e) => setForm({ ...form, estimatedCost: e.target.value })}
                  placeholder="e.g. 500"
                />
              </div>
            </div>
          </div>
          <div className="modal-footer"><button className="btn btn-secondary btn-md" onClick={handleCloseModal}>Cancel</button><button className={`btn btn-primary btn-md ${saving ? 'btn-loading' : ''}`} onClick={handleCreate} disabled={saving}>{editingTaskId ? 'Save Changes' : 'Create Task'}</button></div>
        </div></div>
      )}
      {completeTask && (
        <div className="modal-backdrop" onClick={() => setCompleteTask(null)}>
          <div className="modal modal-md" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Complete Task</h3>
              <button className="modal-close" onClick={() => setCompleteTask(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', paddingBottom: 'var(--space-2)', borderBottom: '1px solid var(--surface-glass-border)' }}>
                Task: <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{completeTask.title}</span><br />
                Estimated Cost: <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>₹{completeTask.estimatedCost || 0}</span>
              </div>
              <div className="form-group">
                <label className="form-label required">Actual Cost (₹)</label>
                <input
                  type="number"
                  className="form-input"
                  value={actualCost}
                  onChange={(e) => setActualCost(e.target.value)}
                  placeholder="Enter actual cost spent"
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label className="form-label">Completion Note</label>
                <textarea
                  className="form-input form-textarea"
                  value={completionNote}
                  onChange={(e) => setCompletionNote(e.target.value)}
                  placeholder="Enter work summary/note..."
                  rows={3}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-md" onClick={() => setCompleteTask(null)}>Cancel</button>
              <button
                className="btn btn-primary btn-md"
                onClick={async () => {
                  if (!actualCost || isNaN(Number(actualCost)) || Number(actualCost) < 0) {
                    showToast('Valid actual cost is required', 'error');
                    return;
                  }
                  await handleAction(completeTask._id, 'complete', completionNote, Number(actualCost));
                  setCompleteTask(null);
                  setActualCost('');
                  setCompletionNote('');
                }}
              >
                Complete Task
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
