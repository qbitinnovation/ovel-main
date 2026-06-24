'use client';
import { useState, useEffect, useCallback } from 'react';
import { X, Check, Save, Globe, FileText, Download, Edit } from 'lucide-react';
import { CustomDatePicker } from '@/components/ui/CustomDatePicker';
import { usePermissions } from '@/components/providers/PermissionsProvider';
import jsPDF from 'jspdf';

interface MOM { _id: string; date: string; attendees: string[]; pointsEnglish: string; pointsMalayalam: string; decisions: string[]; pendingTasksSummary: string; createdBy: { name: string } | null; createdAt: string; }

export default function MOMPage() {
  const [records, setRecords] = useState<MOM[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'form'>('list');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendees, setAttendees] = useState('');
  const [pointsEnglish, setPointsEnglish] = useState('');
  const [pointsMalayalam, setPointsMalayalam] = useState('');
  const [decisions, setDecisions] = useState('');
  const [translating, setTranslating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<MOM | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: string } | null>(null);
  const showToast = (m: string, t = 'success') => { setToast({ message: m, type: t }); setTimeout(() => setToast(null), 3500); };

  const { checkPermission } = usePermissions();
  const canCreate = checkPermission('malayalam_mom', 'create_mom_entry');
  const canEdit = checkPermission('malayalam_mom', 'edit_mom');
  const canTranslate = checkPermission('malayalam_mom', 'convert_to_malayalam');
  const canExport = checkPermission('malayalam_mom', 'export_mom_history');
  const canViewHistory = checkPermission('malayalam_mom', 'view_mom_history');

  const fetchRecords = useCallback(async () => {
    try { const res = await fetch('/api/mom'); const d = await res.json(); if (d.success) setRecords(d.data); } catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const handleTranslate = async () => {
    if (!pointsEnglish.trim()) return showToast('Enter meeting points first', 'error');
    setTranslating(true);
    try { const res = await fetch('/api/mom/translate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: pointsEnglish }) }); const d = await res.json(); if (d.success) { setPointsMalayalam(d.data.translatedText); showToast(d.message); } else showToast(d.message, 'error'); } catch { showToast('Translation failed', 'error'); } finally { setTranslating(false); }
  };

  const handleSave = async () => {
    if (!pointsEnglish.trim()) return showToast('Meeting points required', 'error');
    setSaving(true);
    try {
      const res = await fetch('/api/mom', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: editingId ? 'update' : 'create', id: editingId, date: formDate, attendees: attendees.split(',').map((a) => a.trim()).filter(Boolean), pointsEnglish, pointsMalayalam, decisions: decisions.split('\n').filter(Boolean) }) });
      const d = await res.json();
      if (d.success) { showToast(editingId ? 'MOM updated' : 'MOM saved'); setView('list'); fetchRecords(); setPointsEnglish(''); setPointsMalayalam(''); setDecisions(''); setAttendees(''); setEditingId(null); setSelected(null); }
      else showToast(d.message, 'error');
    } catch { showToast('Error', 'error'); } finally { setSaving(false); }
  };

  const handleEdit = () => {
    if (!selected) return;
    setFormDate(selected.date.split('T')[0]);
    setAttendees(selected.attendees.join(', '));
    setPointsEnglish(selected.pointsEnglish);
    setPointsMalayalam(selected.pointsMalayalam);
    setDecisions(selected.decisions.join('\n'));
    setEditingId(selected._id);
    setView('form');
  };

  const handleExportPDF = () => {
    if (!selected) return;
    const doc = new jsPDF();
    const dateStr = new Date(selected.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    doc.setFontSize(16);
    doc.text(`Minutes of Meeting - ${dateStr}`, 14, 20);
    
    let y = 30;
    doc.setFontSize(12);
    doc.text('Attendees:', 14, y);
    doc.setFontSize(10);
    y += 7;
    const attendeesText = doc.splitTextToSize(selected.attendees.join(', ') || 'None listed', 180);
    doc.text(attendeesText, 14, y);
    y += attendeesText.length * 5 + 5;
    
    doc.setFontSize(12);
    doc.text('Meeting Points (English):', 14, y);
    doc.setFontSize(10);
    y += 7;
    const pointsText = doc.splitTextToSize(selected.pointsEnglish, 180);
    doc.text(pointsText, 14, y);
    y += pointsText.length * 5 + 5;

    if (selected.decisions && selected.decisions.length > 0) {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.setFontSize(12);
      doc.text('Decisions:', 14, y);
      doc.setFontSize(10);
      y += 7;
      selected.decisions.forEach((d, i) => {
        if (y > 280) { doc.addPage(); y = 20; }
        const dText = doc.splitTextToSize(`${i + 1}. ${d}`, 180);
        doc.text(dText, 14, y);
        y += dText.length * 5 + 2;
      });
    }

    doc.save(`MOM_${selected.date.split('T')[0]}.pdf`);
  };

  return (
    <div className="page-container">
      {toast && <div className="toast-container"><div className={`toast toast-${toast.type === 'error' ? 'error' : 'success'}`}><span className="toast-icon">{toast.type === 'error' ? <X size={16} /> : <Check size={16} />}</span><div className="toast-content"><div className="toast-title">{toast.message}</div></div></div></div>}
      <div className="page-header">
        <div><h1>Minutes of Meeting</h1><p className="page-subtitle">Create, translate, and manage meeting minutes</p></div>
        {view === 'list' && canCreate && <button className="btn btn-primary btn-md" onClick={() => { setView('form'); setEditingId(null); setPointsEnglish(''); setPointsMalayalam(''); setDecisions(''); setAttendees(''); setFormDate(new Date().toISOString().split('T')[0]); }}>+ New MOM</button>}
        {view === 'form' && <button className="btn btn-secondary btn-md" onClick={() => { setView('list'); setEditingId(null); }}>← Back</button>}
      </div>

      {view === 'form' ? (
        <div className="form-grid-2">
          <div>
            <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
              <label className="form-label required">Meeting Date</label>
              <CustomDatePicker value={formDate} onChange={(val) => setFormDate(val)} />
            </div>
            <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}><label className="form-label">Attendees (comma-separated)</label><input className="form-input" value={attendees} onChange={(e) => setAttendees(e.target.value)} placeholder="Name 1, Name 2, Name 3" /></div>
            <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}><label className="form-label required">Meeting Points (English)</label><textarea className="form-input form-textarea" value={pointsEnglish} onChange={(e) => setPointsEnglish(e.target.value)} rows={10} placeholder="Enter meeting discussion points..." /></div>
            <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}><label className="form-label">Decisions (one per line)</label><textarea className="form-input form-textarea" value={decisions} onChange={(e) => setDecisions(e.target.value)} rows={4} placeholder="Decision 1&#10;Decision 2" /></div>
            <div className="flex gap-3">
              <button className={`btn btn-primary btn-md ${saving ? 'btn-loading' : ''}`} onClick={handleSave} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Save size={16} /> Save MOM</button>
            </div>
          </div>
          <div>
            <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
              <div className="card-header"><h3 style={{ fontSize: 'var(--text-sm)', display: 'flex', alignItems: 'center', gap: '8px' }}><Globe size={18} /> Malayalam Translation</h3>
                {canTranslate && <button className={`btn btn-secondary btn-sm ${translating ? 'btn-loading' : ''}`} onClick={handleTranslate} disabled={translating}>Convert to Malayalam</button>}
              </div>
              <div className="card-body" style={{ padding: 'var(--space-4)' }}>
                {pointsMalayalam ? (
                  <textarea className="form-input form-textarea" value={pointsMalayalam} onChange={(e) => setPointsMalayalam(e.target.value)} rows={12} style={{ direction: 'ltr' }} />
                ) : (
                  <div className="empty-state" style={{ padding: 'var(--space-8)' }}><div className="empty-state-icon"><Globe size={48} /></div><div className="empty-state-title">Enter English points first</div><div className="empty-state-description">Then click &quot;Convert to Malayalam&quot; to generate translation</div></div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : loading ? <div className="loading-screen"><div className="spinner spinner-lg" /></div> : !canViewHistory ? (
        <div className="card"><div className="empty-state"><div className="empty-state-icon"><FileText size={48} /></div><div className="empty-state-title">No Access</div><div className="empty-state-description">You don't have permission to view MOM history.</div></div></div>
      ) : records.length === 0 ? (
        <div className="card"><div className="empty-state"><div className="empty-state-icon"><FileText size={48} /></div><div className="empty-state-title">No meeting minutes</div><div className="empty-state-description">Create your first meeting record.</div></div></div>
      ) : (
        <div className={selected ? 'form-grid-responsive' : 'grid'}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {records.map((r) => (
              <div key={r._id} className={`card card-interactive ${selected?._id === r._id ? 'card-active' : ''}`} onClick={() => setSelected(r)} style={{ cursor: 'pointer', borderColor: selected?._id === r._id ? 'var(--accent-primary)' : undefined }}>
                <div style={{ padding: 'var(--space-4)' }}>
                  <div style={{ fontWeight: 700 }}>{new Date(r.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 'var(--space-1)' }}>{r.attendees.length} attendees · {r.decisions.length} decisions · By {r.createdBy?.name || '—'}</div>
                </div>
              </div>
            ))}
          </div>
          {selected && (
            <div className="card">
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: 'var(--text-sm)', display: 'flex', alignItems: 'center', gap: '8px' }}><FileText size={18} /> {new Date(selected.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {canEdit && (
                    <button className="btn btn-secondary btn-sm" onClick={handleEdit} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Edit size={16} /> Edit MOM
                    </button>
                  )}
                  {canExport && (
                    <button className="btn btn-secondary btn-sm" onClick={handleExportPDF} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Download size={16} /> Download PDF
                    </button>
                  )}
                </div>
              </div>
              <div className="card-body" style={{ padding: 'var(--space-6)' }}>
                <div style={{ marginBottom: 'var(--space-4)' }}><div className="form-label">Attendees</div><div style={{ fontSize: 'var(--text-sm)' }}>{selected.attendees.join(', ') || 'None listed'}</div></div>
                <div style={{ marginBottom: 'var(--space-4)' }}><div className="form-label">Meeting Points (English)</div><div style={{ fontSize: 'var(--text-sm)', whiteSpace: 'pre-wrap' }}>{selected.pointsEnglish}</div></div>
                {selected.pointsMalayalam && <div style={{ marginBottom: 'var(--space-4)' }}><div className="form-label">മലയാളം (Malayalam)</div><div style={{ fontSize: 'var(--text-sm)', whiteSpace: 'pre-wrap' }}>{selected.pointsMalayalam}</div></div>}
                {selected.decisions.length > 0 && <div style={{ marginBottom: 'var(--space-4)' }}><div className="form-label">Decisions</div><ul style={{ paddingLeft: 'var(--space-4)', fontSize: 'var(--text-sm)' }}>{selected.decisions.map((d, i) => <li key={i} style={{ marginBottom: 'var(--space-1)' }}>{d}</li>)}</ul></div>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
