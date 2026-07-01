'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { CustomDatePicker } from '@/components/ui/CustomDatePicker';
import { CustomAutocomplete } from '@/components/ui/CustomAutocomplete';
import { Wallet, Package, ShoppingCart, Calendar, FileText, Plus, X, ChevronRight, Receipt, Wrench } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<'all' | 'bookings' | 'sales' | 'inventory' | 'manual' | 'expenses' | 'separate-report' | 'analytics'>('analytics');
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
      const fetchFilter = ['separate-report', 'expenses'].includes(activeTab) ? 'all' : activeTab;
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

    if (activeTab === 'expenses') {
      filtered = filtered.filter(t => t.amount < 0 || t.type === 'restock');
    }

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
      logoBase64,
      action: 'print'
    });
  };

  const fmt = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

  const getIconForType = (type: string) => {
    switch(type) {
      case 'booking': return <Calendar size={18} />;
      case 'sale': return <ShoppingCart size={18} />;
      case 'restock': return <Package size={18} />;
      case 'manual': return <FileText size={18} />;
      case 'maintenance': return <Wrench size={18} />;
      default: return <Wallet size={18} />;
    }
  };

  const getBadgeClass = (type: string) => {
    switch(type) {
      case 'booking': return 'badge-info';
      case 'sale': return 'badge-success';
      case 'restock': return 'badge-warning';
      case 'manual': return 'badge-primary';
      case 'maintenance': return 'badge-danger';
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
        {view === 'list' && activeTab !== 'analytics' && (
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {canExportReports && !['separate-report'].includes(activeTab) && (
              <>
                <button className="btn btn-secondary btn-md" onClick={exportToPDF} title="Export PDF">
                  <FileText size={18} /> <span className="hide-on-mobile">Export PDF</span>
                </button>
                <button className="btn btn-secondary btn-md" onClick={exportToExcel} title="Export Excel">
                  <Receipt size={18} /> <span className="hide-on-mobile">Export Excel</span>
                </button>
              </>
            )}
            {canSubmitEntry && (
              <button className="btn btn-primary btn-md" onClick={() => setView('form')}>
                <Plus size={18} /> <span className="hide-on-mobile">New Manual Entry</span><span className="show-on-mobile">New Entry</span>
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
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-4)', borderBottom: '1px solid var(--surface-glass-border)', paddingBottom: 'var(--space-4)', alignItems: 'center' }}>
          <button className={`btn ${activeTab === 'analytics' ? 'btn-primary' : 'btn-ghost'} btn-sm`} onClick={() => setActiveTab('analytics')}>Analytics Dashboard</button>
          <button className={`btn ${activeTab === 'all' ? 'btn-primary' : 'btn-ghost'} btn-sm`} onClick={() => setActiveTab('all')}>All Transactions</button>
        </div>
      )}

      {view === 'list' && activeTab !== 'analytics' && (
        <div className="card filter-card" style={{ marginBottom: 'var(--space-4)' }}>
          <div className="card-body" style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="form-group filter-order-1" style={{ flex: '1 1 150px' }}>
              <label className="form-label">View Type</label>
              <CustomSelect
                options={[
                  { value: 'all', label: 'All Transactions' },
                  { value: 'bookings', label: 'Bookings' },
                  { value: 'sales', label: 'Sales' },
                  { value: 'manual', label: 'Manual' },
                  { value: 'expenses', label: 'Expenses' },
                  { value: 'separate-report', label: 'Separate Report' }
                ]}
                value={activeTab}
                onChange={(val) => setActiveTab(val as any)}
              />
            </div>
            <div className="form-group filter-order-2" style={{ flex: '1 1 200px' }}>
              <label className="form-label">Search Customer</label>
              <CustomAutocomplete
                options={uniqueCustomers}
                value={customerSearch}
                onChange={setCustomerSearch}
                onSelect={setSelectedCustomer}
                placeholder="Search by name or number..."
              />
            </div>
            <div className="form-group filter-order-3" style={{ flex: '1 1 150px' }}>
              <label className="form-label">Payment Status</label>
              <CustomSelect
                options={[
                  { value: 'all', label: 'All Statuses' },
                  { value: 'pending', label: 'Pending' },
                  { value: 'partial', label: 'Partial' },
                  { value: 'paid', label: 'Paid' }
                ]}
                value={statusFilter}
                onChange={setStatusFilter}
              />
            </div>
            <div className="form-group filter-order-4" style={{ flex: '1 1 150px' }}>
              <label className="form-label">Date Range</label>
              <CustomSelect
                options={[
                  { value: 'all', label: 'All Time' },
                  { value: 'today', label: 'Today' },
                  { value: 'yesterday', label: 'Yesterday' },
                  { value: 'last7', label: 'Last 7 Days' },
                  { value: 'last30', label: 'Last 30 Days' },
                  { value: 'custom', label: 'Custom Range' }
                ]}
                value={exportDateRange}
                onChange={setExportDateRange}
              />
            </div>
            {exportDateRange === 'custom' && (
              <>
                <div className="form-group filter-order-5" style={{ flex: '1 1 140px' }}>
                  <label className="form-label">From Date</label>
                  <CustomDatePicker value={exportFromDate} onChange={setExportFromDate} placeholder="Any date" />
                </div>
                <div className="form-group filter-order-6" style={{ flex: '1 1 140px' }}>
                  <label className="form-label">To Date</label>
                  <CustomDatePicker value={exportToDate} onChange={setExportToDate} placeholder="Any date" />
                </div>
              </>
            )}
          </div>
          {selectedBills.size > 0 && activeTab !== 'separate-report' && (
            <div className="card-footer" style={{ justifyContent: 'flex-start', background: 'var(--surface-secondary)' }}>
              <button 
                className="btn btn-primary btn-sm"
                onClick={async () => {
                  const selectedData = filteredTransactions.filter(t => selectedBills.has(t._id));
                  if (selectedData.length > 0) {
                    let signatureBase64 = '';
                    let qrBase64 = '';
                    let bankName = '';
                    let bankAccount = '';
                    let bankIfsc = '';
                    let bankHolder = '';
                    try {
                      const settingsRes = await fetch('/api/settings').then(r => r.json());
                      if (settingsRes.success && settingsRes.data) {
                        const sigSetting = settingsRes.data.find((s: any) => s.key === 'invoice_signature');
                        if (sigSetting && sigSetting.value) signatureBase64 = sigSetting.value;
                        const qrSetting = settingsRes.data.find((s: any) => s.key === 'invoice_qr_code');
                        if (qrSetting && qrSetting.value) qrBase64 = qrSetting.value;
                        const bnSetting = settingsRes.data.find((s: any) => s.key === 'invoice_bank_name');
                        if (bnSetting && bnSetting.value) bankName = bnSetting.value;
                        const baSetting = settingsRes.data.find((s: any) => s.key === 'invoice_account_no');
                        if (baSetting && baSetting.value) bankAccount = baSetting.value;
                        const biSetting = settingsRes.data.find((s: any) => s.key === 'invoice_ifsc_code');
                        if (biSetting && biSetting.value) bankIfsc = biSetting.value;
                        const bhSetting = settingsRes.data.find((s: any) => s.key === 'invoice_account_holder');
                        if (bhSetting && bhSetting.value) bankHolder = bhSetting.value;
                      }
                    } catch (e) {
                      console.warn('Failed to fetch settings for PDF', e);
                    }
                    const { generateConsolidatedReport } = await import('@/lib/invoice-generator');
                    generateConsolidatedReport(selectedData, signatureBase64, qrBase64, bankName, bankAccount, bankIfsc, bankHolder);
                  }
                }}
              >
                <FileText size={16} style={{ marginRight: '4px' }}/> Generate Bill ({selectedBills.size})
              </button>
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
          <div className="data-table-wrapper accounts-manage-table-wrapper">
            <table className="data-table accounts-manage-table">
              <thead>
                <tr>
                  <th className="col-checkbox" style={{ width: '24px', textAlign: 'center' }}>
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
                  <th className="hide-on-mobile">Date</th>
                  <th className="hide-on-mobile">Type</th>
                  <th className="show-on-mobile-cell col-details">Details</th>
                  <th className="col-customer">Customer / Supplier</th>
                  <th className="hide-on-mobile">Summary</th>
                  <th className="col-amount">Amount</th>
                  <th className="show-on-mobile-cell col-user">User</th>
                  <th className="hide-on-mobile">Processed By</th>
                  <th className="hide-on-mobile">Received By</th>
                  <th className="col-action" style={{ width: '32px' }}></th>
                </tr>
              </thead>
              <tbody>
                {paginatedTransactions.map((t) => (
                  <tr key={t._id} className="hover-row">
                    <td className="col-checkbox" style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
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
                    <td className="hide-on-mobile" onClick={() => setSelectedTxn(t)} style={{ cursor: 'pointer', fontWeight: 500 }}>{new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    <td className="hide-on-mobile" onClick={() => setSelectedTxn(t)} style={{ cursor: 'pointer' }}>
                      <span className={`badge ${getBadgeClass(t.type)} badge-dot`} style={{ display: 'inline-flex', gap: '4px', alignItems: 'center' }}>
                        {getIconForType(t.type)} <span style={{ textTransform: 'capitalize' }}>{t.type}</span>
                      </span>
                    </td>
                    <td className="show-on-mobile-cell col-details" onClick={() => setSelectedTxn(t)} style={{ cursor: 'pointer' }}>
                      <div style={{ fontWeight: 600, fontSize: '11px' }}>{new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>
                      <div style={{ marginTop: '2px', display: 'flex', gap: '2px', flexDirection: 'column' }}>
                        <div>
                          <span className={`badge ${getBadgeClass(t.type)}`} style={{ fontSize: '8px', padding: '1px 4px', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                            <span style={{ textTransform: 'capitalize' }}>{t.type}</span>
                          </span>
                        </div>
                        <div style={{ fontSize: '9px', color: 'var(--text-secondary)', maxWidth: '100px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {t.summary}
                        </div>
                      </div>
                    </td>
                    <td className="col-customer" onClick={() => setSelectedTxn(t)} style={{ cursor: 'pointer' }}>
                      <div style={{ fontWeight: 600, fontSize: '11px', color: 'var(--text-primary)' }}>{t.customerName || '—'}</div>
                      {t.customerContact && <div style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>{t.customerContact}</div>}
                    </td>
                    <td className="hide-on-mobile" onClick={() => setSelectedTxn(t)} style={{ cursor: 'pointer', color: 'var(--text-secondary)', maxWidth: '250px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.summary}</td>
                    <td className="col-amount" onClick={() => setSelectedTxn(t)} style={{ cursor: 'pointer', fontWeight: 700, fontSize: '11px', color: t.type === 'restock' ? 'var(--status-warning)' : t.amount < 0 ? 'var(--status-danger)' : 'var(--status-success)' }}>
                      {t.type === 'restock' ? '-' : t.amount < 0 ? '-' : '+'}{fmt(Math.abs(t.amount))}
                    </td>
                    <td className="show-on-mobile-cell col-user" onClick={() => setSelectedTxn(t)} style={{ cursor: 'pointer' }}>
                      <div style={{ fontSize: '9px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column' }}>
                        {t.user?.name && <span>By: {t.user.name}</span>}
                        {t.receivedUser?.name && <span>Rx: {t.receivedUser.name}</span>}
                      </div>
                    </td>
                    <td className="hide-on-mobile" onClick={() => setSelectedTxn(t)} style={{ cursor: 'pointer' }}>
                      <div style={{ fontWeight: 600 }}>{t.user?.name || 'Admin'}</div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{t.user?.position || 'Super Admin'}</div>
                    </td>
                    <td className="hide-on-mobile" onClick={() => setSelectedTxn(t)} style={{ cursor: 'pointer' }}>
                      <div style={{ fontWeight: 600 }}>{t.receivedUser?.name || '—'}</div>
                      {t.receivedUser?.portal && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{t.receivedUser.portal}</div>}
                    </td>
                    <td className="col-action" onClick={() => setSelectedTxn(t)} style={{ cursor: 'pointer', textAlign: 'right' }}>
                      <ChevronRight size={16} color="var(--text-muted)" />
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
                <CustomSelect 
                  options={[
                    { value: '10', label: '10' },
                    { value: '25', label: '25' },
                    { value: '50', label: '50' },
                    { value: '100', label: '100' }
                  ]}
                  value={pageSize.toString()}
                  onChange={(val) => { setPageSize(Number(val)); setCurrentPage(1); }}
                  style={{ minWidth: '70px', height: '32px' }}
                  searchable={false}
                />
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
                  <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: selectedTxn.type === 'restock' ? 'var(--status-warning)' : selectedTxn.amount < 0 ? 'var(--status-danger)' : 'var(--status-success)' }}>
                    {selectedTxn.amount < 0 ? '-' : selectedTxn.type === 'restock' ? '-' : '+'}{fmt(Math.abs(selectedTxn.amount))}
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
