import type { Metadata } from 'next';
import WelcomeMessage from '@/components/WelcomeMessage';
import { Users, Link as LinkIcon, Wrench, ClipboardList } from 'lucide-react';

export const metadata: Metadata = {
  title: 'SuperAdmin Dashboard',
};

export default function SuperAdminDashboard() {
  return (
    <div className="page-container">
      <WelcomeMessage />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-6)', marginBottom: 'var(--space-8)' }}>
        
        {/* Total Users */}
        <div className="card" style={{ padding: 'var(--space-5)', background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0.02) 100%)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-2)' }}>
            <div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Users</div>
              <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>0</div>
            </div>
            <div style={{ background: 'rgba(59, 130, 246, 0.2)', padding: '8px', borderRadius: 'var(--radius-full)' }}>
              <Users size={20} color="var(--status-info)" />
            </div>
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--status-info)', opacity: 0.8 }}>Active users in the system</div>
        </div>

        {/* Portal URLs */}
        <div className="card" style={{ padding: 'var(--space-5)', background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.1) 0%, rgba(168, 85, 247, 0.02) 100%)', border: '1px solid rgba(168, 85, 247, 0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-2)' }}>
            <div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Portal URLs</div>
              <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>4</div>
            </div>
            <div style={{ background: 'rgba(168, 85, 247, 0.2)', padding: '8px', borderRadius: 'var(--radius-full)' }}>
              <LinkIcon size={20} color="#a855f7" />
            </div>
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: '#a855f7', opacity: 0.8 }}>Available distinct portals</div>
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
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--status-warning)', opacity: 0.8 }}>Pending maintenance/checks</div>
        </div>

        {/* Audit Entries */}
        <div className="card" style={{ padding: 'var(--space-5)', background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(34, 197, 94, 0.02) 100%)', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-2)' }}>
            <div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Audit Entries Today</div>
              <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, color: 'var(--status-success)', marginTop: '4px' }}>0</div>
            </div>
            <div style={{ background: 'rgba(34, 197, 94, 0.2)', padding: '8px', borderRadius: 'var(--radius-full)' }}>
              <ClipboardList size={20} color="var(--status-success)" />
            </div>
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--status-success)', opacity: 0.8 }}>Recent system activities</div>
        </div>

      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-header">
            <h3>Recent Activity</h3>
          </div>
          <div className="card-body">
            <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
              <div className="empty-state-icon"><ClipboardList size={32} /></div>
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
