import type { Metadata } from 'next';
import WelcomeMessage from '@/components/WelcomeMessage';

export const metadata: Metadata = {
  title: 'SuperAdmin Dashboard',
};

export default function SuperAdminDashboard() {
  return (
    <div className="page-container">
      <WelcomeMessage />

      <div className="grid grid-4" style={{ marginBottom: 'var(--space-8)' }}>
        <div className="card stat-card">
          <div className="stat-icon" style={{ background: 'var(--accent-primary-soft)', color: 'var(--accent-primary)' }}>👥</div>
          <div className="stat-value text-gradient">0</div>
          <div className="stat-label">Total Users</div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon" style={{ background: 'var(--accent-secondary-soft)', color: 'var(--accent-secondary)' }}>🔗</div>
          <div className="stat-value text-gradient">4</div>
          <div className="stat-label">Portal URLs</div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon" style={{ background: 'var(--status-warning-soft)', color: 'var(--status-warning)' }}>🔧</div>
          <div className="stat-value text-gradient">0</div>
          <div className="stat-label">Open Tasks</div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon" style={{ background: 'var(--accent-tertiary-soft)', color: 'var(--accent-tertiary)' }}>📋</div>
          <div className="stat-value text-gradient">0</div>
          <div className="stat-label">Audit Entries Today</div>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-header">
            <h3>Recent Activity</h3>
          </div>
          <div className="card-body">
            <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
              <div className="empty-state-icon">📋</div>
              <div className="empty-state-title">No activity yet</div>
              <div className="empty-state-description">
                Activity will appear here once users start interacting with the system.
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Quick Setup</h3>
            <span className="badge badge-info badge-dot">Getting Started</span>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <SetupStep number={1} title="Create Users" description="Add committee members, turf managers, and shareholders" href="/superadmin/users" />
              <SetupStep number={2} title="Enter Committee Positions" description="Type each committee member position while creating the user" href="/superadmin/users" />
              <SetupStep number={3} title="Map Modules" description="Configure access for committee positions after users exist" href="/superadmin/modules" />
              <SetupStep number={4} title="Review Operations" description="Check bookings, inventory, maintenance, and checklist records" href="/superadmin/bookings" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SetupStep({ number, title, description, href }: { number: number; title: string; description: string; href: string }) {
  return (
    <a href={href} className="card card-interactive" style={{ padding: 'var(--space-4)', textDecoration: 'none' }}>
      <div className="flex items-center gap-4">
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: 'var(--radius-full)',
          background: 'var(--accent-primary-soft)',
          color: 'var(--accent-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          fontSize: 'var(--text-sm)',
          flexShrink: 0,
        }}>
          {number}
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>{title}</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{description}</div>
        </div>
      </div>
    </a>
  );
}
