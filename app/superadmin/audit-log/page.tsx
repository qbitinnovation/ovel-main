'use client';
import { useState, useEffect, useCallback } from 'react';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { CustomDatePicker } from '@/components/ui/CustomDatePicker';

interface AuditEntry { _id: string; userId: string; userName: string; userType: string; action: string; module: string; description: string; oldValue: Record<string, unknown> | null; newValue: Record<string, unknown> | null; ipAddress: string; timestamp: string; }

const MODULE_LABELS: Record<string, string> = {
  user_permission: 'Users & Permissions', accounts_finance: 'Accounts', inventory: 'Inventory', inventory_sales: 'Sales',
  maintenance_tasks: 'Maintenance', daily_operations: 'Checklists', malayalam_mom: 'MOM',
  notifications: 'Notifications', reports_analytics: 'Reports', settings: 'Settings', audit_log: 'Audit Log',
};

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterModule, setFilterModule] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [detail, setDetail] = useState<AuditEntry | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '30' });
      if (search) params.set('search', search);
      if (filterModule) params.set('module', filterModule);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      const res = await fetch(`/api/audit-log?${params}`); const d = await res.json();
      if (d.success) { setLogs(d.data.logs); setTotalPages(d.data.pagination.totalPages); }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [search, filterModule, startDate, endDate, page]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const formatTime = (t: string) => new Date(t).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="page-container">
      <div className="page-header"><div><h1>Audit Log</h1><p className="page-subtitle">Tamper-proof activity records — insert-only, no edits or deletions</p></div></div>

      <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-6)', flexWrap: 'wrap' }}>
        <div className="search-input-wrapper" style={{ flex: '1 1 250px' }}>
          <span className="search-icon">🔍</span>
          <input className="form-input search-input" placeholder="Search logs..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <div style={{ width: '160px' }}>
          <CustomSelect
            options={[
              { value: '', label: 'All Modules' },
              ...Object.entries(MODULE_LABELS).map(([k, v]) => ({ value: k, label: v }))
            ]}
            value={filterModule}
            onChange={(val) => { setFilterModule(val); setPage(1); }}
          />
        </div>
        <div style={{ width: '160px' }}>
          <CustomDatePicker value={startDate} onChange={(val) => { setStartDate(val); setPage(1); }} />
        </div>
        <div style={{ width: '160px' }}>
          <CustomDatePicker value={endDate} onChange={(val) => { setEndDate(val); setPage(1); }} />
        </div>
      </div>

      {loading ? <div className="loading-screen"><div className="spinner spinner-lg" /></div> : logs.length === 0 ? (
        <div className="card"><div className="empty-state"><div className="empty-state-icon">📋</div><div className="empty-state-title">No log entries found</div></div></div>
      ) : (
        <>
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead><tr><th>Time</th><th>User</th><th>Module</th><th>Action</th><th>Description</th><th>Details</th></tr></thead>
              <tbody>{logs.map((l) => (
                <tr key={l._id}>
                  <td style={{ fontSize: 'var(--text-xs)', whiteSpace: 'nowrap' }}>{formatTime(l.timestamp)}</td>
                  <td><span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{l.userName}</span></td>
                  <td><span className="badge badge-neutral" style={{ fontSize: '10px' }}>{MODULE_LABELS[l.module] || l.module}</span></td>
                  <td style={{ fontSize: 'var(--text-sm)' }}>{l.action.replace(/_/g, ' ')}</td>
                  <td style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.description}</td>
                  <td>{(l.oldValue || l.newValue) && <button className="btn btn-ghost btn-sm" onClick={() => setDetail(l)}>👁️</button>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-2)', marginTop: 'var(--space-6)' }}>
              <button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => setPage(page - 1)}>← Prev</button>
              <span style={{ alignSelf: 'center', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Page {page} of {totalPages}</span>
              <button className="btn btn-ghost btn-sm" disabled={page === totalPages} onClick={() => setPage(page + 1)}>Next →</button>
            </div>
          )}
        </>
      )}

      {detail && (
        <div className="modal-backdrop" onClick={() => setDetail(null)}><div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header"><h3 className="modal-title">Audit Detail</h3><button className="modal-close" onClick={() => setDetail(null)}>✕</button></div>
          <div className="modal-body">
            <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
              <div><span className="form-label">Time:</span> {formatTime(detail.timestamp)}</div>
              <div><span className="form-label">User:</span> {detail.userName} ({detail.userType})</div>
              <div><span className="form-label">Module:</span> {MODULE_LABELS[detail.module] || detail.module}</div>
              <div><span className="form-label">Action:</span> {detail.action}</div>
              <div><span className="form-label">Description:</span> {detail.description}</div>
              {detail.ipAddress && <div><span className="form-label">IP:</span> {detail.ipAddress}</div>}
              {detail.oldValue && <div><span className="form-label">Old Value:</span><pre style={{ fontSize: 'var(--text-xs)', background: 'var(--bg-tertiary)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', overflow: 'auto' }}>{JSON.stringify(detail.oldValue, null, 2)}</pre></div>}
              {detail.newValue && <div><span className="form-label">New Value:</span><pre style={{ fontSize: 'var(--text-xs)', background: 'var(--bg-tertiary)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', overflow: 'auto' }}>{JSON.stringify(detail.newValue, null, 2)}</pre></div>}
            </div>
          </div>
          <div className="modal-footer"><button className="btn btn-secondary btn-md" onClick={() => setDetail(null)}>Close</button></div>
        </div></div>
      )}
    </div>
  );
}
