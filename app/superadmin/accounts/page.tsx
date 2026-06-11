'use client';
import { useState, useEffect, useCallback } from 'react';

interface LineItem { category: string; description: string; amount: number; referenceNumber: string; }
interface Entry { _id: string; date: string; income: LineItem[]; expenses: LineItem[]; electricity: LineItem[]; otherPayments: LineItem[]; totalIncome: number; totalExpenses: number; totalElectricity: number; totalOtherPayments: number; netAmount: number; isLocked: boolean; lockedAt: string; submittedBy: { name: string } | null; createdAt: string; }

const CATEGORIES: Record<string, string[]> = {
  income: ['Turf Booking', 'Membership Fee', 'Event Revenue', 'Sponsorship', 'Other Income'],
  expenses: ['Maintenance', 'Equipment', 'Salaries', 'Utilities', 'Supplies', 'Other Expense'],
  electricity: ['Monthly Bill', 'Generator Fuel', 'Solar Maintenance'],
  otherPayments: ['Insurance', 'License Fee', 'Government Tax', 'Vendor Payment', 'Other Payment'],
};

const emptyItem = (): LineItem => ({ category: '', description: '', amount: 0, referenceNumber: '' });

export default function AccountsPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'form'>('list');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [income, setIncome] = useState<LineItem[]>([emptyItem()]);
  const [expenses, setExpenses] = useState<LineItem[]>([emptyItem()]);
  const [electricity, setElectricity] = useState<LineItem[]>([emptyItem()]);
  const [otherPayments, setOtherPayments] = useState<LineItem[]>([emptyItem()]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: string } | null>(null);
  const showToast = (message: string, type = 'success') => { setToast({ message, type }); setTimeout(() => setToast(null), 3500); };

  const fetchEntries = useCallback(async () => {
    try {
      const res = await fetch('/api/accounts'); const data = await res.json();
      if (data.success) setEntries(data.data.entries);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const addItem = (setter: React.Dispatch<React.SetStateAction<LineItem[]>>) => setter((prev) => [...prev, emptyItem()]);
  const removeItem = (setter: React.Dispatch<React.SetStateAction<LineItem[]>>, idx: number) => setter((prev) => prev.filter((_, i) => i !== idx));
  const updateItem = (setter: React.Dispatch<React.SetStateAction<LineItem[]>>, idx: number, field: keyof LineItem, value: string | number) => {
    setter((prev) => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const sum = (items: LineItem[]) => items.reduce((s, i) => s + (Number(i.amount) || 0), 0);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/accounts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: formDate, income: income.filter((i) => i.amount > 0), expenses: expenses.filter((i) => i.amount > 0), electricity: electricity.filter((i) => i.amount > 0), otherPayments: otherPayments.filter((i) => i.amount > 0) }),
      });
      const data = await res.json();
      if (data.success) { showToast('Finance entry submitted & locked 🔒'); setView('list'); fetchEntries(); setIncome([emptyItem()]); setExpenses([emptyItem()]); setElectricity([emptyItem()]); setOtherPayments([emptyItem()]); }
      else showToast(data.message, 'error');
    } catch { showToast('Network error', 'error'); }
    finally { setSaving(false); }
  };

  const fmt = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

  const renderSection = (title: string, items: LineItem[], setter: React.Dispatch<React.SetStateAction<LineItem[]>>, cats: string[], icon: string) => (
    <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
      <div className="card-header"><h3 style={{ fontSize: 'var(--text-sm)' }}>{icon} {title}</h3><span className="badge badge-info">{fmt(sum(items))}</span></div>
      <div className="card-body" style={{ padding: 'var(--space-4)' }}>
        {items.map((item, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px 120px 40px', gap: 'var(--space-2)', marginBottom: 'var(--space-2)', alignItems: 'center' }}>
            <div className="select-wrapper"><select className="form-select" value={item.category} onChange={(e) => updateItem(setter, i, 'category', e.target.value)} style={{ height: '38px', fontSize: 'var(--text-sm)' }}><option value="">Category</option>{cats.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
            <input className="form-input" placeholder="Description" value={item.description} onChange={(e) => updateItem(setter, i, 'description', e.target.value)} style={{ height: '38px', fontSize: 'var(--text-sm)' }} />
            <input className="form-input" type="number" placeholder="Amount" value={item.amount || ''} onChange={(e) => updateItem(setter, i, 'amount', Number(e.target.value))} style={{ height: '38px', fontSize: 'var(--text-sm)' }} />
            <input className="form-input" placeholder="Ref #" value={item.referenceNumber} onChange={(e) => updateItem(setter, i, 'referenceNumber', e.target.value)} style={{ height: '38px', fontSize: 'var(--text-sm)' }} />
            <button className="btn btn-ghost btn-sm" onClick={() => removeItem(setter, i)} style={{ color: 'var(--status-danger)' }}>✕</button>
          </div>
        ))}
        <button className="btn btn-ghost btn-sm" onClick={() => addItem(setter)}>+ Add Row</button>
      </div>
    </div>
  );

  return (
    <div className="page-container">
      {toast && <div className="toast-container"><div className={`toast toast-${toast.type === 'error' ? 'error' : 'success'}`}><span className="toast-icon">{toast.type === 'error' ? '✕' : '✓'}</span><div className="toast-content"><div className="toast-title">{toast.message}</div></div></div></div>}

      <div className="page-header">
        <div><h1>Accounts</h1><p className="page-subtitle">Daily financial recording — income, expenses, electricity, and other payments</p></div>
        {view === 'list' && <button className="btn btn-primary btn-md" onClick={() => setView('form')}>+ New Entry</button>}
        {view === 'form' && <button className="btn btn-secondary btn-md" onClick={() => setView('list')}>← Back to History</button>}
      </div>

      {view === 'form' ? (
        <div>
          <div className="form-group" style={{ marginBottom: 'var(--space-6)', maxWidth: '250px' }}>
            <label className="form-label required">Date</label>
            <input type="date" className="form-input" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
          </div>
          {renderSection('Income', income, setIncome, CATEGORIES.income, '💰')}
          {renderSection('Expenses', expenses, setExpenses, CATEGORIES.expenses, '💸')}
          {renderSection('Electricity Charges', electricity, setElectricity, CATEGORIES.electricity, '⚡')}
          {renderSection('Other Payments', otherPayments, setOtherPayments, CATEGORIES.otherPayments, '📄')}

          <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
            <div className="card-body" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div><div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Net Amount</div><div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700 }} className="text-gradient">{fmt(sum(income) - sum(expenses) - sum(electricity) - sum(otherPayments))}</div></div>
              <button className={`btn btn-primary btn-lg ${saving ? 'btn-loading' : ''}`} onClick={handleSubmit} disabled={saving}>🔒 Submit & Lock</button>
            </div>
          </div>
        </div>
      ) : loading ? (
        <div className="loading-screen"><div className="spinner spinner-lg" /><div className="loading-text">Loading entries...</div></div>
      ) : entries.length === 0 ? (
        <div className="card"><div className="empty-state"><div className="empty-state-icon">💰</div><div className="empty-state-title">No finance entries yet</div><div className="empty-state-description">Submit your first daily finance report.</div></div></div>
      ) : (
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead><tr><th>Date</th><th>Income</th><th>Expenses</th><th>Electricity</th><th>Other</th><th>Net</th><th>Status</th><th>Submitted By</th></tr></thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e._id}>
                  <td style={{ fontWeight: 600 }}>{new Date(e.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                  <td style={{ color: 'var(--status-success)' }}>{fmt(e.totalIncome)}</td>
                  <td style={{ color: 'var(--status-danger)' }}>{fmt(e.totalExpenses)}</td>
                  <td>{fmt(e.totalElectricity)}</td>
                  <td>{fmt(e.totalOtherPayments)}</td>
                  <td style={{ fontWeight: 700 }}>{fmt(e.netAmount)}</td>
                  <td><span className={`badge ${e.isLocked ? 'badge-success' : 'badge-warning'} badge-dot`}>{e.isLocked ? '🔒 Locked' : '🔓 Unlocked'}</span></td>
                  <td style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{e.submittedBy?.name || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
