'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { X, Check, Package, Banknote, Inbox, User as UserIcon, Download, FileText, FileSpreadsheet } from 'lucide-react';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { usePermissions } from '@/components/providers/PermissionsProvider';

interface Item { _id: string; name: string; unit: string; unitPrice?: number; currentStock: number; lowStockThreshold: number; }
interface Txn { _id: string; itemId: { _id: string; name: string } | null; type: string; quantity: number; amount: number; supplier: string; date: string; enteredBy: { name: string } | null; createdAt: string; }

export default function SalesPage() {
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
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: string } | null>(null);
  const showToast = (m: string, t = 'success') => { setToast({ message: m, type: t }); setTimeout(() => setToast(null), 3500); };

  // Filter State
  const [exportDateRange, setExportDateRange] = useState('all');
  const [exportFromDate, setExportFromDate] = useState('');
  const [exportToDate, setExportToDate] = useState('');

  const { checkPermission } = usePermissions();
  const canAddItem = checkPermission('inventory_sales', 'add_item');
  const canLogSale = checkPermission('inventory_sales', 'create_sale');
  const canRestock = true; // FORCE TRUE for testing
  const canDelete = true; // FORCE TRUE for testing
  const canExport = checkPermission('inventory_sales', 'export_sales_report');
  const canViewHistory = checkPermission('inventory_sales', 'view_sales_history');

  const fetchData = useCallback(async () => {
    try { const res = await fetch('/api/inventory'); const d = await res.json(); if (d.success) { setItems(d.data.items); setTransactions(d.data.recentTransactions); } } catch (e) { console.error(e); } finally { setLoading(false); }
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
    try { const res = await fetch('/api/inventory', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: act, itemId: txnItemId, quantity: txnQty, amount, supplier: txnSupplier, customerName: txnCustomerName, customerContact: txnCustomerContact }) }); const d = await res.json(); if (d.success) { showToast(d.message); setShowTxn(null); setTxnQty(1); setTxnAmount(0); setTxnSupplier(''); setTxnCustomerName(''); setTxnCustomerContact(''); fetchData(); } else showToast(d.message, 'error'); } catch { showToast('Error', 'error'); } finally { setSaving(false); }
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

  const exportToExcel = () => {
    if (!filteredTransactions.length) return showToast('No transactions to export', 'error');
    const ws = XLSX.utils.json_to_sheet(filteredTransactions.map(t => ({
      Item: t.itemId?.name || '—',
      Date: new Date(t.date).toLocaleDateString('en-IN'),
      Type: t.type === 'sale' ? 'Sale' : 'Restock',
      Quantity: t.quantity,
      Amount: t.amount,
      EnteredBy: t.enteredBy?.name || '—'
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sales Log");
    XLSX.writeFile(wb, `Sales_Log_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportToPDF = () => {
    if (!filteredTransactions.length) return showToast('No transactions to export', 'error');
    const doc = new jsPDF();
    doc.text('Sales Log', 14, 15);
    let yPos = 30;
    doc.setFontSize(10);
    doc.text('Item', 14, yPos);
    doc.text('Date', 60, yPos);
    doc.text('Type', 90, yPos);
    doc.text('Qty', 120, yPos);
    doc.text('Amount', 140, yPos);
    doc.text('Entered By', 170, yPos);
    yPos += 5;
    filteredTransactions.forEach(t => {
      if (yPos > 280) { doc.addPage(); yPos = 20; }
      doc.text((t.itemId?.name || '—').substring(0, 15), 14, yPos);
      doc.text(new Date(t.date).toLocaleDateString('en-IN'), 60, yPos);
      doc.text(t.type === 'sale' ? 'Sale' : 'Restock', 90, yPos);
      doc.text(t.quantity.toString(), 120, yPos);
      doc.text(t.amount.toString(), 140, yPos);
      doc.text((t.enteredBy?.name || '—').substring(0, 15), 170, yPos);
      yPos += 7;
    });
    doc.save(`Sales_Log_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="page-container">
      {toast && <div className="toast-container"><div className={`toast toast-${toast.type === 'error' ? 'error' : 'success'}`}><span className="toast-icon">{toast.type === 'error' ? <X size={16} /> : <Check size={16} />}</span><div className="toast-content"><div className="toast-title">{toast.message}</div></div></div></div>}
      <div className="page-header">
        <div><h1>Sales</h1><p className="page-subtitle">List products, sell pieces, and manage product restocking</p></div>
        <div className="flex gap-3">
          {canAddItem && <button className="btn btn-secondary btn-md" onClick={() => setShowAddItem(true)}>+ Add Item</button>}
          {canLogSale && <button className="btn btn-primary btn-md" onClick={() => openTxn('sale')}>Log Sale</button>}
          {canRestock && <button className="btn btn-secondary btn-md" onClick={() => openTxn('restock')}>Add Restock</button>}
        </div>
      </div>

      {loading ? <div className="loading-screen"><div className="spinner spinner-lg" /></div> : (
        <>
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

          {canViewHistory && transactions.length > 0 && (
            <div className="card">
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <h3 style={{ fontSize: 'var(--text-sm)' }}>Recent Transactions</h3>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <select 
                      className="form-select" 
                      value={exportDateRange} 
                      onChange={(e) => setExportDateRange(e.target.value)}
                      style={{ padding: '6px 12px', fontSize: '13px', height: '36px', minWidth: '140px' }}
                    >
                      <option value="all">All Time</option>
                      <option value="today">Today</option>
                      <option value="yesterday">Yesterday</option>
                      <option value="last7">Last 7 Days</option>
                      <option value="last30">Last 30 Days</option>
                      <option value="custom">Custom Range</option>
                    </select>
                    
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
            <>
            {/* DESKTOP TABLE VIEW */}
            <div className="card desktop-only" style={{ padding: 0 }}>
              <div className="data-table-wrapper" style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ width: '100%', minWidth: '800px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--surface-glass-border)', textAlign: 'left', color: 'var(--text-secondary)', fontSize: 'var(--text-xs)', fontWeight: 600, textTransform: 'uppercase' }}>
                      <th style={{ padding: 'var(--space-4)' }}>Item</th>
                      <th style={{ padding: 'var(--space-4)' }}>Date</th>
                      <th style={{ padding: 'var(--space-4)' }}>Type</th>
                      <th style={{ padding: 'var(--space-4)' }}>Quantity</th>
                      <th style={{ padding: 'var(--space-4)' }}>Amount</th>
                      <th style={{ padding: 'var(--space-4)' }}>Entered By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.map(t => (
                      <tr key={`desk-${t._id}`} style={{ borderBottom: '1px solid var(--surface-glass-border)' }}>
                        <td style={{ padding: 'var(--space-4)', fontWeight: 600, color: 'var(--text-primary)' }}>{t.itemId?.name || '—'}</td>
                        <td style={{ padding: 'var(--space-4)', color: 'var(--text-secondary)' }}>{new Date(t.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                        <td style={{ padding: 'var(--space-4)' }}><span className={`badge ${t.type === 'sale' ? 'badge-warning' : 'badge-success'} badge-dot`} style={{ padding: '4px 8px' }}>{t.type === 'sale' ? 'Sale' : 'Restock'}</span></td>
                        <td style={{ padding: 'var(--space-4)', fontWeight: 600, color: t.type === 'sale' ? 'var(--status-warning)' : 'var(--status-success)' }}>{t.type === 'sale' ? `-${t.quantity}` : `+${t.quantity}`}</td>
                        <td style={{ padding: 'var(--space-4)', fontWeight: 600 }}>{t.amount > 0 ? `₹${t.amount}` : '—'}</td>
                        <td style={{ padding: 'var(--space-4)', color: 'var(--text-secondary)' }}>{t.enteredBy?.name || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* MOBILE CARDS VIEW */}
            <div className="cards-grid mobile-only" style={{ padding: '0 var(--space-4) var(--space-4) var(--space-4)' }}>
              {filteredTransactions.map((t) => (
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
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
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
              ))}
            </div>
            </></div>
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
              <div className="form-grid-2" style={{ gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
                <div className="form-group"><label className="form-label">Customer Name</label><input className="form-input" value={txnCustomerName} onChange={(e) => setTxnCustomerName(e.target.value)} placeholder="e.g. John Doe" /></div>
                <div className="form-group"><label className="form-label">Customer Contact</label><input className="form-input" value={txnCustomerContact} onChange={(e) => setTxnCustomerContact(e.target.value)} placeholder="Phone number" /></div>
              </div>
            )}
            {showTxn.type === 'restock' && <div className="form-group" style={{ marginTop: 'var(--space-4)' }}><label className="form-label">Supplier</label><input className="form-input" value={txnSupplier} onChange={(e) => setTxnSupplier(e.target.value)} placeholder="Supplier name" /></div>}
          </div>
          <div className="modal-footer"><button className="btn btn-secondary btn-md" onClick={() => setShowTxn(null)}>Cancel</button><button className={`btn btn-primary btn-md ${saving ? 'btn-loading' : ''}`} onClick={handleTxn} disabled={saving}>{showTxn.type === 'sale' ? 'Log Sale' : 'Add Restock'}</button></div>
        </div></div>
      )}
    </div>
  );
}
