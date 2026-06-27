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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-6)', marginBottom: 'var(--space-8)' }}>
        
        {/* Today's Revenue */}
        <div className="card" style={{ padding: 'var(--space-5)', background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0.02) 100%)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-2)' }}>
            <div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Today's Revenue</div>
              <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>₹0</div>
            </div>
            <div style={{ background: 'rgba(59, 130, 246, 0.2)', padding: '8px', borderRadius: 'var(--radius-full)' }}>
              <Wallet size={20} color="var(--status-info)" />
            </div>
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--status-info)', opacity: 0.8 }}>Daily collected revenue</div>
        </div>

        {/* Open Tasks */}
        <div className="card" style={{ padding: 'var(--space-5)', background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.1) 0%, rgba(234, 179, 8, 0.02) 100%)', border: '1px solid rgba(234, 179, 8, 0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-2)' }}>
            <div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Open Tasks</div>
              <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, color: 'var(--status-warning)', marginTop: '4px' }}>0</div>
            </div>
            <div style={{ background: 'rgba(234, 179, 8, 0.2)', padding: '8px', borderRadius: 'var(--radius-full)' }}>
              <Wrench size={20} color="var(--status-warning)" />
            </div>
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--status-warning)', opacity: 0.8 }}>Pending maintenance</div>
        </div>

        {/* Checklist Completion */}
        <div className="card" style={{ padding: 'var(--space-5)', background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(34, 197, 94, 0.02) 100%)', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-2)' }}>
            <div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Checklist Completion</div>
              <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, color: 'var(--status-success)', marginTop: '4px' }}>0%</div>
            </div>
            <div style={{ background: 'rgba(34, 197, 94, 0.2)', padding: '8px', borderRadius: 'var(--radius-full)' }}>
              <CheckSquare size={20} color="var(--status-success)" />
            </div>
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--status-success)', opacity: 0.8 }}>Daily tasks completed</div>
        </div>

        {/* Low Stock Items */}
        <div className="card" style={{ padding: 'var(--space-5)', background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.1) 0%, rgba(168, 85, 247, 0.02) 100%)', border: '1px solid rgba(168, 85, 247, 0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-2)' }}>
            <div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Low Stock Items</div>
              <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>0</div>
            </div>
            <div style={{ background: 'rgba(168, 85, 247, 0.2)', padding: '8px', borderRadius: 'var(--radius-full)' }}>
              <Package size={20} color="#a855f7" />
            </div>
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: '#a855f7', opacity: 0.8 }}>Items needing restock</div>
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
