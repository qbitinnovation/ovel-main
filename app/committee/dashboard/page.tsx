import type { Metadata } from 'next';
import WelcomeMessage from '@/components/WelcomeMessage';
import { Wallet, Wrench, CheckSquare, Package } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Committee Dashboard',
};

export default function CommitteeDashboard() {
  return (
    <div className="page-container">
      <WelcomeMessage />

      {/* Status Summary Cards */}
      <div className="grid grid-4" style={{ marginBottom: 'var(--space-8)' }}>
        <div className="card stat-card">
          <div className="stat-icon" style={{ background: 'var(--accent-primary-soft)', color: 'var(--accent-primary)' }}>
            <Wallet size={20} />
          </div>
          <div className="stat-value text-gradient">₹0</div>
          <div className="stat-label">Today&apos;s Revenue</div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon" style={{ background: 'var(--status-warning-soft)', color: 'var(--status-warning)' }}>
            <Wrench size={20} />
          </div>
          <div className="stat-value text-gradient">0</div>
          <div className="stat-label">Open Tasks</div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon" style={{ background: 'var(--status-success-soft)', color: 'var(--status-success)' }}>
            <CheckSquare size={20} />
          </div>
          <div className="stat-value text-gradient">0%</div>
          <div className="stat-label">Checklist Completion</div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon" style={{ background: 'var(--accent-secondary-soft)', color: 'var(--accent-secondary)' }}>
            <Package size={20} />
          </div>
          <div className="stat-value text-gradient">0</div>
          <div className="stat-label">Low Stock Items</div>
        </div>
      </div>

      <div className="grid grid-2">
        {/* Recent Finance */}
        <div className="card">
          <div className="card-header">
            <h3>Recent Finance Entries</h3>
            <span className="badge badge-neutral">View Only</span>
          </div>
          <div className="card-body">
            <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
              <div className="empty-state-icon"><Wallet size={32} /></div>
              <div className="empty-state-title">No entries yet</div>
              <div className="empty-state-description">Finance entries will appear here once submitted.</div>
            </div>
          </div>
        </div>

        {/* Open Maintenance Tasks */}
        <div className="card">
          <div className="card-header">
            <h3>Open Maintenance Tasks</h3>
            <span className="badge badge-neutral">View Only</span>
          </div>
          <div className="card-body">
            <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
              <div className="empty-state-icon"><Wrench size={32} /></div>
              <div className="empty-state-title">No open tasks</div>
              <div className="empty-state-description">Maintenance tasks will appear here.</div>
            </div>
          </div>
        </div>

        {/* Today's Checklists */}
        <div className="card">
          <div className="card-header">
            <h3>Today&apos;s Checklist Status</h3>
            <span className="badge badge-neutral">View Only</span>
          </div>
          <div className="card-body">
            <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
              <div className="empty-state-icon"><CheckSquare size={32} /></div>
              <div className="empty-state-title">No checklists today</div>
              <div className="empty-state-description">Daily checklist status will appear here.</div>
            </div>
          </div>
        </div>

        {/* Inventory Status */}
        <div className="card">
          <div className="card-header">
            <h3>Inventory Status</h3>
            <span className="badge badge-neutral">View Only</span>
          </div>
          <div className="card-body">
            <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
              <div className="empty-state-icon"><Package size={32} /></div>
              <div className="empty-state-title">No inventory items</div>
              <div className="empty-state-description">Inventory levels will appear here.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
