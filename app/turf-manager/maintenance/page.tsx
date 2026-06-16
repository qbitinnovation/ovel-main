'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { X, Check, Wrench } from 'lucide-react';

interface Task {
  _id: string;
  title: string;
  description: string;
  location: string;
  priority: string;
  dueDate: string;
  assigneeId: { _id: string; name: string } | null;
  creatorId: { _id: string; name: string } | null;
  status: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  low: 'badge-info',
  medium: 'badge-warning',
  high: 'badge-danger',
  urgent: 'badge-danger',
};

const STATUS_COLORS: Record<string, string> = {
  open: 'badge-info',
  in_progress: 'badge-warning',
  completed: 'badge-success',
  closed: 'badge-neutral',
  overdue: 'badge-danger',
};

export default function TurfMaintenancePage() {
  const { data: session } = useSession();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [toast, setToast] = useState<{ message: string; type: string } | null>(null);

  const showToast = (message: string, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchTasks = useCallback(async () => {
    if (!session?.user?.id) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '100', assigneeId: session.user.id });
      if (filterStatus) params.set('status', filterStatus);
      const res = await fetch(`/api/maintenance?${params}`);
      const data = await res.json();
      if (data.success) setTasks(data.data.tasks);
    } catch (error) {
      console.error(error);
      showToast('Failed to load tasks', 'error');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, session?.user?.id]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const handleAction = async (id: string, action: string, note: string) => {
    try {
      const res = await fetch(`/api/maintenance/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message);
        fetchTasks();
      } else {
        showToast(data.message, 'error');
      }
    } catch {
      showToast('Error updating task', 'error');
    }
  };

  const isOverdue = (task: Task) => new Date(task.dueDate) < new Date() && !['closed', 'completed'].includes(task.status);

  return (
    <div className="page-container">
      {toast && <div className="toast-container"><div className={`toast toast-${toast.type === 'error' ? 'error' : 'success'}`}><span className="toast-icon">{toast.type === 'error' ? <X size={16} /> : <Check size={16} />}</span><div className="toast-content"><div className="toast-title">{toast.message}</div></div></div></div>}

      <div className="page-header">
        <div>
          <h1>Tasks</h1>
          <p className="page-subtitle">View and update maintenance tasks assigned to you</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
        <div className="select-wrapper">
          <select className="form-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ minWidth: '160px' }}>
            <option value="">All Status</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>

      {loading ? <div className="loading-screen"><div className="spinner spinner-lg" /></div> : tasks.length === 0 ? (
        <div className="card"><div className="empty-state"><div className="empty-state-icon"><Wrench size={48} /></div><div className="empty-state-title">No tasks assigned</div><div className="empty-state-description">Assigned maintenance tasks will appear here.</div></div></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {tasks.map((task) => (
            <div key={task._id} className="card" style={{ borderLeft: isOverdue(task) ? '3px solid var(--status-danger)' : task.priority === 'urgent' ? '3px solid var(--status-danger)' : task.priority === 'high' ? '3px solid var(--status-warning)' : 'none' }}>
              <div style={{ padding: 'var(--space-5) var(--space-6)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-4)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: 'var(--text-md)' }}>{task.title}</span>
                    <span className={`badge ${PRIORITY_COLORS[task.priority] || 'badge-neutral'}`}>{task.priority}</span>
                    <span className={`badge ${STATUS_COLORS[task.status] || 'badge-neutral'} badge-dot`}>{task.status.replace('_', ' ')}</span>
                    {isOverdue(task) && <span className="badge badge-danger badge-dot">Overdue</span>}
                  </div>
                  {task.description && <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>{task.description}</div>}
                  <div style={{ display: 'flex', gap: 'var(--space-4)', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', flexWrap: 'wrap' }}>
                    {task.location && <span>Location: {task.location}</span>}
                    <span>Due: {new Date(task.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                    <span>Created by {task.creatorId?.name || '-'}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {task.status === 'open' && <button className="btn btn-primary btn-sm" onClick={() => handleAction(task._id, 'start', 'Work started')}>Start</button>}
                  {['open', 'in_progress'].includes(task.status) && <button className="btn btn-primary btn-sm" onClick={() => handleAction(task._id, 'complete', 'Work completed')}>Complete</button>}
                  {task.status === 'completed' && <button className="btn btn-ghost btn-sm" onClick={() => handleAction(task._id, 'reopen', 'Reopened by turf manager')}>Reopen</button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
