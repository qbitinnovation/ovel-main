'use client';

import { useCallback, useEffect, useState, useMemo } from 'react';
import { X, Check, CheckCircle } from 'lucide-react';
import { SUPERVISOR_CHECKLIST_ITEMS } from '@/lib/supervisor-checklist';

interface ChecklistItem {
  key: string;
  label: string;
  status: string;
  photoUrl: string;
  capturedAt?: string | null;
  supervisorNote: string;
  sourceChecklistId?: string;
}

interface ChecklistRecord {
  _id: string;
  staffId: { _id: string; name: string } | null;
  date: string;
  items: ChecklistItem[];
  overallStatus: string;
  submittedAt: string | null;
  verifiedAt: string | null;
  verifiedBy: { name: string } | null;
}

const STATUS_BADGES: Record<string, string> = {
  pending: 'badge-neutral',
  submitted: 'badge-info',
  approved: 'badge-success',
  rejected: 'badge-danger',
  unverified: 'badge-warning',
  verified: 'badge-success',
  partially_verified: 'badge-warning',
};

const ITEM_STATUS_WEIGHT: Record<string, number> = {
  pending: 0,
  unverified: 1,
  rejected: 2,
  approved: 3,
  submitted: 4,
};

function getChecklistDay(date: string) {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toISOString().slice(0, 10);
}

function getChecklistGroupKey(checklist: ChecklistRecord) {
  return `${checklist.staffId?._id || checklist.staffId?.name || 'unknown'}:${getChecklistDay(checklist.date)}`;
}

function isBetterChecklistItem(candidate: ChecklistItem, current?: ChecklistItem) {
  if (!current) return true;
  if (candidate.photoUrl && !current.photoUrl) return true;
  const candidateWeight = ITEM_STATUS_WEIGHT[candidate.status] ?? 0;
  const currentWeight = ITEM_STATUS_WEIGHT[current.status] ?? 0;
  if (candidateWeight !== currentWeight) return candidateWeight > currentWeight;
  return new Date(candidate.capturedAt || 0).getTime() > new Date(current.capturedAt || 0).getTime();
}

function getOverallStatus(items: ChecklistItem[]) {
  if (items.length === 0) return 'pending';
  if (items.every((item) => item.status === 'approved')) return 'verified';
  if (items.every((item) => ['approved', 'rejected', 'unverified'].includes(item.status))) return 'partially_verified';
  if (items.some((item) => item.status === 'submitted')) return 'submitted';
  if (items.some((item) => item.status !== 'pending')) return 'submitted';
  return 'pending';
}

