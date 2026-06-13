import type { Metadata } from 'next';
import WelcomeMessage from '@/components/WelcomeMessage';

export const metadata: Metadata = {
  title: 'Turf Manager Dashboard',
};

export default function TurfManagerDashboard() {
  return (
    <div className="page-container">
      <WelcomeMessage />

      <div className="grid" style={{ gridTemplateColumns: '1fr', gap: 'var(--space-4)' }}>
        <div className="card">
          <div className="card-header">
            <h3 style={{ fontSize: 'var(--text-md)' }}>Today&apos;s Checklist</h3>
            <span className="badge badge-warning badge-dot">Pending</span>
          </div>
          <div className="card-body">
            <div className="empty-state" style={{ padding: 'var(--space-6)' }}>
              <div className="empty-state-title" style={{ fontSize: 'var(--text-md)' }}>
                No checklist assigned yet
              </div>
              <div className="empty-state-description">
                Daily checklist items will appear here when available.
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 style={{ fontSize: 'var(--text-md)' }}>My Tasks</h3>
          </div>
          <div className="card-body">
            <div className="empty-state" style={{ padding: 'var(--space-6)' }}>
              <div className="empty-state-title" style={{ fontSize: 'var(--text-md)' }}>
                No open tasks
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ borderColor: 'var(--status-warning-border)' }}>
          <div className="card-body" style={{ padding: 'var(--space-5)' }}>
            <div className="flex items-center gap-4">
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--status-warning-soft)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 'var(--text-xl)',
                flexShrink: 0,
              }}>
                🛡️
              </div>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--status-warning)' }}>
                  Safety Checkout
                </div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                  Complete the safety checklist before logging out for the day.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
