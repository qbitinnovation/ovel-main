import type { Metadata } from 'next';
import WelcomeMessage from '@/components/WelcomeMessage';
import { Shield } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Turf Manager Dashboard',
};

export default function TurfManagerDashboard() {
  return (
    <div className="page-container">
      <WelcomeMessage />

      <div className="grid" style={{ gridTemplateColumns: '1fr', gap: 'var(--space-4)' }}>
        {/* Today's Checklist */}
        <div className="card" style={{ background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0.02) 100%)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
          <div className="card-header" style={{ borderBottom: '1px solid rgba(59, 130, 246, 0.1)' }}>
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

        {/* My Tasks */}
        <div className="card" style={{ background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(34, 197, 94, 0.02) 100%)', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
          <div className="card-header" style={{ borderBottom: '1px solid rgba(34, 197, 94, 0.1)' }}>
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

        {/* Safety Checkout */}
        <div className="card" style={{ background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.1) 0%, rgba(234, 179, 8, 0.02) 100%)', border: '1px solid rgba(234, 179, 8, 0.3)' }}>
          <div className="card-body" style={{ padding: 'var(--space-5)' }}>
            <div className="flex items-center gap-4">
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: 'var(--radius-lg)',
                background: 'rgba(234, 179, 8, 0.2)',
                color: 'var(--status-warning)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Shield size={24} />
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