function mergeSameDayChecklists(records: ChecklistRecord[]) {
  const groups = new Map<string, ChecklistRecord>();

  records.forEach((record) => {
    const groupKey = getChecklistGroupKey(record);
    const existing = groups.get(groupKey);

    if (!existing) {
      groups.set(groupKey, {
        ...record,
        _id: groupKey,
        items: record.items.map((item) => ({ ...item, sourceChecklistId: record._id })),
      });
      return;
    }

    const itemsByKey = new Map<string, ChecklistItem>();
    existing.items.forEach((item) => itemsByKey.set(item.key, item));
    record.items.forEach((item) => {
      const itemWithSource = { ...item, sourceChecklistId: record._id };
      if (isBetterChecklistItem(itemWithSource, itemsByKey.get(item.key))) {
        itemsByKey.set(item.key, itemWithSource);
      }
    });

    const mergedItems = Array.from(itemsByKey.values());
    const latestSubmittedAt =
      new Date(record.submittedAt || 0).getTime() > new Date(existing.submittedAt || 0).getTime()
        ? record.submittedAt
        : existing.submittedAt;

    groups.set(groupKey, {
      ...existing,
      date: new Date(record.date).getTime() > new Date(existing.date).getTime() ? record.date : existing.date,
      items: mergedItems,
      overallStatus: getOverallStatus(mergedItems),
      submittedAt: latestSubmittedAt,
      verifiedAt: record.verifiedAt || existing.verifiedAt,
      verifiedBy: record.verifiedBy || existing.verifiedBy,
    });
  });

  return Array.from(groups.values()).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export default function ChecklistsPage() {
  const [checklists, setChecklists] = useState<ChecklistRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ChecklistRecord | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<{ src: string; label: string } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: string } | null>(null);
  const [canApprove, setCanApprove] = useState(false);
  const [canReject, setCanReject] = useState(false);

  const mergedSelectedItems = useMemo(() => {
    if (!selected) return [];
    return SUPERVISOR_CHECKLIST_ITEMS.map((baseItem) => {
      const dbItem = selected.items.find((i) => i.key === baseItem.key);
      return (dbItem || {
        ...baseItem,
        status: 'pending',
        photoUrl: '',
        capturedAt: null,
        supervisorNote: '',
        sourceChecklistId: selected._id,
      }) as ChecklistItem;
    });
  }, [selected]);

  useEffect(() => {
    async function fetchAccess() {
      try {
        const res = await fetch('/api/users/me/access');
        if (res.ok) {
          const data = await res.json();
          const moduleAccess = data.data?.find((m: any) => m.moduleKey === 'daily_operations');
          if (moduleAccess?.accessLevel === 'full_control') {
            setCanApprove(true);
            setCanReject(true);
          } else if (moduleAccess?.enabledActions) {
            setCanApprove(moduleAccess.enabledActions.includes('approve_checklist'));
            setCanReject(moduleAccess.enabledActions.includes('reject_checklist'));
          }
        }
      } catch (error) {
        console.error('Failed to fetch module access:', error);
      }
    }
    fetchAccess();
  }, []);

  const showToast = (message: string, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchChecklists = useCallback(async () => {
    try {
      const res = await fetch('/api/checklists');
      const data = await res.json();
      if (data.success) {
        const merged = mergeSameDayChecklists(data.data);
        setChecklists(merged);
        setSelected((current) => {
          if (!current) return current;
          return merged.find((checklist) => checklist._id === current._id) || null;
        });
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchChecklists(); }, [fetchChecklists]);

  const handleAction = async (checklistId: string, action: string, itemKey: string, reason = '') => {
    try {
      const res = await fetch(`/api/checklists/${checklistId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, itemKey, reason }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message);
        fetchChecklists();
      } else {
        showToast(data.message, 'error');
      }
    } catch {
      showToast('Error', 'error');
    }
  };

  return (
    <div>
      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type === 'error' ? 'error' : 'success'}`}>
            <span className="toast-icon">{toast.type === 'error' ? <X size={16} /> : <Check size={16} />}</span>
            <div className="toast-content"><div className="toast-title">{toast.message}</div></div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading-screen"><div className="spinner spinner-lg" /></div>
      ) : checklists.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon"><CheckCircle size={48} /></div>
            <div className="empty-state-title">No checklists yet</div>
            <div className="empty-state-description">Checklists will appear here when generated for staff members.</div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 1.5fr' : '1fr', gap: 'var(--space-6)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {checklists.map((checklist) => {
              const total = SUPERVISOR_CHECKLIST_ITEMS.length;
              const done = checklist.items.filter((item) => ['approved', 'submitted'].includes(item.status)).length;
              return (
                <div
                  key={checklist._id}
                  className={`card card-interactive ${selected?._id === checklist._id ? 'card-active' : ''}`}
                  onClick={() => setSelected(checklist)}
                  style={{ cursor: 'pointer', borderColor: selected?._id === checklist._id ? 'var(--accent-primary)' : undefined }}
                >
                  <div style={{ padding: 'var(--space-4)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                      <span style={{ fontWeight: 600 }}>{checklist.staffId?.name || 'Unknown'}</span>
                      <span className={`badge ${STATUS_BADGES[checklist.overallStatus] || 'badge-neutral'} badge-dot`}>
                        {checklist.overallStatus.replace('_', ' ')}
                      </span>
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                      {new Date(checklist.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · {done}/{total} items
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
              <div className="card-header">
                <h3 style={{ fontSize: 'var(--text-sm)' }}>Checklist Items - {selected.staffId?.name}</h3>
              </div>
              <div className="card-body" style={{ padding: 'var(--space-4)' }}>
                {mergedSelectedItems.map((item) => (
                  <div key={item.key} className="checklist-review-item">
                    <div className="checklist-proof">
                      {item.photoUrl ? (
                        <button
                          type="button"
                          className="checklist-proof-button"
                          onClick={() => setPreviewPhoto({ src: item.photoUrl, label: item.label })}
                          aria-label={`View proof photo for ${item.label}`}
                        >
                          <img src={item.photoUrl} alt={`${item.label} proof`} />
                          <span>View Photo</span>
                        </button>
                      ) : (
                        <div className="checklist-proof-empty">No Photo</div>
                      )}
                    </div>

                    <div className="checklist-review-main">
                      <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{item.label}</div>
                      <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', marginTop: 'var(--space-1)', flexWrap: 'wrap' }}>
                        <span className={`badge ${STATUS_BADGES[item.status] || 'badge-neutral'}`}>{item.status}</span>
                        {item.capturedAt && (
                          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                            Uploaded {new Date(item.capturedAt).toLocaleString('en-IN')}
                          </span>
                        )}
                      </div>
                      {item.supervisorNote && (
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--status-danger)', marginTop: 'var(--space-1)' }}>
                          Note: {item.supervisorNote}
                        </div>
                      )}
                    </div>

                    {item.status === 'submitted' && (
                      <div className="flex gap-2" style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {canApprove && (
                          <button className="btn btn-primary btn-sm" onClick={() => handleAction(item.sourceChecklistId || selected._id, 'approve-item', item.key)} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Check size={16} /> Approve</button>
                        )}
                        {canReject && (
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => {
                              const reason = prompt('Rejection reason:');
                              if (reason) handleAction(item.sourceChecklistId || selected._id, 'reject-item', item.key, reason);
                            }}
                          >
                            <X size={16} /> Reject
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {previewPhoto && (
        <div className="modal-backdrop" onClick={() => setPreviewPhoto(null)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Proof Photo - {previewPhoto.label}</h3>
              <button className="modal-close" onClick={() => setPreviewPhoto(null)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <img
                src={previewPhoto.src}
                alt={`${previewPhoto.label} proof full preview`}
                style={{
                  width: '100%',
                  maxHeight: '70vh',
                  objectFit: 'contain',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--surface-glass-border)',
                  background: 'var(--bg-tertiary)',
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
