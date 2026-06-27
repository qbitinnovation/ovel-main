import type { Metadata } from 'next';
import WelcomeMessage from '@/components/WelcomeMessage';
import { Wallet, BarChart3, Calendar, Bell } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Shareholder Dashboard',
};

export default function ShareholderDashboard() {
  return (
    <div className="page-container">
      <WelcomeMessage />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-6)', marginBottom: 'var(--space-8)' }}>
        
        {/* Revenue */}
        <div className="card" style={{ padding: 'var(--space-5)', background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0.02) 100%)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-2)' }}>
            <div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Revenue</div>
              <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>₹0</div>
            </div>
            <div style={{ background: 'rgba(59, 130, 246, 0.2)', padding: '8px', borderRadius: 'var(--radius-full)' }}>
              <Wallet size={20} color="var(--status-info)" />
            </div>
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--status-info)', opacity: 0.8 }}>Total shareholder revenue</div>
        </div>

        {/* Growth */}
        <div className="card" style={{ padding: 'var(--space-5)', background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(34, 197, 94, 0.02) 100%)', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-2)' }}>
            <div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Growth</div>
              <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, color: 'var(--status-success)', marginTop: '4px' }}>0%</div>
            </div>
            <div style={{ background: 'rgba(34, 197, 94, 0.2)', padding: '8px', borderRadius: 'var(--radius-full)' }}>
              <BarChart3 size={20} color="var(--status-success)" />
            </div>
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--status-success)', opacity: 0.8 }}>Period over period growth</div>
        </div>

        {/* Bookings */}
        <div className="card" style={{ padding: 'var(--space-5)', background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.1) 0%, rgba(234, 179, 8, 0.02) 100%)', border: '1px solid rgba(234, 179, 8, 0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-2)' }}>
            <div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Bookings</div>
              <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, color: 'var(--status-warning)', marginTop: '4px' }}>0</div>
            </div>
            <div style={{ background: 'rgba(234, 179, 8, 0.2)', padding: '8px', borderRadius: 'var(--radius-full)' }}>
              <Calendar size={20} color="var(--status-warning)" />
            </div>
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--status-warning)', opacity: 0.8 }}>Total active bookings</div>
        </div>

        {/* Updates */}
        <div className="card" style={{ padding: 'var(--space-5)', background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.1) 0%, rgba(168, 85, 247, 0.02) 100%)', border: '1px solid rgba(168, 85, 247, 0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-2)' }}>
            <div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Updates</div>
              <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>0</div>
            </div>
            <div style={{ background: 'rgba(168, 85, 247, 0.2)', padding: '8px', borderRadius: 'var(--radius-full)' }}>
              <Bell size={20} color="#a855f7" />
            </div>
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: '#a855f7', opacity: 0.8 }}>Recent operational updates</div>
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
              <div className="empty-state-icon"><Wallet size={32} /></div>
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
              <div className="empty-state-icon"><Bell size={32} /></div>
              <div className="empty-state-title">No updates yet</div>
              <div className="empty-state-description">Important turf updates will appear here.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
