'use client';
import { useState, useEffect, useCallback } from 'react';
import { Banknote, CheckCircle, X, History, FileText } from 'lucide-react';
import { usePermissions } from '@/components/providers/PermissionsProvider';

export default function CashAssignmentPage() {
  // Trigger rebuild
  const [usersData, setUsersData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [historyUser, setHistoryUser] = useState<any>(null);
  const [historyTransactions, setHistoryTransactions] = useState<any[]>([]);
  const [historySummary, setHistorySummary] = useState<any>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [settleAmount, setSettleAmount] = useState<number | ''>('');
  const [referenceNote, setReferenceNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  const showToast = (m: string, t: 'success' | 'error' = 'success') => {
    setToast({ message: m, type: t });
    setTimeout(() => setToast(null), 3500);
  };

  const { checkPermission } = usePermissions();
  const canManageAccounts = checkPermission('accounts_finance', 'view_transactions'); // Using this as base permission

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/accounts/cash-assignment', { cache: 'no-store' });
      const d = await res.json();
      if (d.success) setUsersData(d.data.users);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSettle = async () => {
    if (!selectedUser || !settleAmount || settleAmount <= 0) return;
    if (settleAmount > selectedUser.balance) {
      return showToast('Cannot settle more than the outstanding balance', 'error');
    }
    
    setSaving(true);
    try {
      const res = await fetch('/api/accounts/cash-assignment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUser.userId, amount: settleAmount, referenceNote }),
      });
      const d = await res.json();
      if (d.success) {
        showToast('Cash settled successfully');
        setSelectedUser(null);
        setSettleAmount('');
        setReferenceNote('');
        fetchData();
        if (historyUser) {
          handleViewHistory(historyUser);
        }
      } else {
        showToast(d.message, 'error');
      }
    } catch {
      showToast('Error settling cash', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDirectSettle = async (txnAmount: number, reference: string) => {
    if (!historyUser || txnAmount <= 0) return;
    const finalAmount = Math.min(txnAmount, historySummary?.balance || 0);
    if (finalAmount <= 0) return;

    setSaving(true);
    try {
      const res = await fetch('/api/accounts/cash-assignment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: historyUser.userId, amount: finalAmount, referenceNote: reference }),
      });
      const d = await res.json();
      if (d.success) {
        showToast(`Settled ₹${finalAmount} successfully`);
        fetchData();
        handleViewHistory(historyUser);
      } else {
        showToast(d.message, 'error');
      }
    } catch {
      showToast('Error settling cash directly', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleViewHistory = async (user: any) => {
    setHistoryUser(user);
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/accounts/cash-assignment/${user.userId}`, { cache: 'no-store' });
      const d = await res.json();
      if (d.success) {
        setHistoryTransactions(d.data.transactions);
        setHistorySummary(d.data.summary);
      } else {
        showToast(d.message || 'Error fetching history', 'error');
      }
    } catch (e) {
      showToast('Error fetching history', 'error');
    } finally {
      setLoadingHistory(false);
    }
  };

  if (!canManageAccounts) return <div className="page-container"><h1>Access Denied</h1></div>;

  return (
    <div className="page-container">
      {toast && (
        <div className="toast-container" style={{ zIndex: 9999 }}>
          <div className={`toast toast-${toast.type}`}>
            <span className="toast-icon">{toast.type === 'error' ? <X size={16} /> : <CheckCircle size={16} />}</span>
            <div className="toast-content"><div className="toast-title">{toast.message}</div></div>
          </div>
        </div>
      )}

      <div className="page-header">
        <div>
          <h1>Cash Assignment & Settlement</h1>
          <p className="page-subtitle">Track and settle physical cash collected by staff</p>
        </div>
      </div>

      {loading ? (
        <div className="loading-screen"><div className="spinner spinner-lg" /></div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="data-table-wrapper" style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--surface-glass-border)', textAlign: 'left', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: 'var(--space-4)' }}>User</th>
                  <th style={{ padding: 'var(--space-4)' }}>Portal / Role</th>
                  <th style={{ padding: 'var(--space-4)', textAlign: 'right' }}>Total Cash Assigned</th>
                  <th style={{ padding: 'var(--space-4)', textAlign: 'right' }}>Total Settled</th>
                  <th style={{ padding: 'var(--space-4)', textAlign: 'right' }}>Balance On Hand</th>
                  <th style={{ padding: 'var(--space-4)', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {usersData.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No cash assignments found.
                    </td>
                  </tr>
                )}
                {usersData.map((user) => (
                  <tr key={user.userId} style={{ borderBottom: '1px solid var(--surface-glass-border)' }}>
                    <td style={{ padding: 'var(--space-4)', fontWeight: 600 }}>{user.name}</td>
                    <td style={{ padding: 'var(--space-4)' }}>
                      <div>{user.portalType}</div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{user.position}</div>
                    </td>
                    <td style={{ padding: 'var(--space-4)', textAlign: 'right', color: 'var(--text-secondary)' }}>₹{user.totalCashAssigned}</td>
                    <td style={{ padding: 'var(--space-4)', textAlign: 'right', color: 'var(--status-success)' }}>₹{user.totalCashSettled}</td>
                    <td style={{ padding: 'var(--space-4)', textAlign: 'right', fontWeight: 600, color: user.balance > 0 ? 'var(--status-danger)' : 'var(--text-primary)' }}>
                      ₹{user.balance}
                    </td>
                    <td style={{ padding: 'var(--space-4)', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button 
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleViewHistory(user)}
                          title="View History"
                        >
                          <History size={16} />
                        </button>
                        <button 
                          className="btn btn-primary btn-sm" 
                          disabled={user.balance <= 0}
                          onClick={() => {
                            setSelectedUser(user);
                            setSettleAmount(user.balance);
                          }}
                        >
                          Settle Cash
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedUser && (
        <div className="modal-backdrop" onClick={() => setSelectedUser(null)} style={{ zIndex: 1100 }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Banknote size={20} /> Settle Cash for {selectedUser.name}
              </h3>
              <button className="modal-close" onClick={() => setSelectedUser(null)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                <div className="card" style={{ padding: 'var(--space-4)' }}>
                  <div className="stat-label">Outstanding Balance</div>
                  <div className="stat-value" style={{ color: 'var(--status-danger)' }}>₹{selectedUser.balance}</div>
                </div>
                <div className="card" style={{ padding: 'var(--space-4)' }}>
                  <div className="stat-label">Total Assigned (All Time)</div>
                  <div className="stat-value">₹{selectedUser.totalCashAssigned}</div>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                <label className="form-label required">Amount to Settle (₹)</label>
                <input 
                  type="number" 
                  className="form-input" 
                  value={settleAmount}
                  onChange={e => setSettleAmount(e.target.value ? Number(e.target.value) : '')}
                  min={1}
                  max={selectedUser.balance}
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label className="form-label">Reference Note (Optional)</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={referenceNote}
                  onChange={e => setReferenceNote(e.target.value)}
                  placeholder="e.g. Handed over to Admin on date"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-md" onClick={() => setSelectedUser(null)}>Cancel</button>
              <button 
                className={`btn btn-primary btn-md ${saving ? 'btn-loading' : ''}`} 
                onClick={handleSettle}
                disabled={saving || !settleAmount || settleAmount <= 0 || settleAmount > selectedUser.balance}
              >
                Mark as Settled
              </button>
            </div>
          </div>
        </div>
      )}

      {historyUser && (
        <div className="modal-backdrop" onClick={() => setHistoryUser(null)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px', width: '90%' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <History size={20} /> Transaction History: {historyUser.name}
              </h3>
              <button className="modal-close" onClick={() => setHistoryUser(null)}><X size={20} /></button>
            </div>
            <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto', padding: 'var(--space-6)', background: 'var(--background)' }}>
              {loadingHistory ? (
                <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}><div className="spinner spinner-md" /></div>
              ) : (
                <>
                  {historySummary && (
                    <div className="grid grid-3" style={{ marginBottom: 'var(--space-6)' }}>
                      <div className="card stat-card" style={{ background: 'var(--surface-secondary)' }}>
                        <div className="stat-icon" style={{ background: 'var(--status-success-soft)', color: 'var(--status-success)' }}>
                          <Banknote size={24} />
                        </div>
                        <div className="stat-value text-gradient">₹{historySummary.balance || 0}</div>
                        <div className="stat-label">Current Balance on Hand</div>
                      </div>
                      <div className="card stat-card">
                        <div className="stat-icon" style={{ background: 'var(--status-warning-soft)', color: 'var(--status-warning)' }}>
                          <FileText size={24} />
                        </div>
                        <div className="stat-value">₹{historySummary.totalCashAssigned || 0}</div>
                        <div className="stat-label">Total Assigned</div>
                      </div>
                      <div className="card stat-card">
                        <div className="stat-icon" style={{ background: 'var(--accent-primary-soft)', color: 'var(--accent-primary)' }}>
                          <FileText size={24} />
                        </div>
                        <div className="stat-value">₹{historySummary.totalCashSettled || 0}</div>
                        <div className="stat-label">Total Settled</div>
                      </div>
                    </div>
                  )}

                  <div className="card" style={{ padding: 0 }}>
                    <div className="data-table-wrapper" style={{ overflowX: 'auto' }}>
                      <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--surface-glass-border)', textAlign: 'left', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                            <th style={{ padding: 'var(--space-4)' }}>DATE</th>
                            <th style={{ padding: 'var(--space-4)' }}>SOURCE</th>
                            <th style={{ padding: 'var(--space-4)' }}>CUSTOMER</th>
                            <th style={{ padding: 'var(--space-4)' }}>SUMMARY</th>
                            <th style={{ padding: 'var(--space-4)', textAlign: 'right' }}>AMOUNT</th>
                            <th style={{ padding: 'var(--space-4)', textAlign: 'center' }}>ACTION</th>
                          </tr>
                        </thead>
                        <tbody>
                          {historyTransactions.length === 0 && (
                            <tr>
                              <td colSpan={6} style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-muted)' }}>
                                No transactions found.
                              </td>
                            </tr>
                          )}
                          {historyTransactions.map((t) => (
                            <tr key={t._id} style={{ borderBottom: '1px solid var(--surface-glass-border)' }}>
                              <td style={{ padding: 'var(--space-4)', color: 'var(--text-secondary)' }}>
                                {new Date(t.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </td>
                              <td style={{ padding: 'var(--space-4)' }}>
                                <span className={`badge ${t.source === 'Booking' ? 'badge-primary' : t.source === 'Settlement' ? 'badge-success' : 'badge-warning'} badge-dot`}>
                                  {t.source}
                                </span>
                              </td>
                              <td style={{ padding: 'var(--space-4)' }}>
                                <div style={{ fontWeight: 600 }}>{t.customerName}</div>
                              </td>
                              <td style={{ padding: 'var(--space-4)', color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
                                {t.summary}
                              </td>
                              <td style={{ padding: 'var(--space-4)', textAlign: 'right', fontWeight: 600, color: t.amount > 0 ? 'var(--status-danger)' : 'var(--status-success)' }}>
                                {t.amount > 0 ? `+₹${t.amount}` : `-₹${Math.abs(t.amount)}`}
                              </td>
                              <td style={{ padding: 'var(--space-4)', textAlign: 'center' }}>
                                {t.amount > 0 && historySummary?.balance > 0 && (
                                  <button 
                                    className={`btn btn-primary btn-sm ${saving ? 'btn-loading' : ''}`}
                                    disabled={saving}
                                    onClick={() => handleDirectSettle(t.amount, `Settled ${t.source} - ${t.customerName}`)}
                                  >
                                    Settle
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-md" onClick={() => setHistoryUser(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
