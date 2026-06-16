'use client';
import { useState, useEffect, useCallback } from 'react';
import { X, Check, Bell } from 'lucide-react';

interface NotifRecord { _id: string; type: string; title: string; message: string; moduleKey: string; isRead: boolean; createdAt: string; }

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotifRecord[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: string } | null>(null);
  const showToast = (m: string, t = 'success') => { setToast({ message: m, type: t }); setTimeout(() => setToast(null), 3500); };

  const fetchNotifications = useCallback(async () => {
    try { const res = await fetch('/api/notifications'); const d = await res.json(); if (d.success) { setNotifications(d.data.notifications); setUnreadCount(d.data.unreadCount); } } catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const markRead = async (id: string) => {
    try { await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'mark-read', notificationId: id }) }); fetchNotifications(); } catch { showToast('Error', 'error'); }
  };

  const markAllRead = async () => {
    try { await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'mark-all-read' }) }); showToast('All marked as read'); fetchNotifications(); } catch { showToast('Error', 'error'); }
  };

  const formatTime = (t: string) => {
    const d = new Date(t); const now = new Date(); const diff = (now.getTime() - d.getTime()) / 1000;
    if (diff < 60) return 'Just now'; if (diff < 3600) return `${Math.floor(diff / 60)}m ago`; if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="page-container">
      {toast && <div className="toast-container"><div className={`toast toast-${toast.type === 'error' ? 'error' : 'success'}`}><span className="toast-icon">{toast.type === 'error' ? <X size={16} /> : <Check size={16} />}</span><div className="toast-content"><div className="toast-title">{toast.message}</div></div></div></div>}
      <div className="page-header">
        <div><h1>Notifications</h1><p className="page-subtitle">{unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'All caught up!'}</p></div>
        {unreadCount > 0 && <button className="btn btn-secondary btn-md" onClick={markAllRead} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Check size={16} /> Mark All Read</button>}
      </div>

      {loading ? <div className="loading-screen"><div className="spinner spinner-lg" /></div> : notifications.length === 0 ? (
        <div className="card"><div className="empty-state"><div className="empty-state-icon"><Bell size={48} /></div><div className="empty-state-title">No notifications</div><div className="empty-state-description">Notifications from system events will appear here.</div></div></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {notifications.map((n) => (
            <div key={n._id} className="card" onClick={() => !n.isRead && markRead(n._id)} style={{ cursor: n.isRead ? 'default' : 'pointer', opacity: n.isRead ? 0.7 : 1, borderLeft: n.isRead ? 'none' : '3px solid var(--accent-primary)' }}>
              <div style={{ padding: 'var(--space-4) var(--space-5)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-4)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: n.isRead ? 400 : 700, fontSize: 'var(--text-sm)' }}>{n.title}</div>
                  {n.message && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 'var(--space-1)' }}>{n.message}</div>}
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{formatTime(n.createdAt)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
