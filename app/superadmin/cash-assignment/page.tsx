'use client';
import { useState, useEffect, useCallback } from 'react';
import { Banknote, CheckCircle, X, History, FileText, Download, FileSpreadsheet } from 'lucide-react';
import { usePermissions } from '@/components/providers/PermissionsProvider';
import { generateStandardReport } from '@/lib/report-generator';
import * as XLSX from 'xlsx';
import { CustomSelect } from '@/components/ui/CustomSelect';

export default function CashAssignmentPage() {
  // Trigger rebuild
  const [usersData, setUsersData] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<'All' | 'Pending' | 'Paid'>('All');

  const filteredUsersData = usersData.filter((user) => {
    if (statusFilter === 'Pending') return user.balance > 0;
    if (statusFilter === 'Paid') return user.balance === 0;
    return true;
  });

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

  // Filter & Sorting States for Single User History
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<string>('newest');

  const filteredTransactions = (historyTransactions || [])
    .filter((t) => {
      if (filterStatus !== 'All' && t.status !== filterStatus) return false;
      if (startDate) {
        const sDate = new Date(startDate);
        sDate.setHours(0, 0, 0, 0);
        if (new Date(t.date) < sDate) return false;
      }
      if (endDate) {
        const eDate = new Date(endDate);
        eDate.setHours(23, 59, 59, 999);
        if (new Date(t.date) > eDate) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortOrder === 'newest') return new Date(b.date).getTime() - new Date(a.date).getTime();
      if (sortOrder === 'oldest') return new Date(a.date).getTime() - new Date(b.date).getTime();
      if (sortOrder === 'amount-desc') return b.amount - a.amount;
      if (sortOrder === 'amount-asc') return a.amount - b.amount;
      return 0;
    });
  
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

  const closeHistoryModal = () => {
    setHistoryUser(null);
    setFilterStatus('All');
    setStartDate('');
    setEndDate('');
    setSortOrder('newest');
  };

  const handleDownloadAllReport = () => {
    const columns = [
      { header: 'User', dataKey: 'name' },
      { header: 'Portal / Role', dataKey: 'portalAndRole' },
      { header: 'Total Cash Assigned', dataKey: 'totalCashAssignedStr', align: 'right' as const },
      { header: 'Total Settled', dataKey: 'totalCashSettledStr', align: 'right' as const },
      { header: 'Balance On Hand', dataKey: 'balanceStr', align: 'right' as const },
    ];

    const reportData = filteredUsersData.map(u => ({
      name: u.name,
      portalAndRole: `${u.portalType} / ${u.position || 'N/A'}`,
      totalCashAssignedStr: `Rs. ${u.totalCashAssigned}`,
      totalCashSettledStr: `Rs. ${u.totalCashSettled}`,
      balanceStr: `Rs. ${u.balance}`,
    }));

    const totalBalance = filteredUsersData.reduce((acc, curr) => acc + curr.balance, 0);
    const totalAssigned = filteredUsersData.reduce((acc, curr) => acc + curr.totalCashAssigned, 0);
    const totalSettled = filteredUsersData.reduce((acc, curr) => acc + curr.totalCashSettled, 0);

    generateStandardReport({
      title: `Cash In Hand - ${statusFilter === 'All' ? 'All' : statusFilter === 'Pending' ? 'Pending Settlement' : 'Fully Settled'} Users Summary`,
      reportPeriod: 'All-Time Summary',
      summary: [
        { label: 'Total Balance on Hand', value: `Rs. ${totalBalance}` },
        { label: 'Total Assigned', value: `Rs. ${totalAssigned}` },
        { label: 'Total Settled', value: `Rs. ${totalSettled}` },
      ],
      columns,
      data: reportData,
      filename: `Cash_In_Hand_${statusFilter}_Users_${new Date().toISOString().split('T')[0]}.pdf`,
    });
  };

  const handleDownloadSingleReport = () => {
    if (!historyUser || !historySummary) return;

    const columns = [
      { header: 'Date', dataKey: 'dateStr' },
      { header: 'Source', dataKey: 'source' },
      { header: 'Customer', dataKey: 'customerName' },
      { header: 'Summary', dataKey: 'summary' },
      { header: 'Amount', dataKey: 'amountStr', align: 'right' as const },
      { header: 'Status', dataKey: 'status' },
    ];

    const reportData = filteredTransactions.map(t => ({
      dateStr: new Date(t.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      source: t.source,
      customerName: t.customerName || 'N/A',
      summary: t.summary,
      amountStr: `Rs. ${t.amount}`,
      status: t.status,
    }));

    const filteredAssigned = filteredTransactions
      .reduce((acc, curr) => acc + curr.amount, 0);
    const filteredSettled = filteredTransactions
      .filter(t => t.status === 'Settled')
      .reduce((acc, curr) => acc + curr.amount, 0);

    let period = 'All Transactions';
    if (startDate || endDate) {
      const s = startDate ? new Date(startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Start';
      const e = endDate ? new Date(endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'End';
      period = `${s} to ${e}`;
    }

    generateStandardReport({
      title: `Cash History - ${historyUser.name}`,
      reportPeriod: period,
      summary: [
        { label: 'Current Balance', value: `Rs. ${historySummary.balance || 0}` },
        { label: 'Filtered Received', value: `Rs. ${filteredAssigned}` },
        { label: 'Filtered Settled', value: `Rs. ${filteredSettled}` },
      ],
      columns,
      data: reportData,
      filename: `Cash_History_${historyUser.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`,
    });
  };

  const handleDownloadAllReportExcel = () => {
    const exportData = filteredUsersData.map(u => ({
      'User Name': u.name,
      'Portal Type': u.portalType,
      'Position/Role': u.position || 'N/A',
      'Total Cash Assigned (Rs.)': u.totalCashAssigned,
      'Total Settled (Rs.)': u.totalCashSettled,
      'Balance On Hand (Rs.)': u.balance,
      'Last Settlement Date': u.lastSettlement ? new Date(u.lastSettlement).toLocaleDateString('en-IN') : 'N/A'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Cash In Hand Summary');
    XLSX.writeFile(workbook, `Cash_In_Hand_Summary_${statusFilter}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleDownloadSingleReportExcel = () => {
    if (!historyUser || !historyTransactions) return;

    const exportData = filteredTransactions.map(t => ({
      'Date': new Date(t.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      'Source': t.source,
      'Customer': t.customerName || 'N/A',
      'Summary': t.summary,
      'Amount (Rs.)': t.amount,
      'Status': t.status
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `History_${historyUser.name}`);
    XLSX.writeFile(workbook, `Cash_History_${historyUser.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`);
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

      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div>
          <h1>Cash In Hand</h1>
          <p className="page-subtitle">Track and settle physical cash collected by staff</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            className="btn btn-primary"
            onClick={handleDownloadAllReport}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '8px' }}
          >
            <Download size={18} /> <span>Download PDF</span>
          </button>
          <button 
            className="btn btn-secondary"
            onClick={handleDownloadAllReportExcel}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '8px' }}
          >
            <FileSpreadsheet size={18} /> <span>Download Excel</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading-screen"><div className="spinner spinner-lg" /></div>
      ) : (
        <>
          {/* Status Filter tabs */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: 'var(--space-4)' }}>
            {(['All', 'Pending', 'Paid'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`btn ${statusFilter === status ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                style={{ borderRadius: 'var(--radius-full)', padding: '6px 16px', fontWeight: 500 }}
              >
                {status === 'Pending' ? 'Pending Settlement' : status === 'Paid' ? 'Fully Settled' : 'All Persons'}
              </button>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hide-on-mobile card" style={{ padding: 0 }}>
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
                  {filteredUsersData.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No cash assignments found.
                      </td>
                    </tr>
                  )}
                  {filteredUsersData.map((user) => (
                    <tr 
                      key={user.userId} 
                      style={{ borderBottom: '1px solid var(--surface-glass-border)', cursor: 'pointer' }}
                      onClick={() => handleViewHistory(user)}
                      className="hover-row"
                    >
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
                        <button 
                          className="btn btn-primary btn-sm" 
                          disabled={user.balance <= 0}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedUser(user);
                            setSettleAmount(user.balance);
                          }}
                        >
                          Settle Cash
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Box/Card View */}
          <div className="show-on-mobile" style={{ flexDirection: 'column', gap: 'var(--space-3)', width: '100%' }}>
            {filteredUsersData.length === 0 && (
              <div className="card" style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-muted)' }}>
                No cash assignments found.
              </div>
            )}
            {filteredUsersData.map((user) => (
              <div 
                key={user.userId} 
                className="card hover-row" 
                style={{ 
                  padding: 'var(--space-4)', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: 'var(--space-3)',
                  cursor: 'pointer',
                  border: '1px solid var(--surface-glass-border)'
                }}
                onClick={() => handleViewHistory(user)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 'var(--text-md)', color: 'var(--text-primary)' }}>{user.name}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {user.portalType} • {user.position || 'No Role'}
                    </div>
                  </div>
                  <button 
                    className="btn btn-primary btn-sm" 
                    disabled={user.balance <= 0}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedUser(user);
                      setSettleAmount(user.balance);
                    }}
                    style={{ padding: '6px 12px', fontSize: '11px' }}
                  >
                    Settle Cash
                  </button>
                </div>

                <hr style={{ border: 0, borderTop: '1px solid var(--surface-glass-border)', margin: 0 }} />

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)', textAlign: 'center' }}>
                  <div>
                    <div style={{ fontSize: '9px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.2px' }}>Assigned</div>
                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '2px' }}>₹{user.totalCashAssigned}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '9px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.2px' }}>Settled</div>
                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--status-success)', marginTop: '2px' }}>₹{user.totalCashSettled}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '9px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.2px' }}>Balance</div>
                    <div style={{ 
                      fontSize: 'var(--text-sm)', 
                      fontWeight: 700, 
                      color: user.balance > 0 ? 'var(--status-danger)' : 'var(--text-primary)', 
                      marginTop: '2px' 
                    }}>
                      ₹{user.balance}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
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
        <div className="modal-backdrop" onClick={closeHistoryModal} style={{ zIndex: 1000 }}>
          <div 
            className="modal modal-xl" 
            onClick={e => e.stopPropagation()} 
            style={{ 
              display: 'flex', 
              flexDirection: 'column',
              maxHeight: '90vh',
              overflow: 'hidden'
            }}
          >
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <History size={20} /> Transaction History: {historyUser.name}
              </h3>
              <button className="modal-close" onClick={closeHistoryModal}><X size={20} /></button>
            </div>
          <div className="modal-body" style={{ flex: 1, overflowY: 'auto' }}>
            {loadingHistory ? (
              <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}><div className="spinner spinner-md" /></div>
            ) : (
              <>
                {historySummary && (
                  <div className="grid grid-3" style={{ marginBottom: 'var(--space-6)' }}>
                    <div className="card stat-card">
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

                {/* Filter & Sorting Controls */}
                <div className="card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-6)', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-4)', alignItems: 'end' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: 'var(--text-xs)', marginBottom: '4px', display: 'block' }}>Status</label>
                    <CustomSelect
                      options={[
                        { value: 'All', label: 'All' },
                        { value: 'Settled', label: 'Settled' },
                        { value: 'Not Settled', label: 'Pending' }
                      ]}
                      value={filterStatus}
                      onChange={setFilterStatus}
                      searchable={false}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: 'var(--text-xs)', marginBottom: '4px', display: 'block' }}>Start Date</label>
                    <input 
                      type="date" 
                      className="form-input" 
                      value={startDate} 
                      onChange={(e) => setStartDate(e.target.value)}
                      style={{ height: '38px', fontSize: '13px', width: '100%', paddingLeft: '8px', paddingRight: '8px' }}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: 'var(--text-xs)', marginBottom: '4px', display: 'block' }}>End Date</label>
                    <input 
                      type="date" 
                      className="form-input" 
                      value={endDate} 
                      onChange={(e) => setEndDate(e.target.value)}
                      style={{ height: '38px', fontSize: '13px', width: '100%', paddingLeft: '8px', paddingRight: '8px' }}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: 'var(--text-xs)', marginBottom: '4px', display: 'block' }}>Sort By</label>
                    <CustomSelect
                      options={[
                        { value: 'newest', label: 'Newest' },
                        { value: 'oldest', label: 'Oldest' },
                        { value: 'amount-desc', label: 'High to Low' },
                        { value: 'amount-asc', label: 'Low to High' }
                      ]}
                      value={sortOrder}
                      onChange={setSortOrder}
                      searchable={false}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '8px', width: '100%', gridColumn: '1 / -1' }}>
                    <button 
                      className="btn btn-primary btn-md" 
                      onClick={handleDownloadSingleReport}
                      style={{ height: '38px', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center', flex: 1 }}
                    >
                      <Download size={16} /> PDF
                    </button>
                    <button 
                      className="btn btn-secondary btn-md" 
                      onClick={handleDownloadSingleReportExcel}
                      style={{ height: '38px', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center', flex: 1 }}
                    >
                      <FileSpreadsheet size={16} /> Excel
                    </button>
                  </div>
                </div>

                {/* Desktop Table View */}
                <div className="hide-on-mobile card" style={{ padding: 0 }}>
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
                        {filteredTransactions.length === 0 && (
                          <tr>
                            <td colSpan={6} style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-muted)' }}>
                              No transactions found.
                            </td>
                          </tr>
                        )}
                        {filteredTransactions.map((t) => (
                          <tr key={t._id} style={{ borderBottom: '1px solid var(--surface-glass-border)' }}>
                            <td style={{ padding: 'var(--space-4)', color: 'var(--text-secondary)' }}>
                              {new Date(t.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </td>
                            <td style={{ padding: 'var(--space-4)' }}>
                              <span className={`badge ${t.source === 'Booking' ? 'badge-primary' : 'badge-warning'} badge-dot`}>
                                {t.source}
                              </span>
                            </td>
                            <td style={{ padding: 'var(--space-4)' }}>
                              <div style={{ fontWeight: 600 }}>{t.customerName}</div>
                            </td>
                            <td style={{ padding: 'var(--space-4)', color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
                              {t.summary}
                            </td>
                            <td style={{ padding: 'var(--space-4)', textAlign: 'right', fontWeight: 600, color: t.status === 'Settled' ? 'var(--status-success)' : 'var(--status-danger)' }}>
                              ₹{t.amount}
                            </td>
                            <td style={{ padding: 'var(--space-4)', textAlign: 'center' }}>
                              {t.status === 'Settled' ? (
                                <span className="badge badge-success" style={{ padding: '4px 12px', borderRadius: 'var(--radius-full)' }}>Settled</span>
                              ) : (
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

                {/* Mobile Card/Box View */}
                <div className="show-on-mobile" style={{ flexDirection: 'column', gap: 'var(--space-3)', width: '100%' }}>
                  {filteredTransactions.length === 0 && (
                    <div className="card" style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No transactions found.
                    </div>
                  )}
                  {filteredTransactions.map((t) => (
                    <div 
                      key={t._id} 
                      className="card" 
                      style={{ 
                        padding: 'var(--space-4)', 
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: 'var(--space-3)',
                        border: '1px solid var(--surface-glass-border)' 
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                          {new Date(t.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                        <span className={`badge ${t.source === 'Booking' ? 'badge-primary' : 'badge-warning'} badge-dot`}>
                          {t.source}
                        </span>
                      </div>

                      <div>
                        <div style={{ fontWeight: 700, fontSize: 'var(--text-md)', color: 'var(--text-primary)' }}>{t.customerName}</div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '2px' }}>{t.summary}</div>
                      </div>

                      <hr style={{ border: 0, borderTop: '1px solid var(--surface-glass-border)', margin: 0 }} />

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginRight: '4px' }}>Amount:</span>
                          <span style={{ 
                            fontWeight: 700, 
                            color: t.status === 'Settled' ? 'var(--status-success)' : 'var(--status-danger)' 
                          }}>
                            ₹{t.amount}
                          </span>
                        </div>
                        <div>
                          {t.status === 'Settled' ? (
                            <span className="badge badge-success" style={{ padding: '4px 12px', borderRadius: 'var(--radius-full)' }}>Settled</span>
                          ) : (
                            <button 
                              className={`btn btn-primary btn-sm ${saving ? 'btn-loading' : ''}`}
                              disabled={saving}
                              onClick={() => handleDirectSettle(t.amount, `Settled ${t.source} - ${t.customerName}`)}
                              style={{ padding: '6px 12px', fontSize: '11px' }}
                            >
                              Settle
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-md" onClick={closeHistoryModal}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
