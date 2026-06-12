'use client';
import { useState, useEffect, useCallback } from 'react';

interface OverviewData { users: { total: number; active: number }; tasks: { total: number; open: number }; financeEntries: number; }
interface FinanceData { totalIncome: number; totalExpenses: number; netProfit: number; }
interface MaintenanceData { total: number; open: number; completed: number; closed: number; overdue: number; }
interface InventoryData { totalItems: number; attentionCount: number; }
interface ChecklistData { total: number; verified: number; pending: number; partial: number; complianceRate: string; }

const TABS = ['Overview', 'Finance', 'Maintenance', 'Inventory', 'Checklists'];

export default function ReportsPage() {
  const [tab, setTab] = useState('Overview');
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [finance, setFinance] = useState<FinanceData | null>(null);
  const [maintenance, setMaintenance] = useState<MaintenanceData | null>(null);
  const [inventory, setInventory] = useState<InventoryData | null>(null);
  const [checklist, setChecklist] = useState<ChecklistData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async (type: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports?type=${type}`); const d = await res.json();
      if (d.success) {
        if (type === 'overview') setOverview(d.data);
        else if (type === 'finance') setFinance(d.data);
        else if (type === 'maintenance') setMaintenance(d.data);
        else if (type === 'inventory') setInventory(d.data);
        else if (type === 'checklist') setChecklist(d.data);
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const typeMap: Record<string, string> = { Overview: 'overview', Finance: 'finance', Maintenance: 'maintenance', Inventory: 'inventory', Checklists: 'checklist' };
    fetchData(typeMap[tab] || 'overview');
  }, [tab, fetchData]);

  const fmt = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

  const StatCard = ({ icon, label, value, color }: { icon: string; label: string; value: string | number; color?: string }) => (
    <div className="card stat-card">
      <div className="stat-icon" style={{ background: color ? `${color}20` : 'var(--accent-primary-soft)', color: color || 'var(--accent-primary)' }}>{icon}</div>
      <div className="stat-value text-gradient">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );

  return (
    <div className="page-container">
      <div className="page-header"><div><h1>Reports</h1><p className="page-subtitle">Analytics dashboards and exportable reports</p></div></div>

      {/* Tab Bar */}
      <div style={{ display: 'flex', gap: 'var(--space-1)', marginBottom: 'var(--space-6)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-1)', width: 'fit-content' }}>
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`btn btn-sm ${tab === t ? 'btn-primary' : 'btn-ghost'}`} style={{ borderRadius: 'var(--radius-md)' }}>{t}</button>
        ))}
      </div>

      {loading ? <div className="loading-screen"><div className="spinner spinner-lg" /></div> : (
        <>
          {tab === 'Overview' && overview && (
            <div className="grid grid-3">
              <StatCard icon="👥" label="Total Users" value={overview.users.total} />
              <StatCard icon="✅" label="Active Users" value={overview.users.active} color="hsl(160, 84%, 39%)" />
              <StatCard icon="🔧" label="Open Tasks" value={overview.tasks.open} color="hsl(40, 96%, 50%)" />
            </div>
          )}

          {tab === 'Finance' && finance && (
            <div className="grid grid-3">
              <StatCard icon="💰" label="Total Income" value={fmt(finance.totalIncome)} color="hsl(160, 84%, 39%)" />
              <StatCard icon="💸" label="Total Expenses" value={fmt(finance.totalExpenses)} color="hsl(0, 84%, 60%)" />
              <StatCard icon="📈" label="Net Profit" value={fmt(finance.netProfit)} color={finance.netProfit >= 0 ? 'hsl(160, 84%, 39%)' : 'hsl(0, 84%, 60%)'} />
            </div>
          )}

          {tab === 'Maintenance' && maintenance && (
            <>
              <div className="grid grid-5" style={{ marginBottom: 'var(--space-6)' }}>
                <StatCard icon="📋" label="Total Tasks" value={maintenance.total} />
                <StatCard icon="🔓" label="Open" value={maintenance.open} color="hsl(210, 84%, 60%)" />
                <StatCard icon="✅" label="Completed" value={maintenance.completed} color="hsl(160, 84%, 39%)" />
                <StatCard icon="🔒" label="Closed" value={maintenance.closed} />
                <StatCard icon="⚠️" label="Overdue" value={maintenance.overdue} color="hsl(0, 84%, 60%)" />
              </div>
              {maintenance.total > 0 && (
                <div className="card" style={{ padding: 'var(--space-6)' }}>
                  <h3 style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }}>Completion Rate</h3>
                  <div style={{ height: '32px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', display: 'flex' }}>
                    <div style={{ width: `${(maintenance.closed / maintenance.total) * 100}%`, background: 'var(--status-success)', transition: 'width 0.5s' }} />
                    <div style={{ width: `${(maintenance.completed / maintenance.total) * 100}%`, background: 'var(--accent-primary)', transition: 'width 0.5s' }} />
                    <div style={{ width: `${(maintenance.overdue / maintenance.total) * 100}%`, background: 'var(--status-danger)', transition: 'width 0.5s' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-6)', marginTop: 'var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                    <span>🟢 Closed {((maintenance.closed / maintenance.total) * 100).toFixed(0)}%</span>
                    <span>🔵 Completed {((maintenance.completed / maintenance.total) * 100).toFixed(0)}%</span>
                    <span>🔴 Overdue {((maintenance.overdue / maintenance.total) * 100).toFixed(0)}%</span>
                  </div>
                </div>
              )}
            </>
          )}

          {tab === 'Inventory' && inventory && (
            <div className="grid grid-2">
              <StatCard icon="📦" label="Total Items" value={inventory.totalItems} />
              <StatCard icon="⚠️" label="Needs Attention" value={inventory.attentionCount} color={inventory.attentionCount > 0 ? 'hsl(0, 84%, 60%)' : 'hsl(160, 84%, 39%)'} />
            </div>
          )}

          {tab === 'Checklists' && checklist && (
            <>
              <div className="grid grid-4" style={{ marginBottom: 'var(--space-6)' }}>
                <StatCard icon="📋" label="Total Checklists" value={checklist.total} />
                <StatCard icon="✅" label="Verified" value={checklist.verified} color="hsl(160, 84%, 39%)" />
                <StatCard icon="⏳" label="Pending" value={checklist.pending} color="hsl(40, 96%, 50%)" />
                <StatCard icon="📊" label="Compliance Rate" value={`${checklist.complianceRate}%`} color="hsl(210, 84%, 60%)" />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
