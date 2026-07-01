'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { X, Check, Package, Banknote, Inbox, User as UserIcon, Download, FileText, FileSpreadsheet } from 'lucide-react';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { usePermissions } from '@/components/providers/PermissionsProvider';

interface Item { _id: string; name: string; unit: string; unitPrice?: number; currentStock: number; lowStockThreshold: number; }
interface Txn { 
  _id: string; 
  itemId: { _id: string; name: string } | null; 
  type: string; 
  quantity: number; 
  amount: number; 
  supplier: string; 
  customerName?: string;
  customerContact?: string;
  bookingId?: {
    _id: string;
    customerName: string;
    contactNumber: string;
    paymentStatus: 'pending' | 'partial' | 'paid';
    bookingStatus: 'confirmed' | 'cancelled';
    expectedAmount: number;
    totalPaid: number;
  } | null;
  date: string; 
  enteredBy: { name: string } | null; 
  receivedBy?: { name: string } | null;
  createdAt: string; 
}

export default function SalesPage() {
  const [activeTab, setActiveTab] = useState<'pos' | 'history'>('pos');
  const [items, setItems] = useState<Item[]>([]);
  const [transactions, setTransactions] = useState<Txn[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showTxn, setShowTxn] = useState<{ type: 'sale' | 'restock' } | null>(null);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [itemName, setItemName] = useState('');
  const [itemUnit, setItemUnit] = useState('pcs');
  const [itemUnitPrice, setItemUnitPrice] = useState(0);
  const [itemInitialStock, setItemInitialStock] = useState(0);
  const [itemThreshold, setItemThreshold] = useState(5);
  const [txnItemId, setTxnItemId] = useState('');
  const [txnQty, setTxnQty] = useState(1);
  const [txnAmount, setTxnAmount] = useState(0);
  const [txnSupplier, setTxnSupplier] = useState('');
  const [txnCustomerName, setTxnCustomerName] = useState('');
  const [txnCustomerContact, setTxnCustomerContact] = useState('');
  const [txnReceivedBy, setTxnReceivedBy] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: string } | null>(null);
  const showToast = (m: string, t = 'success') => { setToast({ message: m, type: t }); setTimeout(() => setToast(null), 3500); };

  // Pagination State for Sales Management Log
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Filter State for Sales Management Log
  const [exportDateRange, setExportDateRange] = useState('all');
  const [exportFromDate, setExportFromDate] = useState('');
  const [exportToDate, setExportToDate] = useState('');

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [exportDateRange, exportFromDate, exportToDate]);

  const { checkPermission } = usePermissions();
  const canAddItem = checkPermission('inventory_sales', 'add_item');
  const canLogSale = checkPermission('inventory_sales', 'create_sale');
  const canRestock = true; // FORCE TRUE for testing
  const canDelete = true; // FORCE TRUE for testing
  const canExport = checkPermission('inventory_sales', 'export_sales_report');
  const canViewHistory = checkPermission('inventory_sales', 'view_sales_history');

  const fetchData = useCallback(async () => {
    try { 
      const res = await fetch('/api/inventory'); 
      const d = await res.json(); 
      if (d.success) { 
        setItems(d.data.items); 
        setTransactions(d.data.recentTransactions); 
      } 
      
      const usersRes = await fetch('/api/users');
      const usersJson = await usersRes.json();
      if (usersJson.success && usersJson.data?.users) {
        setUsers(usersJson.data.users);
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getSaleAmount = (itemId: string, quantity: number) => {
    const item = items.find((entry) => entry._id === itemId);
    return Number(((item?.unitPrice || 0) * quantity).toFixed(2));
  };

  const openTxn = (type: 'sale' | 'restock', itemId?: string) => {
    const firstItemId = itemId || items[0]?._id || '';
    setShowTxn({ type });
    setSelectedItem(null);
    setTxnItemId(firstItemId);
    setTxnQty(1);
    setTxnAmount(type === 'sale' ? getSaleAmount(firstItemId, 1) : 0);
    setTxnSupplier('');
    setTxnCustomerName('');
    setTxnCustomerContact('');
    setTxnReceivedBy('');
  };

  const updateTxnQty = (quantity: number) => {
    const nextQty = Math.max(1, quantity);
    setTxnQty(nextQty);
    if (showTxn?.type === 'sale') setTxnAmount(getSaleAmount(txnItemId, nextQty));
  };

  const handleAddItem = async () => {
    if (!itemName.trim()) return;
    setSaving(true);
    try { const res = await fetch('/api/inventory', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'add-item', name: itemName, unit: itemUnit, unitPrice: itemUnitPrice, initialStock: itemInitialStock, lowStockThreshold: itemThreshold }) }); const d = await res.json(); if (d.success) { showToast('Item added'); setShowAddItem(false); setItemName(''); setItemUnitPrice(0); setItemInitialStock(0); fetchData(); } else showToast(d.message, 'error'); } catch { showToast('Error', 'error'); } finally { setSaving(false); }
  };

  const handleTxn = async () => {
    if (!txnItemId || txnQty < 1) return;
    setSaving(true);
    const act = showTxn?.type === 'sale' ? 'log-sale' : 'add-restock';
    const amount = showTxn?.type === 'sale' ? getSaleAmount(txnItemId, txnQty) : txnAmount;
    try { const res = await fetch('/api/inventory', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: act, itemId: txnItemId, quantity: txnQty, amount, supplier: txnSupplier, customerName: txnCustomerName, customerContact: txnCustomerContact, receivedBy: txnReceivedBy }) }); const d = await res.json(); if (d.success) { showToast(d.message); setShowTxn(null); setTxnQty(1); setTxnAmount(0); setTxnSupplier(''); setTxnCustomerName(''); setTxnCustomerContact(''); setTxnReceivedBy(''); fetchData(); } else showToast(d.message, 'error'); } catch { showToast('Error', 'error'); } finally { setSaving(false); }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    setSaving(true);
    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete-item', itemId })
      });
      const d = await res.json();
      if (d.success) { showToast('Item deleted'); setSelectedItem(null); fetchData(); } else showToast(d.message, 'error');
    } catch { showToast('Error', 'error'); } finally { setSaving(false); }
  };

  // Filter & Export logic for Transactions
  const filteredTransactions = useMemo(() => {
    let filtered = [...transactions];
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
  }, [transactions, exportDateRange, exportFromDate, exportToDate]);

  const totalPages = Math.ceil(filteredTransactions.length / pageSize);
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTransactions.slice(start, start + pageSize);
  }, [filteredTransactions, currentPage, pageSize]);

  const exportToExcel = () => {
    if (!filteredTransactions.length) return showToast('No transactions to export', 'error');
    const ws = XLSX.utils.json_to_sheet(filteredTransactions.map(t => {
      const customer = t.bookingId ? t.bookingId.customerName : (t.customerName || t.supplier || 'Walk-in');
      let paymentStatusText = 'Paid';
      if (t.type === 'restock') paymentStatusText = '—';
      else if (t.bookingId) {
        const status = t.bookingId.paymentStatus || 'pending';
        paymentStatusText = status === 'paid' ? 'Paid (Booking)' : status === 'partial' ? 'Partially Paid' : 'Pending (Booking)';
      } else {
        paymentStatusText = 'Paid (Direct)';
      }
      let paymentDetails = 'Direct Sale';
      if (t.type === 'restock') paymentDetails = t.supplier || 'Restock';
      else if (t.bookingId) paymentDetails = `Booking ID: #${t.bookingId._id ? t.bookingId._id.substring(t.bookingId._id.length - 6).toUpperCase() : ''}`;

      return {
        Item: t.itemId?.name || '—',
        Date: new Date(t.date).toLocaleDateString('en-IN'),
        Customer: customer,
        Type: t.type === 'sale' ? 'Sale' : 'Restock',
        Quantity: t.quantity,
        Amount: t.amount,
        'Payment Status': paymentStatusText,
        'Payment Details': paymentDetails,
        EnteredBy: t.enteredBy?.name || '—'
      };
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sales Log");
    XLSX.writeFile(wb, `Sales_Log_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportToPDF = async () => {
    if (!filteredTransactions.length) return showToast('No transactions to export', 'error');
    
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

    const totalSales = filteredTransactions.filter(t => t.type === 'sale').reduce((sum, t) => sum + t.amount, 0);
    const totalRestock = filteredTransactions.filter(t => t.type === 'restock').reduce((sum, t) => sum + t.amount, 0);
    const netAmount = totalSales - totalRestock;

    let reportPeriodStr = 'All Time';
    if (exportDateRange !== 'all') {
       reportPeriodStr = exportDateRange === 'today' ? 'Today' : 
                         exportDateRange === 'yesterday' ? 'Yesterday' :
                         exportDateRange === 'last7' ? 'Last 7 Days' :
                         exportDateRange === 'last30' ? 'Last 30 Days' :
                         `${exportFromDate} to ${exportToDate}`;
    }

    generateStandardReport({
      title: 'Sales & Restock Log',
      reportPeriod: reportPeriodStr,
      summary: [
        { label: 'Total Sales', value: formatCurrency(totalSales) },
        { label: 'Total Restock Cost', value: formatCurrency(totalRestock) },
        { label: 'Net Amount', value: formatCurrency(netAmount) }
      ],
      columns: [
        { header: 'Item', dataKey: 'item', width: 120 },
        { header: 'Date', dataKey: 'date' },
        { header: 'Customer', dataKey: 'customer' },
        { header: 'Type', dataKey: 'type' },
        { header: 'Qty', dataKey: 'qty', align: 'center' },
        { header: 'Amount', dataKey: 'amount', align: 'right' },
        { header: 'Payment Status', dataKey: 'status' },
        { header: 'Details', dataKey: 'details' },
        { header: 'Entered By', dataKey: 'enteredBy' },
        { header: 'Received By', dataKey: 'receivedBy' }
      ],
      data: filteredTransactions.map(t => {
        const customer = t.bookingId ? t.bookingId.customerName : (t.customerName || t.supplier || 'Walk-in');
        let paymentStatusText = 'Paid';
        if (t.type === 'restock') paymentStatusText = '—';
        else if (t.bookingId) {
          const status = t.bookingId.paymentStatus || 'pending';
          paymentStatusText = status === 'paid' ? 'Paid (Booking)' : status === 'partial' ? 'Partially Paid' : 'Pending (Booking)';
        } else {
          paymentStatusText = 'Paid (Direct)';
        }
        let paymentDetails = 'Direct Sale';
        if (t.type === 'restock') paymentDetails = t.supplier || 'Restock';
        else if (t.bookingId) paymentDetails = `Booking: #${t.bookingId._id ? t.bookingId._id.substring(t.bookingId._id.length - 6).toUpperCase() : ''}`;

        return {
          item: (t.itemId?.name || '—').substring(0, 20),
          date: new Date(t.date).toLocaleDateString('en-IN'),
          customer: customer.substring(0, 20),
          type: t.type === 'sale' ? 'Sale' : 'Restock',
          qty: t.quantity.toString(),
          amount: formatCurrency(t.amount),
          status: paymentStatusText,
          details: paymentDetails,
          enteredBy: (t.enteredBy?.name || '—').substring(0, 15),
          receivedBy: (t.receivedBy?.name || '—').substring(0, 15)
        };
      }),
      filename: `Sales_Log_${new Date().toISOString().split('T')[0]}.pdf`,
      logoBase64
    });
  };

  return (
    <div className="page-container">
      {toast && <div className="toast-container"><div className={`toast toast-${toast.type === 'error' ? 'error' : 'success'}`}><span className="toast-icon">{toast.type === 'error' ? <X size={16} /> : <Check size={16} />}</span><div className="toast-content"><div className="toast-title">{toast.message}</div></div></div></div>}
      <div className="page-header" style={{ marginBottom: 'var(--space-4)' }}>
        <div><h1>Sales</h1><p className="page-subtitle">List products, sell items, and manage inventory transactions</p></div>
        {activeTab === 'pos' && (
          <div className="flex gap-3">
            {canAddItem && <button className="btn btn-secondary btn-md" onClick={() => setShowAddItem(true)}>+ Add Item</button>}
            {canLogSale && <button className="btn btn-primary btn-md" onClick={() => openTxn('sale')}>Log Sale</button>}
            {canRestock && <button className="btn btn-secondary btn-md" onClick={() => openTxn('restock')}>Add Restock</button>}
          </div>
        )}
      </div>

      {/* Tabs Menu */}
      <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-6)', borderBottom: '1px solid var(--surface-glass-border)', paddingBottom: 'var(--space-2)', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button className={`btn ${activeTab === 'pos' ? 'btn-primary' : 'btn-ghost'} btn-sm`} onClick={() => setActiveTab('pos')}>POS / Products</button>
          {canViewHistory && (
            <button className={`btn ${activeTab === 'history' ? 'btn-primary' : 'btn-ghost'} btn-sm`} onClick={() => setActiveTab('history')}>Sales Management</button>
          )}
        </div>
      </div>

      {loading ? <div className="loading-screen"><div className="spinner spinner-lg" /></div> : (
        <>
          {activeTab === 'pos' ? (
            <div className="grid grid-4" style={{ marginBottom: 'var(--space-6)' }}>
              {items.map((item) => (
                <button key={item._id} className="card stat-card sales-item-card" type="button" onClick={() => setSelectedItem(item)} style={{ width: '100%', cursor: 'pointer', textAlign: 'left' }}>
                  <div className="stat-icon" style={{ background: item.currentStock <= item.lowStockThreshold ? 'var(--status-danger-soft)' : 'var(--accent-primary-soft)', color: item.currentStock <= item.lowStockThreshold ? 'var(--status-danger)' : 'var(--accent-primary)' }}><Package size={20} /></div>
                  <div className="stat-value text-gradient">{item.currentStock}</div>
                  <div className="stat-label">{item.name} ({item.unit})</div>
                  <div style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>₹{item.unitPrice || 0} / piece</div>
                  {item.currentStock <= item.lowStockThreshold && <span className="badge badge-danger badge-dot" style={{ fontSize: '10px' }}>Low Stock!</span>}
                </button>
              ))}
              {items.length === 0 && <div className="card sales-item-card" style={{ gridColumn: '1 / -1' }}><div className="empty-state"><div className="empty-state-icon"><Package size={48} /></div><div className="empty-state-title">No products</div><div className="empty-state-description">Add sales products to start selling.</div></div></div>}
            </div>
          ) : (
            // Sales Management Log Tab
            <div className="card">
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <h3 style={{ fontSize: 'var(--text-sm)' }}>Recent Transactions</h3>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
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
                      onChange={(val) => setExportDateRange(val)}
                      style={{ minWidth: '140px', height: '36px' }}
                      searchable={false}
                    />
                    
                    {exportDateRange === 'custom' && (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input type="date" className="form-input" style={{ padding: '6px 12px', fontSize: '13px', height: '36px' }} value={exportFromDate} onChange={e => setExportFromDate(e.target.value)} />
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>to</span>
                        <input type="date" className="form-input" style={{ padding: '6px 12px', fontSize: '13px', height: '36px' }} value={exportToDate} onChange={e => setExportToDate(e.target.value)} />
                      </div>
                    )}
                  </div>
                  {canExport && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="btn btn-ghost btn-sm" onClick={exportToPDF}><FileText size={16} /> PDF</button>
                      <button className="btn btn-ghost btn-sm" onClick={exportToExcel}><FileSpreadsheet size={16} /> Excel</button>
                    </div>
                  )}
                </div>
              </div>
              
              {filteredTransactions.length === 0 ? (
                 <div className="empty-state"><div className="empty-state-title">No transactions found</div><div className="empty-state-description">There are no recent sales or restock transactions matching your filters.</div></div>
              ) : (
              <>
              {/* DESKTOP TABLE VIEW */}
              <div className="card desktop-only" style={{ padding: 0 }}>
                <div className="data-table-wrapper" style={{ overflowX: 'auto' }}>
                  <table className="data-table" style={{ width: '100%', minWidth: '1000px', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--surface-glass-border)', textAlign: 'left', color: 'var(--text-secondary)', fontSize: 'var(--text-xs)', fontWeight: 600, textTransform: 'uppercase' }}>
                        <th style={{ padding: 'var(--space-4)' }}>Item</th>
                        <th style={{ padding: 'var(--space-4)' }}>Date</th>
                        <th style={{ padding: 'var(--space-4)' }}>Customer / Supplier</th>
                        <th style={{ padding: 'var(--space-4)' }}>Type</th>
                        <th style={{ padding: 'var(--space-4)' }}>Quantity</th>
                        <th style={{ padding: 'var(--space-4)' }}>Amount</th>
                        <th style={{ padding: 'var(--space-4)' }}>Payment Status</th>
                        <th style={{ padding: 'var(--space-4)' }}>Payment Details</th>
                        <th style={{ padding: 'var(--space-4)' }}>Entered By</th>
                        <th style={{ padding: 'var(--space-4)' }}>Received By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedTransactions.map(t => {
                        const customer = t.bookingId ? t.bookingId.customerName : (t.customerName || t.supplier || 'Walk-in');
                        let paymentStatusText = 'Paid';
                        let paymentStatusBadge = 'badge-success';
                        if (t.type === 'restock') {
                          paymentStatusText = '—';
                          paymentStatusBadge = '';
                        } else if (t.bookingId) {
                          const status = t.bookingId.paymentStatus || 'pending';
                          if (status === 'paid') {
                            paymentStatusText = 'Paid (Booking)';
                            paymentStatusBadge = 'badge-success';
                          } else if (status === 'partial') {
                            paymentStatusText = 'Partially Paid';
                            paymentStatusBadge = 'badge-warning';
                          } else {
                            paymentStatusText = 'Pending (Booking)';
                            paymentStatusBadge = 'badge-danger';
                          }
                        } else {
                          paymentStatusText = 'Paid (Direct)';
                          paymentStatusBadge = 'badge-success';
                        }

                        let paymentDetails = 'Direct Sale';
                        if (t.type === 'restock') {
                          paymentDetails = t.supplier || 'Restock';
                        } else if (t.bookingId) {
                          const bIdShort = t.bookingId._id ? t.bookingId._id.substring(t.bookingId._id.length - 6).toUpperCase() : '';
                          paymentDetails = `Booking ID: #${bIdShort}`;
                        }

                        return (
                          <tr key={`desk-${t._id}`} style={{ borderBottom: '1px solid var(--surface-glass-border)' }}>
                            <td style={{ padding: 'var(--space-4)', fontWeight: 600, color: 'var(--text-primary)' }}>{t.itemId?.name || '—'}</td>
                            <td style={{ padding: 'var(--space-4)', color: 'var(--text-secondary)' }}>{new Date(t.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                            <td style={{ padding: 'var(--space-4)', color: 'var(--text-primary)' }}>{customer}</td>
                            <td style={{ padding: 'var(--space-4)' }}><span className={`badge ${t.type === 'sale' ? 'badge-warning' : 'badge-success'} badge-dot`} style={{ padding: '4px 8px' }}>{t.type === 'sale' ? 'Sale' : 'Restock'}</span></td>
                            <td style={{ padding: 'var(--space-4)', fontWeight: 600, color: t.type === 'sale' ? 'var(--status-warning)' : 'var(--status-success)' }}>{t.type === 'sale' ? `-${t.quantity}` : `+${t.quantity}`}</td>
                            <td style={{ padding: 'var(--space-4)' }}>
                              <div style={{ fontWeight: 600 }}>{t.amount > 0 ? `₹${t.amount}` : '—'}</div>
                            </td>
                            <td style={{ padding: 'var(--space-4)' }}>
                              {paymentStatusBadge ? (
                                <span className={`badge ${paymentStatusBadge}`} style={{ padding: '4px 8px' }}>{paymentStatusText}</span>
                              ) : '—'}
                            </td>
                            <td style={{ padding: 'var(--space-4)', color: 'var(--text-secondary)', fontSize: 'var(--text-xs)' }}>{paymentDetails}</td>
                            <td style={{ padding: 'var(--space-4)', color: 'var(--text-secondary)' }}>{t.enteredBy?.name || '—'}</td>
                            <td style={{ padding: 'var(--space-4)', color: 'var(--text-secondary)' }}>{t.receivedBy?.name || '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* MOBILE CARDS VIEW */}
              <div className="cards-grid mobile-only" style={{ padding: '0 var(--space-4) var(--space-4) var(--space-4)' }}>
                {paginatedTransactions.map((t) => {
                  const customer = t.bookingId ? t.bookingId.customerName : (t.customerName || t.supplier || 'Walk-in');
                  let paymentStatusText = 'Paid';
                  let paymentStatusBadge = 'badge-success';
                  if (t.type === 'restock') {
                    paymentStatusText = '—';
                    paymentStatusBadge = '';
                  } else if (t.bookingId) {
                    const status = t.bookingId.paymentStatus || 'pending';
                    if (status === 'paid') {
                      paymentStatusText = 'Paid (Booking)';
                      paymentStatusBadge = 'badge-success';
                    } else if (status === 'partial') {
                      paymentStatusText = 'Partially Paid';
                      paymentStatusBadge = 'badge-warning';
                    } else {
                      paymentStatusText = 'Pending (Booking)';
                      paymentStatusBadge = 'badge-danger';
                    }
                  } else {
                    paymentStatusText = 'Paid (Direct)';
                    paymentStatusBadge = 'badge-success';
                  }

                  let paymentDetails = 'Direct Sale';
                  if (t.type === 'restock') {
                    paymentDetails = t.supplier || 'Restock';
                  } else if (t.bookingId) {
                    const bIdShort = t.bookingId._id ? t.bookingId._id.substring(t.bookingId._id.length - 6).toUpperCase() : '';
                    paymentDetails = `Booking: #${bIdShort}`;
                  }

                  return (
                    <div key={t._id} className="card" style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                      {/* Header: Item Name + Date */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: '8px', background: 'var(--accent-primary-soft)', color: 'var(--accent-primary)', flexShrink: 0 }}>
                            <Package size={18} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 'var(--text-base)', color: 'var(--text-primary)', lineHeight: 1.2 }}>{t.itemId?.name || '—'}</div>
                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                          </div>
                        </div>
                        <span className={`badge ${t.type === 'sale' ? 'badge-warning' : 'badge-success'} badge-dot`} style={{ padding: '4px 8px' }}>{t.type === 'sale' ? 'Sale' : 'Restock'}</span>
                      </div>

                      {/* Info details grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                        <div>
                          <div style={{ fontWeight: 500, color: 'var(--text-muted)' }}>Customer/Supplier</div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{customer}</div>
                        </div>
                        <div>
                          <div style={{ fontWeight: 500, color: 'var(--text-muted)' }}>Payment Status</div>
                          <div style={{ fontWeight: 600 }}>
                            {paymentStatusBadge ? (
                              <span className={`badge ${paymentStatusBadge}`} style={{ padding: '2px 6px', fontSize: '10px' }}>{paymentStatusText}</span>
                            ) : '—'}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontWeight: 500, color: 'var(--text-muted)' }}>Details</div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{paymentDetails}</div>
                        </div>
                        <div>
                          <div style={{ fontWeight: 500, color: 'var(--text-muted)' }}>Quantity</div>
                          <div style={{ fontWeight: 600, color: t.type === 'sale' ? 'var(--status-warning)' : 'var(--status-success)' }}>{t.type === 'sale' ? `-${t.quantity}` : `+${t.quantity}`}</div>
                        </div>
                        <div>
                          <div style={{ fontWeight: 500, color: 'var(--text-muted)' }}>Amount</div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t.amount > 0 ? `₹${t.amount}` : '—'}</div>
                        </div>
                        <div>
                          <div style={{ fontWeight: 500, color: 'var(--text-muted)' }}>By</div>
                          <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{t.enteredBy?.name || '—'}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
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
            </div>
          )}
        </>
      )}

      {selectedItem && (
        <div className="modal-backdrop" onClick={() => setSelectedItem(null)}><div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header"><h3 className="modal-title">{selectedItem.name}</h3><button className="modal-close" onClick={() => setSelectedItem(null)}><X size={20} /></button></div>
          <div className="modal-body">
            <div className="form-grid-2" style={{ gap: 'var(--space-4)' }}>
              <div className="card" style={{ padding: 'var(--space-4)' }}><div className="stat-label">Current Stock</div><div className="stat-value">{selectedItem.currentStock}</div></div>
              <div className="card" style={{ padding: 'var(--space-4)' }}><div className="stat-label">Price Per Piece</div><div className="stat-value">Rs. {selectedItem.unitPrice || 0}</div></div>
            </div>
          </div>
          <div className="modal-footer">
            <div style={{ flex: 1 }}>
              {canDelete && <button className={`btn btn-danger btn-md ${saving ? 'btn-loading' : ''}`} onClick={() => handleDeleteItem(selectedItem._id)} disabled={saving}>Delete</button>}
            </div>
            {canRestock && <button className="btn btn-secondary btn-md" onClick={() => openTxn('restock', selectedItem._id)}>Restock</button>}
            {canLogSale && <button className="btn btn-primary btn-md" onClick={() => openTxn('sale', selectedItem._id)}>Sell</button>}
          </div>
        </div></div>
      )}

      {showAddItem && (
        <div className="modal-backdrop" onClick={() => setShowAddItem(false)}><div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header"><h3 className="modal-title">Add Sales Product</h3><button className="modal-close" onClick={() => setShowAddItem(false)}><X size={20} /></button></div>
          <div className="modal-body">
            <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}><label className="form-label required">Item Name</label><input className="form-input" value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="e.g. Stumps" autoFocus /></div>
            <div className="form-grid-2" style={{ gap: 'var(--space-4)' }}>
              <div className="form-group"><label className="form-label">Unit</label><input className="form-input" value={itemUnit} onChange={(e) => setItemUnit(e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Price Per Piece (₹)</label><input className="form-input" type="number" min={0} step="0.01" value={itemUnitPrice} onChange={(e) => setItemUnitPrice(Number(e.target.value))} /></div>
              <div className="form-group"><label className="form-label">Opening Stock</label><input className="form-input" type="number" min={0} value={itemInitialStock} onChange={(e) => setItemInitialStock(Number(e.target.value))} /></div>
              <div className="form-group"><label className="form-label">Low Stock Threshold</label><input className="form-input" type="number" min={0} value={itemThreshold} onChange={(e) => setItemThreshold(Number(e.target.value))} /></div>
            </div>
          </div>
          <div className="modal-footer"><button className="btn btn-secondary btn-md" onClick={() => setShowAddItem(false)}>Cancel</button><button className={`btn btn-primary btn-md ${saving ? 'btn-loading' : ''}`} onClick={handleAddItem} disabled={saving}>Add Item</button></div>
        </div></div>
      )}

      {showTxn && (
        <div className="modal-backdrop" onClick={() => setShowTxn(null)}><div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header"><h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>{showTxn.type === 'sale' ? <><Banknote size={20} /> Log Sale</> : <><Inbox size={20} /> Add Restock</>}</h3><button className="modal-close" onClick={() => setShowTxn(null)}><X size={20} /></button></div>
          <div className="modal-body">
            <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
              <label className="form-label required">Item</label>
              <div style={{ width: '100%' }}>
                <CustomSelect
                  options={items.map((i) => ({ value: i._id, label: `${i.name} (Stock: ${i.currentStock}, ₹${i.unitPrice || 0}/piece)` }))}
                  value={txnItemId}
                  onChange={(val) => { setTxnItemId(val); if (showTxn.type === 'sale') setTxnAmount(getSaleAmount(val, txnQty)); }}
                />
              </div>
            </div>
            <div className={showTxn.type === 'sale' ? 'grid' : 'form-grid-2'} style={{ gap: 'var(--space-4)' }}>
              <div className="form-group">
                <label className="form-label required">Quantity</label>
                <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr 44px', gap: 'var(--space-2)', alignItems: 'center' }}>
                  <button className="btn btn-secondary btn-md" type="button" onClick={() => updateTxnQty(txnQty - 1)} disabled={txnQty <= 1}>-</button>
                  <input className="form-input" type="number" min={1} value={txnQty} onChange={(e) => updateTxnQty(Number(e.target.value))} style={{ textAlign: 'center' }} />
                  <button className="btn btn-secondary btn-md" type="button" onClick={() => updateTxnQty(txnQty + 1)}>+</button>
                </div>
              </div>
              {showTxn.type === 'restock' && <div className="form-group"><label className="form-label">Cost (₹)</label><input className="form-input" type="number" value={txnAmount} onChange={(e) => setTxnAmount(Number(e.target.value))} /></div>}
            </div>
            {showTxn.type === 'sale' && <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', background: 'var(--surface-secondary)' }}><div className="stat-label">Sale Amount</div><div className="stat-value">Rs. {getSaleAmount(txnItemId, txnQty)}</div></div>}
            {showTxn.type === 'sale' && (
              <>
                <div className="form-grid-2" style={{ gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
                  <div className="form-group"><label className="form-label">Customer Name</label><input className="form-input" value={txnCustomerName} onChange={(e) => setTxnCustomerName(e.target.value)} placeholder="e.g. John Doe" /></div>
                  <div className="form-group"><label className="form-label">Customer Contact</label><input className="form-input" value={txnCustomerContact} onChange={(e) => setTxnCustomerContact(e.target.value)} placeholder="Phone number" /></div>
                </div>
                <div className="form-group" style={{ marginTop: 'var(--space-4)' }}>
                  <label className="form-label">Received By (Optional)</label>
                  <CustomSelect
                    options={users.map((u: any) => ({ value: u._id, label: u.name + (u.positionId?.name ? ` (${u.positionId.name})` : '') }))}
                    value={txnReceivedBy}
                    onChange={(v) => setTxnReceivedBy(v)}
                  />
                </div>
              </>
            )}
            {showTxn.type === 'restock' && <div className="form-group" style={{ marginTop: 'var(--space-4)' }}><label className="form-label">Supplier</label><input className="form-input" value={txnSupplier} onChange={(e) => setTxnSupplier(e.target.value)} placeholder="Supplier name" /></div>}
          </div>
          <div className="modal-footer"><button className="btn btn-secondary btn-md" onClick={() => setShowTxn(null)}>Cancel</button><button className={`btn btn-primary btn-md ${saving ? 'btn-loading' : ''}`} onClick={handleTxn} disabled={saving}>{showTxn.type === 'sale' ? 'Log Sale' : 'Add Restock'}</button></div>
        </div></div>
      )}
    </div>
  );
}
