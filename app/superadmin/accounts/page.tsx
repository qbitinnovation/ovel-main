'use client';
import { useState, useEffect, useCallback } from 'react';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { CustomDatePicker } from '@/components/ui/CustomDatePicker';
import { Wallet, Package, ShoppingCart, Calendar, FileText, Plus, X, ChevronRight } from 'lucide-react';

interface UnifiedTransaction {
  _id: string;
  type: 'booking' | 'sale' | 'restock' | 'manual';
  date: string;
  amount: number;
  customerName: string;
  customerContact: string;
  summary: string;
  user: {
    name: string;
    portal: string;
    position: string;
  };
  details: any;
}

const CATEGORIES: Record<string, string[]> = {
  income: ['Turf Booking', 'Membership Fee', 'Event Revenue', 'Sponsorship', 'Other Income'],
  expenses: ['Maintenance', 'Equipment', 'Salaries', 'Utilities', 'Supplies', 'Other Expense'],
  electricity: ['Monthly Bill', 'Generator Fuel', 'Solar Maintenance'],
  otherPayments: ['Insurance', 'License Fee', 'Government Tax', 'Vendor Payment', 'Other Payment'],
};

export default function AccountsPage() {
  const [transactions, setTransactions] = useState<UnifiedTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'bookings' | 'sales' | 'inventory' | 'manual'>('all');
  const [view, setView] = useState<'list' | 'form'>('list');
  
  // Manual Entry Form State
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [entryType, setEntryType] = useState<'income' | 'expenses'>('income');
  const [entryCategory, setEntryCategory] = useState('');
  const [entryDesc, setEntryDesc] = useState('');
  const [entryAmount, setEntryAmount] = useState<number | ''>('');
  const [entryRef, setEntryRef] = useState('');
  const [paymentMode, setPaymentMode] = useState('cash');
  
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: string } | null>(null);
  const [selectedTxn, setSelectedTxn] = useState<UnifiedTransaction | null>(null);

  const showToast = (message: string, type = 'success') => { setToast({ message, type }); setTimeout(() => setToast(null), 3500); };

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/accounts/transactions?filter=${activeTab}`);
      const data = await res.json();
      if (data.success) {
        setTransactions(data.data.transactions);
      }
    } catch (err) { 
      console.error(err); 
    } finally { 
      setLoading(false); 
    }
  }, [activeTab]);

  useEffect(() => { 
    if (view === 'list') {
      fetchTransactions(); 
    }
  }, [fetchTransactions, view]);

  const handleSubmit = async () => {
    if (!entryCategory || !entryAmount) {
      showToast('Category and Amount are required', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        date: formDate,
        type: entryType,
        source: 'manual',
        amount: Number(entryAmount),
        paymentMode,
        category: entryCategory,
        description: entryDesc,
        referenceNumber: entryRef
      };

      const res = await fetch('/api/accounts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) { 
        showToast('Manual entry submitted successfully'); 
        setView('list'); 
        setEntryCategory('');
        setEntryDesc('');
        setEntryAmount('');
        setEntryRef('');
      } else {
        showToast(data.message, 'error');
      }
    } catch { 
      showToast('Network error', 'error'); 
    } finally { 
      setSaving(false); 
    }
  };

  const fmt = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

  const getIconForType = (type: string) => {
    switch(type) {
      case 'booking': return <Calendar size={18} />;
      case 'sale': return <ShoppingCart size={18} />;
      case 'restock': return <Package size={18} />;
      case 'manual': return <FileText size={18} />;
      default: return <Wallet size={18} />;
    }
  };

  const getBadgeClass = (type: string) => {
    switch(type) {
      case 'booking': return 'badge-info';
      case 'sale': return 'badge-success';
      case 'restock': return 'badge-warning';
      case 'manual': return 'badge-primary';
      default: return 'badge-secondary';
    }
  };

  return (
    <div className="page-container">
      {toast && <div className="toast-container"><div className={`toast toast-${toast.type === 'error' ? 'error' : 'success'}`}><span className="toast-icon">{toast.type === 'error' ? '✕' : '✓'}</span><div className="toast-content"><div className="toast-title">{toast.message}</div></div></div></div>}

      <div className="page-header">
        <div>
          <h1>Accounts</h1>
          <p className="page-subtitle">Centralized tracking system for Bookings, Sales, Inventory, and Manual Entries</p>
        </div>
        {view === 'list' && (
          <button className="btn btn-primary btn-md" onClick={() => setView('form')}>
            <Plus size={18} /> New Manual Entry
          </button>
        )}
        {view === 'form' && (
          <button className="btn btn-secondary btn-md" onClick={() => setView('list')}>
            ← Back to List
          </button>
        )}
      </div>

      {view === 'list' && (
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-6)', borderBottom: '1px solid var(--surface-glass-border)', paddingBottom: 'var(--space-2)' }}>
          <button className={`btn ${activeTab === 'all' ? 'btn-primary' : 'btn-ghost'} btn-sm`} onClick={() => setActiveTab('all')}>All Transactions</button>
          <button className={`btn ${activeTab === 'bookings' ? 'btn-primary' : 'btn-ghost'} btn-sm`} onClick={() => setActiveTab('bookings')}>Bookings</button>
          <button className={`btn ${activeTab === 'sales' ? 'btn-primary' : 'btn-ghost'} btn-sm`} onClick={() => setActiveTab('sales')}>Sales</button>
          <button className={`btn ${activeTab === 'manual' ? 'btn-primary' : 'btn-ghost'} btn-sm`} onClick={() => setActiveTab('manual')}>Manual</button>
        </div>
      )}

      {view === 'form' ? (
        <div className="card" style={{ maxWidth: '600px', margin: '0 auto' }}>
          <div className="card-header">
            <h3>Record Manual Entry</h3>
          </div>
          <div className="card-body">
            <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
              <label className="form-label required">Date</label>
              <CustomDatePicker value={formDate} onChange={(val) => setFormDate(val)} />
            </div>

            <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
              <label className="form-label required">Entry Type</label>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <button className={`btn ${entryType === 'income' ? 'btn-primary' : 'btn-ghost'} btn-sm`} onClick={() => { setEntryType('income'); setEntryCategory(''); }}>Income</button>
                <button className={`btn ${entryType === 'expenses' ? 'btn-danger' : 'btn-ghost'} btn-sm`} onClick={() => { setEntryType('expenses'); setEntryCategory(''); }}>Expense</button>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
              <label className="form-label required">Category</label>
              <input 
                className="form-input" 
                placeholder="e.g. Turf Booking, Maintenance" 
                value={entryCategory} 
                onChange={(e) => setEntryCategory(e.target.value)} 
              />
            </div>

            <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
              <label className="form-label required">Amount (₹)</label>
              <input className="form-input" type="number" min="0" placeholder="e.g. 500" value={entryAmount} onChange={(e) => setEntryAmount(e.target.value ? Number(e.target.value) : '')} />
            </div>

            <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
              <label className="form-label required">Payment Mode</label>
              <CustomSelect
                options={[
                  { value: 'cash', label: 'Cash' },
                  { value: 'upi', label: 'UPI' },
                  { value: 'bank_transfer', label: 'Bank Transfer' },
                  { value: 'card', label: 'Card' },
                  { value: 'other', label: 'Other' }
                ]}
                value={paymentMode}
                onChange={setPaymentMode}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
              <label className="form-label">Description</label>
              <input className="form-input" placeholder="Optional details..." value={entryDesc} onChange={(e) => setEntryDesc(e.target.value)} />
            </div>

            <div className="form-group" style={{ marginBottom: 'var(--space-6)' }}>
              <label className="form-label">Reference #</label>
              <input className="form-input" placeholder="Bill no, UTR, etc." value={entryRef} onChange={(e) => setEntryRef(e.target.value)} />
            </div>

            <button className={`btn btn-primary btn-lg ${saving ? 'btn-loading' : ''}`} style={{ width: '100%' }} onClick={handleSubmit} disabled={saving}>
              Submit Entry
            </button>
          </div>
        </div>
      ) : loading ? (
        <div className="loading-screen"><div className="spinner spinner-lg" /><div className="loading-text">Loading transactions...</div></div>
      ) : transactions.length === 0 ? (
        <div className="card"><div className="empty-state"><div className="empty-state-icon"><Wallet size={48} /></div><div className="empty-state-title">No transactions found</div><div className="empty-state-description">There are no transactions for this filter yet.</div></div></div>
      ) : (
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Customer / Supplier</th>
                <th>Summary</th>
                <th>Amount</th>
                <th>Processed By</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t._id} onClick={() => setSelectedTxn(t)} style={{ cursor: 'pointer' }} className="hover-row">
                  <td style={{ fontWeight: 500 }}>{new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                  <td>
                    <span className={`badge ${getBadgeClass(t.type)} badge-dot`} style={{ display: 'inline-flex', gap: '4px', alignItems: 'center' }}>
                      {getIconForType(t.type)} <span style={{ textTransform: 'capitalize' }}>{t.type}</span>
                    </span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t.customerName || '—'}</div>
                    {t.customerContact && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{t.customerContact}</div>}
                  </td>
                  <td style={{ color: 'var(--text-secondary)', maxWidth: '250px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.summary}</td>
                  <td style={{ fontWeight: 700, color: t.type === 'restock' ? 'var(--status-warning)' : t.type === 'manual' && t.amount < 0 ? 'var(--status-danger)' : 'var(--status-success)' }}>
                    {t.type === 'restock' ? '-' : t.type === 'manual' && t.amount < 0 ? '' : '+'}{fmt(Math.abs(t.amount))}
                  </td>
                  <td>
                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>{t.user?.name || 'System'}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                      {t.user?.position || t.user?.portal || 'Unknown'}
                    </div>
                  </td>
                  <td>
                    <button className="btn btn-ghost btn-sm btn-icon"><ChevronRight size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedTxn && (
        <div className="modal-backdrop" onClick={() => setSelectedTxn(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'capitalize' }}>
                {getIconForType(selectedTxn.type)} {selectedTxn.type} Details
              </h3>
              <button className="modal-close" onClick={() => setSelectedTxn(null)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-4)', background: 'var(--surface-secondary)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Transaction Amount</div>
                  <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: selectedTxn.type === 'restock' ? 'var(--status-warning)' : 'var(--status-success)' }}>
                    {selectedTxn.type === 'restock' ? '-' : '+'}{fmt(Math.abs(selectedTxn.amount))}
                  </div>
                </div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>{selectedTxn.summary}</div>
              </div>

              <div className="form-grid-2" style={{ gap: 'var(--space-4)' }}>
                <div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: '4px' }}>Date</div>
                  <div style={{ fontWeight: 500 }}>{new Date(selectedTxn.date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</div>
                </div>
                <div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: '4px' }}>Processed By</div>
                  <div style={{ fontWeight: 500 }}>{selectedTxn.user?.name || 'System'}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{selectedTxn.user?.position || selectedTxn.user?.portal}</div>
                </div>
                <div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: '4px' }}>{selectedTxn.type === 'restock' ? 'Supplier' : 'Customer Name'}</div>
                  <div style={{ fontWeight: 500 }}>{selectedTxn.customerName || '—'}</div>
                </div>
                {selectedTxn.customerContact && (
                  <div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: '4px' }}>Customer Contact</div>
                    <div style={{ fontWeight: 500 }}>{selectedTxn.customerContact}</div>
                  </div>
                )}
              </div>

              {selectedTxn.type === 'manual' && selectedTxn.details && (
                <div style={{ marginTop: 'var(--space-4)' }}>
                  <h4 style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--space-2)' }}>Breakdown</h4>
                  {['income', 'expenses', 'electricity', 'otherPayments'].map(cat => {
                    const items = selectedTxn.details[cat] || [];
                    if (items.length === 0) return null;
                    return (
                      <div key={cat} style={{ marginBottom: 'var(--space-2)' }}>
                        <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '4px' }}>{cat}</div>
                        {items.map((item: any, i: number) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-2)', background: 'var(--surface-primary)', border: '1px solid var(--surface-glass-border)', borderRadius: 'var(--radius-sm)', marginBottom: '4px' }}>
                            <div>
                              <div style={{ fontWeight: 500, fontSize: 'var(--text-sm)' }}>{item.category}</div>
                              {item.description && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{item.description}</div>}
                            </div>
                            <div style={{ fontWeight: 600 }}>{fmt(item.amount)}</div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-md" onClick={() => setSelectedTxn(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
