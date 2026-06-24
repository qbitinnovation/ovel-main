'use client';

import { useCallback, useEffect, useState } from 'react';
import { X, Check, Package, FileText, Receipt, Trash2 } from 'lucide-react';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { usePermissions } from '@/components/providers/PermissionsProvider';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';

interface TurfItem {
  _id: string;
  name: string;
  category: string;
  quantity: number;
  location: string;
  condition: 'good' | 'needs_repair' | 'damaged' | 'missing';
  notes: string;
}

const conditionLabels: Record<TurfItem['condition'], string> = {
  good: 'Good',
  needs_repair: 'Needs Repair',
  damaged: 'Damaged',
  missing: 'Missing',
};

const emptyForm = {
  name: '',
  category: 'Equipment',
  quantity: 1,
  location: 'Turf',
  condition: 'good' as TurfItem['condition'],
  notes: '',
};

export default function InventoryPage() {
  const [items, setItems] = useState<TurfItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedItem, setSelectedItem] = useState<TurfItem | null>(null);
  const [editingItem, setEditingItem] = useState<TurfItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: string } | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { checkPermission } = usePermissions();
  const canAdd = checkPermission('inventory', 'add_item');
  const canEdit = checkPermission('inventory', 'edit_item');
  const canDelete = checkPermission('inventory', 'delete_item');
  const canExport = checkPermission('inventory', 'export_turf_inventory_report');

  const showToast = (message: string, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch('/api/turf-inventory');
      const data = await res.json();
      if (data.success) setItems(data.data.items);
    } catch (error) {
      console.error(error);
      showToast('Failed to load inventory', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingItem(null);
  };

  const closeForm = () => {
    setShowForm(false);
    resetForm();
  };

  const openAddForm = () => {
    resetForm();
    setShowForm(true);
  };

  const openEditForm = (item: TurfItem) => {
    setEditingItem(item);
    setForm({
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      location: item.location,
      condition: item.condition,
      notes: item.notes,
    });
    setSelectedItem(null);
    setShowForm(true);
  };

  const updateQuantity = (nextQuantity: number) => {
    setForm((current) => ({ ...current, quantity: Math.max(0, nextQuantity) }));
  };

  const getConditionBadge = (condition: TurfItem['condition']) => {
    if (condition === 'good') return 'badge-success';
    if (condition === 'needs_repair') return 'badge-warning';
    return 'badge-danger';
  };

  const getItemAccent = (item: TurfItem) => {
    if (item.condition === 'missing' || item.condition === 'damaged') {
      return { background: 'var(--status-danger-soft)', color: 'var(--status-danger)' };
    }
    if (item.condition === 'needs_repair' || item.quantity === 0) {
      return { background: 'var(--status-warning-soft)', color: 'var(--status-warning)' };
    }
    return { background: 'var(--accent-primary-soft)', color: 'var(--accent-primary)' };
  };

  const handleSaveItem = async () => {
    if (!form.name.trim()) return showToast('Item name is required', 'error');
    setSaving(true);
    try {
      const res = await fetch('/api/turf-inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: editingItem ? 'update-item' : 'add-item',
          itemId: editingItem?._id,
          ...form,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(editingItem ? 'Inventory item updated' : 'Inventory item added');
        closeForm();
        fetchItems();
      } else {
        showToast(data.message || 'Error saving item', 'error');
      }
    } catch {
      showToast('Error saving item', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    try {
      const res = await fetch('/api/turf-inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete-item', itemId: id }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Item deleted successfully');
        setSelectedItem(null);
        fetchItems();
      } else {
        showToast(data.message || 'Error deleting item', 'error');
      }
    } catch {
      showToast('Error deleting item', 'error');
    }
  };

  const exportToExcel = () => {
    if (!items.length) return showToast('No items to export', 'error');
    
    const exportData = items.map(item => ({
      'Item Name': item.name,
      'Category': item.category,
      'Quantity': item.quantity,
      'Condition': conditionLabels[item.condition] || item.condition,
      'Location': item.location,
      'Notes': item.notes || '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Turf_Inventory');
    XLSX.writeFile(workbook, `Turf_Inventory_${new Date().getTime()}.xlsx`);
  };

  const exportToPDF = () => {
    if (!items.length) return showToast('No items to export', 'error');
    
    const doc = new jsPDF('portrait');
    doc.setFontSize(16);
    doc.text('Turf Inventory Report', 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString('en-IN')}`, 14, 22);

    let y = 35;
    doc.setFontSize(9);
    doc.text('Item Name', 14, y);
    doc.text('Category', 70, y);
    doc.text('Quantity', 110, y);
    doc.text('Condition', 135, y);
    doc.text('Location', 170, y);
    
    y += 5;
    doc.line(14, y, 200, y);
    y += 7;

    items.forEach((item) => {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      
      doc.text(item.name.substring(0, 25), 14, y);
      doc.text(item.category.substring(0, 15), 70, y);
      doc.text(item.quantity.toString(), 110, y);
      doc.text(conditionLabels[item.condition] || item.condition, 135, y);
      doc.text(item.location.substring(0, 15), 170, y);
      
      y += 8;
    });

    doc.save(`Turf_Inventory_${new Date().getTime()}.pdf`);
  };

  return (
    <div className="page-container">
      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type === 'error' ? 'error' : 'success'}`}>
            <span className="toast-icon">{toast.type === 'error' ? <X size={16} /> : <Check size={16} />}</span>
            <div className="toast-content"><div className="toast-title">{toast.message}</div></div>
          </div>
        </div>
      )}

      <div className="page-header">
        <div>
          <h1>Inventory</h1>
          <p className="page-subtitle">Store and track turf items, equipment, and ground assets</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          {canExport && (
            <>
              <button className="btn btn-secondary btn-md" onClick={exportToPDF}>
                <FileText size={18} /> Export PDF
              </button>
              <button className="btn btn-secondary btn-md" onClick={exportToExcel}>
                <Receipt size={18} /> Export Excel
              </button>
            </>
          )}
          {canAdd && (
            <button className="btn btn-primary btn-md" onClick={openAddForm}>+ Add Turf Item</button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="loading-screen"><div className="spinner spinner-lg" /></div>
      ) : (
        <div className="grid grid-4" style={{ marginBottom: 'var(--space-6)' }}>
          {items.map((item) => {
            const accent = getItemAccent(item);
            return (
              <button
                key={item._id}
                className="card stat-card inventory-item-card"
                type="button"
                onClick={() => setSelectedItem(item)}
                style={{ width: '100%', cursor: 'pointer', textAlign: 'left' }}
              >
                <div className="stat-icon" style={{ background: accent.background, color: accent.color }}><Package size={20} /></div>
                <div className="stat-value text-gradient">{item.quantity}</div>
                <div className="stat-label">{item.name}</div>
                <div style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                  {item.category} | {item.location}
                </div>
                <span className={`badge ${getConditionBadge(item.condition)} badge-dot`} style={{ marginTop: 'var(--space-2)', fontSize: 10 }}>
                  {conditionLabels[item.condition]}
                </span>
              </button>
            );
          })}

          {items.length === 0 && (
            <div className="card inventory-item-card" style={{ gridColumn: '1 / -1' }}>
              <div className="empty-state">
                <div className="empty-state-icon"><Package size={48} /></div>
                <div className="empty-state-title">No turf items stored</div>
                <div className="empty-state-description">Add balls, cones, nets, cleaning tools, lights, or other turf assets.</div>
              </div>
            </div>
          )}
        </div>
      )}

      {selectedItem && (
        <div className="modal-backdrop" onClick={() => setSelectedItem(null)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{selectedItem.name}</h3>
              <button className="modal-close" onClick={() => setSelectedItem(null)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                <div className="card" style={{ padding: 'var(--space-4)' }}>
                  <div className="stat-label">Quantity</div>
                  <div className="stat-value">{selectedItem.quantity}</div>
                </div>
                <div className="card" style={{ padding: 'var(--space-4)' }}>
                  <div className="stat-label">Condition</div>
                  <span className={`badge ${getConditionBadge(selectedItem.condition)} badge-dot`}>{conditionLabels[selectedItem.condition]}</span>
                </div>
              </div>
              <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                <div><div className="stat-label">Category</div><div style={{ fontWeight: 700 }}>{selectedItem.category}</div></div>
                <div><div className="stat-label">Location</div><div style={{ fontWeight: 700 }}>{selectedItem.location}</div></div>
                <div><div className="stat-label">Notes</div><div style={{ color: 'var(--text-secondary)' }}>{selectedItem.notes || '-'}</div></div>
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {canDelete ? (
                <button className="btn btn-danger btn-md" onClick={() => handleDeleteItem(selectedItem._id)} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Trash2 size={16} /> Delete Item
                </button>
              ) : (
                <div />
              )}
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <button className="btn btn-secondary btn-md" onClick={() => setSelectedItem(null)}>Close</button>
                {canEdit && (
                  <button className="btn btn-primary btn-md" onClick={() => openEditForm(selectedItem)}>Edit Item</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="modal-backdrop" onClick={closeForm}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editingItem ? 'Edit Turf Item' : 'Add Turf Item'}</h3>
              <button className="modal-close" onClick={closeForm}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                <label className="form-label required">Item Name</label>
                <input className="form-input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Football, Net, Boundary cone" autoFocus />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <input className="form-input" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Location</label>
                  <input className="form-input" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Quantity</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr 44px', gap: 'var(--space-2)', alignItems: 'center' }}>
                    <button className="btn btn-secondary btn-md" type="button" onClick={() => updateQuantity(form.quantity - 1)} disabled={form.quantity <= 0}>-</button>
                    <input className="form-input" type="number" min={0} value={form.quantity} onChange={(event) => updateQuantity(Number(event.target.value))} style={{ textAlign: 'center' }} />
                    <button className="btn btn-secondary btn-md" type="button" onClick={() => updateQuantity(form.quantity + 1)}>+</button>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Condition</label>
                  <div style={{ width: '100%' }}>
                    <CustomSelect
                      options={[
                        { value: 'good', label: 'Good' },
                        { value: 'needs_repair', label: 'Needs Repair' },
                        { value: 'damaged', label: 'Damaged' },
                        { value: 'missing', label: 'Missing' }
                      ]}
                      value={form.condition}
                      onChange={(val) => setForm({ ...form, condition: val as TurfItem['condition'] })}
                    />
                  </div>
                </div>
              </div>
              <div className="form-group" style={{ marginTop: 'var(--space-4)' }}>
                <label className="form-label">Notes</label>
                <textarea className="form-textarea" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Optional details" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-md" onClick={closeForm}>Cancel</button>
              <button className={`btn btn-primary btn-md ${saving ? 'btn-loading' : ''}`} onClick={handleSaveItem} disabled={saving}>
                {editingItem ? 'Update Item' : 'Add Item'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
