'use client';
import { useState, useEffect, useCallback } from 'react';

interface ChecklistItem { key: string; label: string; status: string; photoUrl: string; supervisorNote: string; }
interface ChecklistRecord { _id: string; staffId: { _id: string; name: string } | null; date: string; items: ChecklistItem[]; overallStatus: string; submittedAt: string | null; verifiedAt: string | null; verifiedBy: { name: string } | null; }

const STATUS_BADGES: Record<string, string> = { pending: 'badge-neutral', submitted: 'badge-info', approved: 'badge-success', rejected: 'badge-danger', unverified: 'badge-warning', verified: 'badge-success', partially_verified: 'badge-warning' };

export default function ChecklistsPage() {
  const [checklists, setChecklists] = useState<ChecklistRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ChecklistRecord | null>(null);
  const [toast, setToast] = useState<{ message: string; type: string } | null>(null);
  const showToast = (m: string, t = 'success') => { setToast({ message: m, type: t }); setTimeout(() => setToast(null), 3500); };

  const fetchChecklists = useCallback(async () => {
    try { const res = await fetch('/api/checklists'); const d = await res.json(); if (d.success) setChecklists(d.data); } catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchChecklists(); }, [fetchChecklists]);

  const handleAction = async (checklistId: string, action: string, itemKey: string, reason = '') => {
    try {
      const res = await fetch(`/api/checklists/${checklistId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, itemKey, reason }) });
      const d = await res.json();
      if (d.success) { showToast(d.message); setSelected(d.data); fetchChecklists(); }
      else showToast(d.message, 'error');
    } catch { showToast('Error', 'error'); }
  };

  return (
    <div className="page-container">
      {toast && <div className="toast-container"><div className={`toast toast-${toast.type === 'error' ? 'error' : 'success'}`}><span className="toast-icon">{toast.type === 'error' ? '✕' : '✓'}</span><div className="toast-content"><div className="toast-title">{toast.message}</div></div></div></div>}
      <div className="page-header"><div><h1>Checklists</h1><p className="page-subtitle">Review daily staff checklist submissions and photo proofs</p></div></div>

      {loading ? <div className="loading-screen"><div className="spinner spinner-lg" /></div> : checklists.length === 0 ? (
        <div className="card"><div className="empty-state"><div className="empty-state-icon">✅</div><div className="empty-state-title">No checklists yet</div><div className="empty-state-description">Checklists will appear here when generated for staff members.</div></div></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 1.5fr' : '1fr', gap: 'var(--space-6)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {checklists.map((c) => {
              const total = c.items.length;
              const done = c.items.filter((i) => ['approved', 'submitted'].includes(i.status)).length;
              return (
                <div key={c._id} className={`card card-interactive ${selected?._id === c._id ? 'card-active' : ''}`} onClick={() => setSelected(c)} style={{ cursor: 'pointer', borderColor: selected?._id === c._id ? 'var(--accent-primary)' : undefined }}>
                  <div style={{ padding: 'var(--space-4)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                      <span style={{ fontWeight: 600 }}>{c.staffId?.name || 'Unknown'}</span>
                      <span className={`badge ${STATUS_BADGES[c.overallStatus] || 'badge-neutral'} badge-dot`}>{c.overallStatus.replace('_', ' ')}</span>
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                      {new Date(c.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · {done}/{total} items
                    </div>
                    <div style={{ marginTop: 'var(--space-2)', height: '4px', borderRadius: '2px', background: 'var(--bg-tertiary)' }}>
                      <div style={{ height: '100%', borderRadius: '2px', width: `${(done / total) * 100}%`, background: 'var(--accent-primary)', transition: 'width 0.3s' }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {selected && (
            <div className="card">
              <div className="card-header"><h3 style={{ fontSize: 'var(--text-sm)' }}>Checklist Items — {selected.staffId?.name}</h3></div>
              <div className="card-body" style={{ padding: 'var(--space-4)' }}>
                {selected.items.map((item) => (
                  <div key={item.key} style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--border-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-4)' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{item.label}</div>
                      <span className={`badge ${STATUS_BADGES[item.status] || 'badge-neutral'}`} style={{ marginTop: 'var(--space-1)', display: 'inline-block' }}>{item.status}</span>
                      {item.supervisorNote && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--status-danger)', marginTop: 'var(--space-1)' }}>Note: {item.supervisorNote}</div>}
                    </div>
                    {item.status === 'submitted' && (
                      <div className="flex gap-2">
                        <button className="btn btn-primary btn-sm" onClick={() => handleAction(selected._id, 'approve-item', item.key)}>✓ Approve</button>
                        <button className="btn btn-danger btn-sm" onClick={() => { const reason = prompt('Rejection reason:'); if (reason) handleAction(selected._id, 'reject-item', item.key, reason); }}>✕ Reject</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
