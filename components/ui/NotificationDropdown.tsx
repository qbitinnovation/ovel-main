'use client';
import { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';

export default function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications', { cache: 'no-store' });
      const d = await res.json();
      if (d.success) {
        setNotifications(d.data.notifications || []);
        setUnreadCount(d.data.unreadCount || 0);
      }
    } catch (e) {}
  };

  const markAsRead = async (id: string) => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark-read', notificationId: id }),
      });
      fetchNotifications();
    } catch (e) {}
  };

  const markAllAsRead = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark-all-read' }),
      });
      fetchNotifications();
    } catch (e) {}
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <button 
        className="notification-bell" 
        onClick={() => setOpen(!open)}
        aria-label="Notifications"
        style={{ 
          background: open ? 'var(--bg-hover)' : 'transparent', 
          border: 'none', 
          cursor: 'pointer', 
          position: 'relative', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          width: '40px', 
          height: '40px', 
          borderRadius: 'var(--radius-full)', 
          transition: 'background 0.2s' 
        }}
      >
        <Bell size={20} color="var(--text-secondary)" />
        {unreadCount > 0 && (
          <span 
            className="bell-badge"
            style={{ 
              position: 'absolute', 
              top: '8px', 
              right: '8px', 
              width: '10px', 
              height: '10px', 
              background: 'var(--status-danger)', 
              borderRadius: '50%',
              border: '2px solid var(--bg-secondary)'
            }} 
          />
        )}
      </button>

      {open && (
        <div style={{ 
          position: 'absolute', 
          top: 'calc(100% + 8px)', 
          right: '-10px', 
          width: '320px', 
          background: 'var(--bg-secondary)', 
          border: '1px solid var(--surface-glass-border)', 
          borderRadius: 'var(--radius-lg)', 
          boxShadow: 'var(--shadow-xl)', 
          zIndex: 9999, 
          overflow: 'hidden', 
          display: 'flex', 
          flexDirection: 'column' 
        }}>
          <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--surface-glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: 600 }}>Notifications</h4>
            {unreadCount > 0 && (
              <button 
                onClick={markAllAsRead} 
                style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: 'var(--text-xs)', cursor: 'pointer', padding: 0 }}
              >
                Mark all read
              </button>
            )}
          </div>
          
          <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                No new notifications
              </div>
            ) : (
              notifications.map((n) => (
                <div 
                  key={n._id} 
                  onClick={() => !n.isRead && markAsRead(n._id)} 
                  style={{ 
                    padding: 'var(--space-3) var(--space-4)', 
                    borderBottom: '1px solid var(--surface-glass-border)', 
                    background: n.isRead ? 'transparent' : 'var(--bg-hover)', 
                    cursor: n.isRead ? 'default' : 'pointer', 
                    transition: 'background 0.2s' 
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    {!n.isRead && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-primary)', marginTop: '6px', flexShrink: 0 }} />}
                    <div>
                      <div style={{ fontSize: 'var(--text-sm)', fontWeight: n.isRead ? 500 : 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                        {n.title}
                      </div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                        {n.message}
                      </div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '6px' }}>
                        {new Date(n.createdAt).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
