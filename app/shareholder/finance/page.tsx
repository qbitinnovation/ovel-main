'use client';

import { useEffect, useMemo, useState } from 'react';

type FinanceEntry = {
  _id: string;
  date: string;
  totalIncome: number;
  totalExpenses: number;
  totalElectricity: number;
  totalOtherPayments: number;
  netAmount: number;
};

export default function ShareholderFinancePage() {
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchFinance() {
      try {
        const res = await fetch('/api/accounts?limit=20');
        const data = await res.json();
        if (data.success) setEntries(data.data?.entries || []);
      } catch (error) {
        console.error('Failed to fetch shareholder finance:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchFinance();
  }, []);

  const summary = useMemo(() => {
    return entries.reduce(
      (totals, entry) => ({
        income: totals.income + entry.totalIncome,
        expenses:
          totals.expenses +
          entry.totalExpenses +
          entry.totalElectricity +
          entry.totalOtherPayments,
        net: totals.net + entry.netAmount,
      }),
      { income: 0, expenses: 0, net: 0 }
    );
  }, [entries]);

  const fmt = (value: number) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Finance</h1>
          <p className="page-subtitle">View-only shareholder finance summary</p>
        </div>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 'var(--space-8)' }}>
        <div className="card stat-card">
          <div className="stat-icon" style={{ background: 'var(--status-success-soft)', color: 'var(--status-success)' }}>IN</div>
          <div className="stat-value text-gradient">{fmt(summary.income)}</div>
          <div className="stat-label">Recent Income</div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon" style={{ background: 'var(--status-danger-soft)', color: 'var(--status-danger)' }}>EX</div>
          <div className="stat-value text-gradient">{fmt(summary.expenses)}</div>
          <div className="stat-label">Recent Expenses</div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon" style={{ background: 'var(--accent-primary-soft)', color: 'var(--accent-primary)' }}>NP</div>
          <div className="stat-value text-gradient">{fmt(summary.net)}</div>
          <div className="stat-label">Recent Net</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Recent Finance Entries</h3>
          <span className="badge badge-neutral">View Only</span>
        </div>
        <div className="card-body">
          {loading ? (
            <div className="loading-screen"><div className="spinner spinner-lg" /></div>
          ) : entries.length === 0 ? (
            <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
              <div className="empty-state-icon">₹</div>
              <div className="empty-state-title">No finance entries yet</div>
              <div className="empty-state-description">Finance summaries will appear here once entries are submitted.</div>
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Income</th>
                    <th>Expenses</th>
                    <th>Net</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry._id}>
                      <td>{new Date(entry.date).toLocaleDateString()}</td>
                      <td>{fmt(entry.totalIncome)}</td>
                      <td>{fmt(entry.totalExpenses + entry.totalElectricity + entry.totalOtherPayments)}</td>
                      <td>{fmt(entry.netAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
