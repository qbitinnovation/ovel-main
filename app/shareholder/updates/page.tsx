'use client';

import { useEffect, useState } from 'react';

type NotificationItem = {
  _id: string;
  title: string;
  message: string;
  type: string;
  createdAt: string;
  isRead: boolean;
};

export default function ShareholderUpdatesPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUpdates() {
      try {
        const res = await fetch('/api/notifications');
        const data = await res.json();
        if (data.success) setNotifications(data.data?.notifications || []);
      } catch (error) {
        console.error('Failed to fetch shareholder updates:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchUpdates();
  }, []);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Updates</h1>
          <p className="page-subtitle">Important turf notices and shareholder updates</p>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Recent Updates</h3>
          <span className="badge badge-neutral">View Only</span>
        </div>
        <div className="card-body">
          {loading ? (
            <div className="loading-screen"><div className="spinner spinner-lg" /></div>
          ) : notifications.length === 0 ? (
            <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
              <div className="empty-state-icon">!</div>
              <div className="empty-state-title">No updates yet</div>
              <div className="empty-state-description">Important shareholder updates will appear here.</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
              {notifications.map((notification) => (
                <div key={notification._id} className="card" style={{ padding: 'var(--space-4)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-4)' }}>
                    <h3 style={{ fontSize: 'var(--text-base)', margin: 0 }}>{notification.title}</h3>
                    <span className={`badge ${notification.isRead ? 'badge-neutral' : 'badge-primary'}`}>
                      {notification.isRead ? 'Read' : 'New'}
                    </span>
                  </div>
                  <p style={{ margin: 'var(--space-2) 0', color: 'var(--text-secondary)' }}>{notification.message}</p>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                    {new Date(notification.createdAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
