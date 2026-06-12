'use client';
import { useState, useEffect, useCallback } from 'react';

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
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: string } | null>(null);
  const showToast = (m: string, t = 'success') => { setToast({ message: m, type: t }); setTimeout(() => setToast(null), 3500); };

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
    try { const res = await fetch('/api/inventory', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: act, itemId: txnItemId, quantity: txnQty, amount, supplier: txnSupplier }) }); const d = await res.json(); if (d.success) { showToast(d.message); setShowTxn(null); setTxnQty(1); setTxnAmount(0); setTxnSupplier(''); fetchData(); } else showToast(d.message, 'error'); } catch { showToast('Error', 'error'); } finally { setSaving(false); }
  };

  return (
    <div className="page-container">
      {toast && <div className="toast-container"><div className={`toast toast-${toast.type === 'error' ? 'error' : 'success'}`}><span className="toast-icon">{toast.type === 'error' ? '✕' : '✓'}</span><div className="toast-content"><div className="toast-title">{toast.message}</div></div></div></div>}
      <div className="page-header">
        <div><h1>Sales</h1><p className="page-subtitle">List products, sell pieces, and manage product restocking</p></div>
        <div className="flex gap-3">
          <button className="btn btn-secondary btn-md" onClick={() => setShowAddItem(true)}>+ Add Item</button>
          <button className="btn btn-primary btn-md" onClick={() => openTxn('sale')}>Log Sale</button>
          <button className="btn btn-secondary btn-md" onClick={() => openTxn('restock')}>Add Restock</button>
        </div>
      </div>

      {loading ? <div className="loading-screen"><div className="spinner spinner-lg" /></div> : (
        <>
          <div className="grid grid-4" style={{ marginBottom: 'var(--space-6)' }}>
            {items.map((item) => (
              <button key={item._id} className="card stat-card sales-item-card" type="button" onClick={() => setSelectedItem(item)} style={{ width: '100%', cursor: 'pointer', textAlign: 'left' }}>
                <div className="stat-icon" style={{ background: item.currentStock <= item.lowStockThreshold ? 'var(--status-danger-soft)' : 'var(--accent-primary-soft)', color: item.currentStock <= item.lowStockThreshold ? 'var(--status-danger)' : 'var(--accent-primary)' }}>📦</div>
                <div className="stat-value text-gradient">{item.currentStock}</div>
                <div className="stat-label">{item.name} ({item.unit})</div>
                <div style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>₹{item.unitPrice || 0} / piece</div>
                {item.currentStock <= item.lowStockThreshold && <span className="badge badge-danger badge-dot" style={{ fontSize: '10px' }}>Low Stock!</span>}
              </button>
            ))}
            {items.length === 0 && <div className="card sales-item-card" style={{ gridColumn: '1 / -1' }}><div className="empty-state"><div className="empty-state-icon">📦</div><div className="empty-state-title">No products</div><div className="empty-state-description">Add sales products to start selling.</div></div></div>}
          </div>

          {transactions.length > 0 && (
            <div className="card"><div className="card-header"><h3 style={{ fontSize: 'var(--text-sm)' }}>Recent Transactions</h3></div>
            <div className="data-table-wrapper" style={{ border: 'none' }}>
              <table className="data-table"><thead><tr><th>Date</th><th>Item</th><th>Type</th><th>Qty</th><th>Amount</th><th>By</th></tr></thead>
              <tbody>{transactions.map((t) => (
                <tr key={t._id}>
                  <td style={{ fontSize: 'var(--text-sm)' }}>{new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                  <td style={{ fontWeight: 600 }}>{t.itemId?.name || '—'}</td>
                  <td><span className={`badge ${t.type === 'sale' ? 'badge-warning' : 'badge-success'} badge-dot`}>{t.type === 'sale' ? 'Sale' : 'Restock'}</span></td>
                  <td>{t.type === 'sale' ? `-${t.quantity}` : `+${t.quantity}`}</td>
                  <td>{t.amount > 0 ? `₹${t.amount}` : '—'}</td>
                  <td style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{t.enteredBy?.name || '—'}</td>
                </tr>
              ))}</tbody></table></div></div>
          )}
        </>
      )}

      {selectedItem && (
        <div className="modal-backdrop" onClick={() => setSelectedItem(null)}><div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header"><h3 className="modal-title">{selectedItem.name}</h3><button className="modal-close" onClick={() => setSelectedItem(null)}>×</button></div>
          <div className="modal-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
              <div className="card" style={{ padding: 'var(--space-4)' }}><div className="stat-label">Current Stock</div><div className="stat-value">{selectedItem.currentStock}</div></div>
              <div className="card" style={{ padding: 'var(--space-4)' }}><div className="stat-label">Price Per Piece</div><div className="stat-value">Rs. {selectedItem.unitPrice || 0}</div></div>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary btn-md" onClick={() => openTxn('restock', selectedItem._id)}>Restock</button>
            <button className="btn btn-primary btn-md" onClick={() => openTxn('sale', selectedItem._id)}>Sell</button>
          </div>
        </div></div>
      )}

      {showAddItem && (
        <div className="modal-backdrop" onClick={() => setShowAddItem(false)}><div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header"><h3 className="modal-title">Add Sales Product</h3><button className="modal-close" onClick={() => setShowAddItem(false)}>✕</button></div>
          <div className="modal-body">
            <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}><label className="form-label required">Item Name</label><input className="form-input" value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="e.g. Stumps" autoFocus /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
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
          <div className="modal-header"><h3 className="modal-title">{showTxn.type === 'sale' ? '💸 Log Sale' : '📥 Add Restock'}</h3><button className="modal-close" onClick={() => setShowTxn(null)}>✕</button></div>
          <div className="modal-body">
            <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}><label className="form-label required">Item</label><div className="select-wrapper"><select className="form-select" value={txnItemId} onChange={(e) => { setTxnItemId(e.target.value); if (showTxn.type === 'sale') setTxnAmount(getSaleAmount(e.target.value, txnQty)); }}>{items.map((i) => <option key={i._id} value={i._id}>{i.name} (Stock: {i.currentStock}, ₹{i.unitPrice || 0}/piece)</option>)}</select></div></div>
            <div style={{ display: 'grid', gridTemplateColumns: showTxn.type === 'sale' ? '1fr' : '1fr 1fr', gap: 'var(--space-4)' }}>
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
            {showTxn.type === 'restock' && <div className="form-group" style={{ marginTop: 'var(--space-4)' }}><label className="form-label">Supplier</label><input className="form-input" value={txnSupplier} onChange={(e) => setTxnSupplier(e.target.value)} placeholder="Supplier name" /></div>}
          </div>
          <div className="modal-footer"><button className="btn btn-secondary btn-md" onClick={() => setShowTxn(null)}>Cancel</button><button className={`btn btn-primary btn-md ${saving ? 'btn-loading' : ''}`} onClick={handleTxn} disabled={saving}>{showTxn.type === 'sale' ? 'Log Sale' : 'Add Restock'}</button></div>
        </div></div>
      )}
    </div>
  );
}
