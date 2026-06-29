'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { CustomDatePicker } from '@/components/ui/CustomDatePicker';
import { CustomAutocomplete } from '@/components/ui/CustomAutocomplete';
import { Wallet, Package, ShoppingCart, Calendar, FileText, Plus, X, ChevronRight, Receipt } from 'lucide-react';
import { usePermissions } from '@/components/providers/PermissionsProvider';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import { useScreenshotBlocker } from '@/hooks/useScreenshotBlocker';
import SeparateReportView from './SeparateReportView';
import AnalyticsDashboard from './AnalyticsDashboard';

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
    portal?: string;
    position?: string;
  };
  receivedUser?: {
    name: string;
    portal?: string;
    position?: string;
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
  const { isBlurred } = useScreenshotBlocker();
  const [transactions, setTransactions] = useState<UnifiedTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'bookings' | 'sales' | 'inventory' | 'manual' | 'separate-report' | 'analytics'>('analytics');
  const [view, setView] = useState<'list' | 'form'>('list');
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  
  // Manual Entry Form State
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [entryType, setEntryType] = useState<'income' | 'expenses'>('income');
  const [entryCategory, setEntryCategory] = useState('');
  const [entryDesc, setEntryDesc] = useState('');
  const [entryAmount, setEntryAmount] = useState<number | ''>('');
  const [entryRef, setEntryRef] = useState('');
  const [paymentMode, setPaymentMode] = useState('cash');
  
  const [saving, setSaving] = useState(false);

  // Filter State
  const [exportDateRange, setExportDateRange] = useState('all');
  const [exportFromDate, setExportFromDate] = useState('');
  const [exportToDate, setExportToDate] = useState('');
  const [receivedByFilter, setReceivedByFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [toast, setToast] = useState<{ message: string; type: string } | null>(null);
  const [selectedTxn, setSelectedTxn] = useState<UnifiedTransaction | null>(null);

  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<{ name: string; contact?: string } | null>(null);
  const [selectedBills, setSelectedBills] = useState<Set<string>>(new Set());

  const { checkPermission } = usePermissions();
  const canSubmitEntry = checkPermission('accounts_finance', 'add_transaction');
  const canExportReports = checkPermission('accounts_finance', 'export_reports');

  const showToast = (message: string, type = 'success') => { setToast({ message, type }); setTimeout(() => setToast(null), 3500); };

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const fetchFilter = activeTab === 'separate-report' ? 'all' : activeTab;
      const res = await fetch(`/api/accounts/transactions?filter=${fetchFilter}`);
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

  // Reset pagination on filter or tab change
  useEffect(() => {
    setCurrentPage(1);
    setSelectedBills(new Set());
  }, [exportDateRange, exportFromDate, exportToDate, receivedByFilter, statusFilter, customerSearch, selectedCustomer, activeTab]);

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

  const uniqueCustomers = useMemo(() => {
    const map = new Map<string, { name: string; contact?: string }>();
    transactions.forEach(t => {
      if (t.customerName) {
        const key = `${t.customerName.toLowerCase()}_${(t.customerContact || '').toLowerCase()}`;
        if (!map.has(key)) {
          map.set(key, {
            name: t.customerName,
            contact: t.customerContact || undefined
          });
        }
      }
    });
    return Array.from(map.values());
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    let filtered = [...transactions];
    
    if (receivedByFilter !== 'all') {
      filtered = filtered.filter(t => t.receivedUser?.name === receivedByFilter);
    }
    
    if (statusFilter !== 'all') {
      filtered = filtered.filter(t => {
        if (t.type === 'booking') {
          return t.details?.bookingId?.paymentStatus === statusFilter;
        }
        return statusFilter === 'paid';
      });
    }

    if (selectedCustomer) {
      filtered = filtered.filter(t => 
        (t.customerName || '').toLowerCase() === selectedCustomer.name.toLowerCase() &&
        (t.customerContact || '').toLowerCase() === (selectedCustomer.contact || '').toLowerCase()
      );
    } else if (customerSearch.trim()) {
      const q = customerSearch.toLowerCase();
      const exactMatchExists = transactions.some(t => t.customerName?.toLowerCase() === q);
      if (exactMatchExists) {
        filtered = filtered.filter(t => t.customerName?.toLowerCase() === q);
      } else {
        filtered = filtered.filter(t => t.customerName?.toLowerCase().includes(q) || t.customerContact?.toLowerCase().includes(q));
      }
    }

    const now = new Date();
    
    if (exportDateRange === 'today') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      filtered = filtered.filter(t => new Date(t.date) >= start);
    } else if (exportDateRange === 'yesterday') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      end.setMilliseconds(-1);
      filtered = filtered.filter(t => {
        const d = new Date(t.date);
        return d >= start && d <= end;
      });
    } else if (exportDateRange === 'last7') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
      filtered = filtered.filter(t => new Date(t.date) >= start);
    } else if (exportDateRange === 'last30') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
      filtered = filtered.filter(t => new Date(t.date) >= start);
    } else if (exportDateRange === 'custom') {
      if (exportFromDate) {
        const start = new Date(exportFromDate);
        filtered = filtered.filter(t => new Date(t.date) >= start);
      }
      if (exportToDate) {
        const end = new Date(exportToDate);
        end.setHours(23, 59, 59, 999);
        filtered = filtered.filter(t => new Date(t.date) <= end);
      }
    }
    return filtered;
  }, [transactions, exportDateRange, exportFromDate, exportToDate, receivedByFilter, statusFilter, customerSearch, selectedCustomer]);

  const totalPages = Math.ceil(filteredTransactions.length / pageSize);
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTransactions.slice(start, start + pageSize);
  }, [filteredTransactions, currentPage, pageSize]);

  const exportToExcel = () => {
    const dataToExport = filteredTransactions;
    if (!dataToExport.length) return showToast('No transactions in selected date range', 'error');
    
    const exportData = dataToExport.map(t => {
      return {
        'Date': new Date(t.date).toLocaleDateString('en-IN'),
        'Type': t.type.toUpperCase(),
        'Customer / Supplier': t.customerName || 'N/A',
        'Contact': t.customerContact || 'N/A',
        'Summary': t.summary,
        'Amount': t.amount,
        'Processed By': t.user?.name || 'Admin',
        'Received By': t.receivedUser?.name || '—',
        'Portal': t.user?.portal || 'System',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Transactions');
    XLSX.writeFile(workbook, `Finance_Export_${new Date().getTime()}.xlsx`);
  };

  const exportToPDF = async () => {
    const dataToExport = filteredTransactions;
    if (!dataToExport.length) return showToast('No transactions in selected date range', 'error');
    
    // Load logo
    let logoBase64 = '';
    try {
      const img = new window.Image();
      img.src = '/logo.png';
      await new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
      });
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        logoBase64 = canvas.toDataURL('image/png');
      }
    } catch (e) {
      console.warn('Could not load logo for PDF', e);
    }

    const { generateStandardReport } = await import('@/lib/report-generator');

    const formatCurrency = (n: number) => 'Rs.' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n || 0);

    const totalBookings = dataToExport.filter(t => t.type === 'booking').reduce((sum, t) => sum + t.amount, 0);
    const totalSales = dataToExport.filter(t => t.type === 'sale').reduce((sum, t) => sum + t.amount, 0);
    const grandTotal = dataToExport.reduce((sum, t) => sum + t.amount, 0);

    let reportPeriodStr = 'All Time';
    if (exportDateRange !== 'all') {
       reportPeriodStr = exportDateRange === 'today' ? 'Today' : 
                         exportDateRange === 'yesterday' ? 'Yesterday' :
                         exportDateRange === 'last7' ? 'Last 7 Days' :
                         exportDateRange === 'last30' ? 'Last 30 Days' :
                         `${exportFromDate} to ${exportToDate}`;
    }

    generateStandardReport({
      title: 'Finance Transactions Report',
      reportPeriod: reportPeriodStr,
      summary: [
        { label: 'Total Booking Amount', value: formatCurrency(totalBookings) },
        { label: 'Total Sales Amount', value: formatCurrency(totalSales) },
        { label: 'Grand Total', value: formatCurrency(grandTotal) }
      ],
      columns: [
        { header: 'Date', dataKey: 'date' },
        { header: 'Type', dataKey: 'type' },
        { header: 'Customer / Supplier', dataKey: 'customer' },
        { header: 'Summary', dataKey: 'summary' },
        { header: 'Amount', dataKey: 'amount', align: 'right' },
        { header: 'Processed By', dataKey: 'processedBy' },
        { header: 'Received By', dataKey: 'receivedBy' }
      ],
      data: dataToExport.map(t => ({
        date: new Date(t.date).toLocaleDateString('en-IN'),
        type: t.type.toUpperCase(),
        customer: t.customerName || '—',
        summary: t.summary,
        amount: formatCurrency(Math.abs(t.amount)),
        processedBy: t.user?.name || 'Admin',
        receivedBy: t.receivedUser?.name || '—'
      })),
      filename: `Finance_Report_${new Date().getTime()}.pdf`,
      logoBase64
    });
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
    <>
      <style jsx global>{`
        @media print {
          .secure-finance-page {
            display: none !important;
          }
        }
      `}</style>
      <div className={`page-container secure-finance-page transition-all duration-200 ${isBlurred ? 'blur-md select-none' : ''}`}>
        {toast && <div className="toast-container"><div className={`toast toast-${toast.type === 'error' ? 'error' : 'success'}`}><span className="toast-icon">{toast.type === 'error' ? '✕' : '✓'}</span><div className="toast-content"><div className="toast-title">{toast.message}</div></div></div></div>}

      <div className="page-header">
        <div>
          <h1>Accounts</h1>
          <p className="page-subtitle">Centralized tracking system for Bookings, Sales, Inventory, and Manual Entries</p>
        </div>
        {view === 'list' && !['separate-report', 'analytics'].includes(activeTab) && (
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            {canExportReports && (
              <>
                <button className="btn btn-secondary btn-md" onClick={exportToPDF}>
                  <FileText size={18} /> Export PDF
                </button>
                <button className="btn btn-secondary btn-md" onClick={exportToExcel}>
                  <Receipt size={18} /> Export Excel
                </button>
              </>
            )}
            {canSubmitEntry && (
              <button className="btn btn-primary btn-md" onClick={() => setView('form')}>
                <Plus size={18} /> New Manual Entry
              </button>
            )}
          </div>
        )}
        {view === 'form' && (
          <button className="btn btn-secondary btn-md" onClick={() => setView('list')}>
            ← Back to List
          </button>
        )}
      </div>

      {view === 'list' && (
        <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-6)', borderBottom: '1px solid var(--surface-glass-border)', paddingBottom: 'var(--space-2)', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <button className={`btn ${activeTab === 'analytics' ? 'btn-primary' : 'btn-ghost'} btn-sm`} onClick={() => setActiveTab('analytics')}>Analytics Dashboard</button>
            <button className={`btn ${activeTab === 'all' ? 'btn-primary' : 'btn-ghost'} btn-sm`} onClick={() => setActiveTab('all')}>All Transactions</button>
            <button className={`btn ${activeTab === 'bookings' ? 'btn-primary' : 'btn-ghost'} btn-sm`} onClick={() => setActiveTab('bookings')}>Bookings</button>
            <button className={`btn ${activeTab === 'sales' ? 'btn-primary' : 'btn-ghost'} btn-sm`} onClick={() => setActiveTab('sales')}>Sales</button>
            <button className={`btn ${activeTab === 'manual' ? 'btn-primary' : 'btn-ghost'} btn-sm`} onClick={() => setActiveTab('manual')}>Manual</button>
            <button className={`btn ${activeTab === 'separate-report' ? 'btn-primary' : 'btn-ghost'} btn-sm`} onClick={() => setActiveTab('separate-report')}>Separate Report</button>
          </div>
          
          {activeTab !== 'analytics' && (
            <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end', marginLeft: 'auto' }}>
              <CustomAutocomplete
                options={uniqueCustomers}
                value={customerSearch}
                onChange={setCustomerSearch}
                onSelect={setSelectedCustomer}
                placeholder="Search Customer..."
                style={{ width: 'auto', minWidth: '220px' }}
              />
              {selectedBills.size > 0 && activeTab !== 'separate-report' && (
                <button 
                  className="btn btn-primary btn-sm"
                  onClick={async () => {
                    const selectedData = filteredTransactions.filter(t => selectedBills.has(t._id));
                    if (selectedData.length > 0) {
                      const { generateConsolidatedReport } = await import('@/lib/invoice-generator');
                      generateConsolidatedReport(selectedData);
                    }
                  }}
                  style={{ height: '36px' }}
                >
                  Generate Bill ({selectedBills.size})
                </button>
              )}
              <select 
              className="form-select" 
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ padding: '6px 12px', fontSize: '13px', height: '36px', minWidth: '120px', width: 'auto' }}
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="partial">Partial</option>
              <option value="paid">Paid</option>
            </select>
            <select 
              className="form-select" 
              value={receivedByFilter} 
              onChange={(e) => setReceivedByFilter(e.target.value)}
              style={{ padding: '6px 12px', fontSize: '13px', height: '36px', minWidth: '140px', width: 'auto' }}
            >
              <option value="all">All Receivers</option>
              {Array.from(new Set(transactions.map(t => t.receivedUser?.name).filter(Boolean))).map(name => (
                <option key={name as string} value={name as string}>{name}</option>
              ))}
            </select>
            <select 
              className="form-select" 
              value={exportDateRange} 
              onChange={(e) => setExportDateRange(e.target.value)}
              style={{ padding: '6px 12px', fontSize: '13px', height: '36px', minWidth: '140px', width: 'auto' }}
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="last7">Last 7 Days</option>
              <option value="last30">Last 30 Days</option>
              <option value="custom">Custom Range</option>
            </select>
            
            {exportDateRange === 'custom' && (
              <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                <input type="date" className="form-input" style={{ padding: '6px 12px', fontSize: '13px', height: '36px', width: '140px' }} value={exportFromDate} onChange={e => setExportFromDate(e.target.value)} />
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>to</span>
                <input type="date" className="form-input" style={{ padding: '6px 12px', fontSize: '13px', height: '36px', width: '140px' }} value={exportToDate} onChange={e => setExportToDate(e.target.value)} />
              </div>
            )}
          </div>
          )}
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
      ) : activeTab === 'separate-report' ? (
        <SeparateReportView 
          exportDateRange={exportDateRange} 
          exportFromDate={exportFromDate} 
          exportToDate={exportToDate} 
          statusFilter={statusFilter}
          showToast={showToast} 
          fmt={fmt} 
          selectedCustomer={selectedCustomer}
          customerSearch={customerSearch}
        />
      ) : activeTab === 'analytics' ? (
        <AnalyticsDashboard 
          showToast={showToast} 
          fmt={fmt} 
        />
      ) : loading ? (
        <div className="loading-screen"><div className="spinner spinner-lg" /><div className="loading-text">Loading transactions...</div></div>
      ) : filteredTransactions.length === 0 ? (
        <div className="card"><div className="empty-state"><div className="empty-state-icon"><Wallet size={48} /></div><div className="empty-state-title">No transactions found</div><div className="empty-state-description">There are no transactions for this filter yet.</div></div></div>
      ) : (
        <>
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '40px', textAlign: 'center' }}>
                    <input 
                      type="checkbox" 
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedBills(new Set(filteredTransactions.map(t => t._id)));
                        } else {
                          setSelectedBills(new Set());
                        }
                      }}
                      checked={filteredTransactions.length > 0 && selectedBills.size === filteredTransactions.length}
                    />
                  </th>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Customer / Supplier</th>
                  <th>Summary</th>
                  <th>Amount</th>
                  <th>Processed By</th>
                  <th>Received By</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {paginatedTransactions.map((t) => (
                  <tr key={t._id} className="hover-row">
                    <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="checkbox" 
                        checked={selectedBills.has(t._id)}
                        onChange={(e) => {
                          const newSet = new Set(selectedBills);
                          if (e.target.checked) newSet.add(t._id);
                          else newSet.delete(t._id);
                          setSelectedBills(newSet);
                        }}
                      />
                    </td>
                    <td onClick={() => setSelectedTxn(t)} style={{ cursor: 'pointer', fontWeight: 500 }}>{new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    <td onClick={() => setSelectedTxn(t)} style={{ cursor: 'pointer' }}>
                      <span className={`badge ${getBadgeClass(t.type)} badge-dot`} style={{ display: 'inline-flex', gap: '4px', alignItems: 'center' }}>
                        {getIconForType(t.type)} <span style={{ textTransform: 'capitalize' }}>{t.type}</span>
                      </span>
                    </td>
                    <td onClick={() => setSelectedTxn(t)} style={{ cursor: 'pointer' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t.customerName || '—'}</div>
                      {t.customerContact && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{t.customerContact}</div>}
                    </td>
                    <td onClick={() => setSelectedTxn(t)} style={{ cursor: 'pointer', color: 'var(--text-secondary)', maxWidth: '250px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.summary}</td>
                    <td onClick={() => setSelectedTxn(t)} style={{ cursor: 'pointer', fontWeight: 700, color: t.type === 'restock' ? 'var(--status-warning)' : t.type === 'manual' && t.amount < 0 ? 'var(--status-danger)' : 'var(--status-success)' }}>
                      {t.type === 'restock' ? '-' : t.type === 'manual' && t.amount < 0 ? '' : '+'}{fmt(Math.abs(t.amount))}
                    </td>
                    <td onClick={() => setSelectedTxn(t)} style={{ cursor: 'pointer' }}>
                      <div style={{ fontWeight: 600 }}>{t.user?.name || 'Admin'}</div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{t.user?.position || 'Super Admin'}</div>
                    </td>
                    <td onClick={() => setSelectedTxn(t)} style={{ cursor: 'pointer' }}>
                      <div style={{ fontWeight: 600 }}>{t.receivedUser?.name || '—'}</div>
                      {t.receivedUser?.portal && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{t.receivedUser.portal}</div>}
                    </td>
                    <td onClick={() => setSelectedTxn(t)} style={{ cursor: 'pointer', textAlign: 'right' }}>
                      <ChevronRight size={18} color="var(--text-muted)" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* PAGINATION CONTROLS */}
          {filteredTransactions.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-4)', borderTop: '1px solid var(--surface-glass-border)', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                Showing {Math.min((currentPage - 1) * pageSize + 1, filteredTransactions.length)} to {Math.min(currentPage * pageSize, filteredTransactions.length)} of {filteredTransactions.length} entries
              </div>
              
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Show:</span>
                <select 
                  className="form-select" 
                  value={pageSize} 
                  onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                  style={{ padding: '4px 8px', fontSize: '12px', height: '32px', width: 'auto', minWidth: '60px' }}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <button 
                  className="btn btn-ghost btn-sm" 
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  style={{ padding: '4px 8px', fontSize: '11px', height: '32px' }}
                >
                  Previous
                </button>
                
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => {
                  const isVisible = p === 1 || p === totalPages || (p >= currentPage - 1 && p <= currentPage + 1);
                  
                  if (!isVisible) {
                    if (p === 2 && currentPage > 3) return <span key={`dots-start`} style={{ padding: '0 4px', color: 'var(--text-secondary)' }}>...</span>;
                    if (p === totalPages - 1 && currentPage < totalPages - 2) return <span key={`dots-end`} style={{ padding: '0 4px', color: 'var(--text-secondary)' }}>...</span>;
                    return null;
                  }

                  return (
                    <button
                      key={p}
                      className={`btn ${currentPage === p ? 'btn-primary' : 'btn-ghost'} btn-sm`}
                      onClick={() => setCurrentPage(p)}
                      style={{ minWidth: '32px', padding: '4px', height: '32px', fontSize: '11px' }}
                    >
                      {p}
                    </button>
                  );
                })}

                <button 
                  className="btn btn-ghost btn-sm" 
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages || totalPages === 0}
                  style={{ padding: '4px 8px', fontSize: '11px', height: '32px' }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
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
                  <div style={{ fontWeight: 500 }}>{selectedTxn.user?.name || 'Admin'}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{selectedTxn.user?.position || selectedTxn.user?.portal || 'Super Admin'}</div>
                </div>
                {selectedTxn.receivedUser?.name && (
                  <div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: '4px' }}>Received By</div>
                    <div style={{ fontWeight: 500, color: 'var(--status-info)' }}>{selectedTxn.receivedUser.name}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Cash Receiver</div>
                  </div>
                )}
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

              {selectedTxn.type === 'booking' && selectedTxn.details?.bookingId?.products && selectedTxn.details.bookingId.products.length > 0 && (
                <div style={{ marginTop: 'var(--space-4)' }}>
                  <h4 style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--space-2)' }}>Inventory Purchases</h4>
                  {selectedTxn.details.bookingId.products.map((item: any, i: number) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-2)', background: 'var(--surface-primary)', border: '1px solid var(--surface-glass-border)', borderRadius: 'var(--radius-sm)', marginBottom: '4px' }}>
                      <div>
                        <div style={{ fontWeight: 500, fontSize: 'var(--text-sm)' }}>{item.name || item.itemId?.name} x {item.quantity}</div>
                      </div>
                      <div style={{ fontWeight: 600 }}>{fmt(item.price * item.quantity)}</div>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-2)', marginTop: '4px', fontWeight: 700 }}>
                    <div>Inventory Total</div>
                    <div>{fmt(selectedTxn.details.bookingId.productAmount || 0)}</div>
                  </div>
                </div>
              )}

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
    </>
  );
}
