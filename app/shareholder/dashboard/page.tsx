import type { Metadata } from 'next';
import WelcomeMessage from '@/components/WelcomeMessage';

export const metadata: Metadata = {
  title: 'Shareholder Dashboard',
};

export default function ShareholderDashboard() {
  return (
    <div className="page-container">
      <WelcomeMessage />

      <div className="grid grid-4" style={{ marginBottom: 'var(--space-8)' }}>
        <div className="card stat-card">
          <div className="stat-icon" style={{ background: 'var(--accent-primary-soft)', color: 'var(--accent-primary)' }}>💰</div>
          <div className="stat-value text-gradient">₹0</div>
          <div className="stat-label">Revenue</div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon" style={{ background: 'var(--status-success-soft)', color: 'var(--status-success)' }}>📈</div>
          <div className="stat-value text-gradient">0%</div>
          <div className="stat-label">Growth</div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon" style={{ background: 'var(--status-warning-soft)', color: 'var(--status-warning)' }}>🏏</div>
          <div className="stat-value text-gradient">0</div>
          <div className="stat-label">Bookings</div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon" style={{ background: 'var(--accent-secondary-soft)', color: 'var(--accent-secondary)' }}>🔔</div>
          <div className="stat-value text-gradient">0</div>
          <div className="stat-label">Updates</div>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-header">
            <h3>Financial Summary</h3>
            <span className="badge badge-neutral">View Only</span>
          </div>
          <div className="card-body">
            <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
              <div className="empty-state-icon">💰</div>
              <div className="empty-state-title">No financial entries yet</div>
              <div className="empty-state-description">Shareholder finance summaries will appear here.</div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Operational Updates</h3>
            <span className="badge badge-neutral">View Only</span>
          </div>
          <div className="card-body">
            <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
              <div className="empty-state-icon">🔔</div>
              <div className="empty-state-title">No updates yet</div>
              <div className="empty-state-description">Important turf updates will appear here.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
