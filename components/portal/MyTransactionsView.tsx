'use client';
import { useState, useEffect, useCallback } from 'react';
import { Banknote, FileText } from 'lucide-react';

export default function MyTransactionsView() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [summary, setSummary] = useState({ totalCashAssigned: 0, totalCashSettled: 0, balance: 0, transactionCount: 0 });
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/users/me/cash-history', { cache: 'no-store' });
      const d = await res.json();
      if (d.success) {
        setTransactions(d.data.transactions);
        setSummary(d.data.summary);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return <div className="loading-screen"><div className="spinner spinner-lg" /></div>;
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>My Transactions</h1>
          <p className="page-subtitle">History of cash payments assigned to you</p>
        </div>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="card stat-card" style={{ background: 'var(--surface-secondary)' }}>
          <div className="stat-icon" style={{ background: 'var(--status-success-soft)', color: 'var(--status-success)' }}>
            <Banknote size={24} />
          </div>
          <div className="stat-value text-gradient">₹{summary.balance || 0}</div>
          <div className="stat-label">Current Balance on Hand</div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon" style={{ background: 'var(--status-warning-soft)', color: 'var(--status-warning)' }}>
            <FileText size={24} />
          </div>
          <div className="stat-value">₹{summary.totalCashAssigned || 0}</div>
          <div className="stat-label">Total Assigned</div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon" style={{ background: 'var(--accent-primary-soft)', color: 'var(--accent-primary)' }}>
            <FileText size={24} />
          </div>
          <div className="stat-value">₹{summary.totalCashSettled || 0}</div>
          <div className="stat-label">Total Settled</div>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="data-table-wrapper" style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--surface-glass-border)', textAlign: 'left', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: 'var(--space-4)' }}>Date</th>
                <th style={{ padding: 'var(--space-4)' }}>Source</th>
                <th style={{ padding: 'var(--space-4)' }}>Customer</th>
                <th style={{ padding: 'var(--space-4)' }}>Summary</th>
                <th style={{ padding: 'var(--space-4)', textAlign: 'right' }}>Amount</th>
                <th style={{ padding: 'var(--space-4)', textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No cash transactions found.
                  </td>
                </tr>
              )}
              {transactions.map((t) => (
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
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{t.customerContact}</div>
                  </td>
                  <td style={{ padding: 'var(--space-4)', color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
                    {t.summary}
                  </td>
                  <td style={{ padding: 'var(--space-4)', textAlign: 'right', fontWeight: 600, color: t.status === 'Settled' ? 'var(--status-success)' : 'var(--status-danger)' }}>
                    ₹{t.amount}
                  </td>
                  <td style={{ padding: 'var(--space-4)', textAlign: 'center' }}>
                    <span className={`badge ${t.status === 'Settled' ? 'badge-success' : 'badge-danger'}`} style={{ padding: '4px 12px', borderRadius: 'var(--radius-full)' }}>
                      {t.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
