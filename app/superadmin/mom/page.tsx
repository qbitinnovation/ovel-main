'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Check, Save, Globe, FileText, Download, Edit, Plus, Trash2, ExternalLink, AlertTriangle } from 'lucide-react';
import { CustomDatePicker } from '@/components/ui/CustomDatePicker';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { usePermissions } from '@/components/providers/PermissionsProvider';
import jsPDF from 'jspdf';
import Link from 'next/link';

interface TaskPayload {
  title: string;
  priority: string;
  dueDate: string;
  assigneeId: string;
  estimatedCost?: string | number;
}

interface MOM { 
  _id: string; 
  date: string; 
  attendees: string[]; 
  pointsEnglish: string; 
  pointsMalayalam: string; 
  decisions: string[]; 
  pendingTasksSummary: string; 
  linkedTaskIds?: { _id: string, title: string, priority: string, dueDate: string, status: string, estimatedCost?: number, actualCost?: number, assigneeId?: { name: string } }[];
  createdBy: { name: string } | null; 
  createdAt: string; 
}

export default function MeetingOfMinutesPage() {
  const [records, setRecords] = useState<MOM[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'form'>('list');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedAttendees, setSelectedAttendees] = useState<string[]>([]);
  const [pointsEnglish, setPointsEnglish] = useState('');
  const [pointsMalayalam, setPointsMalayalam] = useState('');
  const [decisions, setDecisions] = useState('');
  const [tasks, setTasks] = useState<TaskPayload[]>([]);
  const [translating, setTranslating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<MOM | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: string } | null>(null);
  const [attendeesDropdownOpen, setAttendeesDropdownOpen] = useState(false);
  const [attendeeSearch, setAttendeeSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const showToast = (m: string, t = 'success') => { setToast({ message: m, type: t }); setTimeout(() => setToast(null), 3500); };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setAttendeesDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const { checkPermission } = usePermissions();
  const canCreate = checkPermission('malayalam_mom', 'create_mom_entry');
  const canEdit = checkPermission('malayalam_mom', 'edit_mom');
  const canTranslate = checkPermission('malayalam_mom', 'convert_to_malayalam');
  const canExport = checkPermission('malayalam_mom', 'export_mom_history');
  const canViewHistory = checkPermission('malayalam_mom', 'view_mom_history');

  const fetchRecords = useCallback(async () => {
    try { const res = await fetch('/api/mom'); const d = await res.json(); if (d.success) setRecords(d.data); } catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);

  const fetchUsers = useCallback(async () => {
    try { const res = await fetch('/api/users?limit=500'); const d = await res.json(); if (d.success) setUsers(d.data.users || []); } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { 
    fetchRecords(); 
    fetchUsers();
  }, [fetchRecords, fetchUsers]);

  const handleTranslate = async () => {
    if (!pointsEnglish.trim()) return showToast('Enter meeting points first', 'error');
    setTranslating(true);
    try { const res = await fetch('/api/mom/translate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: pointsEnglish }) }); const d = await res.json(); if (d.success) { setPointsMalayalam(d.data.translatedText); showToast(d.message); } else showToast(d.message, 'error'); } catch { showToast('Translation failed', 'error'); } finally { setTranslating(false); }
  };

  const handleSave = async () => {
    if (!pointsEnglish.trim()) return showToast('Meeting points required', 'error');
    setSaving(true);
    try {
      const payload = { 
        action: editingId ? 'update' : 'create', 
        id: editingId, 
        date: formDate, 
        attendees: selectedAttendees, 
        pointsEnglish, 
        pointsMalayalam, 
        decisions: decisions.split('\n').filter(Boolean),
        tasks: editingId ? undefined : tasks // Tasks are only created on new Meeting of Minutes
      };
      
      const res = await fetch('/api/mom', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const d = await res.json();
      if (d.success) { 
        showToast(editingId ? 'Meeting Record updated' : 'Meeting Record saved'); 
        setView('list'); 
        fetchRecords(); 
        setPointsEnglish(''); 
        setPointsMalayalam(''); 
        setDecisions(''); 
        setSelectedAttendees([]); 
        setTasks([]);
        setEditingId(null); 
        setSelected(null); 
      }
      else showToast(d.message, 'error');
    } catch { showToast('Error', 'error'); } finally { setSaving(false); }
  };

  const handleEdit = () => {
    if (!selected) return;
    setFormDate(selected.date.split('T')[0]);
    setSelectedAttendees(selected.attendees || []);
    setPointsEnglish(selected.pointsEnglish);
    setPointsMalayalam(selected.pointsMalayalam);
    setDecisions(selected.decisions.join('\n'));
    setTasks([]); // Existing tasks cannot be edited from here since they are now maintenance tasks
    setEditingId(selected._id);
    setView('form');
  };

  const handleExportPDF = async () => {
    if (!selected) return;
    
    let logoData: string | null = null;
    try {
      const response = await fetch('/logo.png');
      if (response.ok) {
        const blob = await response.blob();
        logoData = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      }
    } catch (e) { console.warn(e); }

    const doc = new jsPDF();
    const dateStr = new Date(selected.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    let y = 15;
    
    const blueColor = [31, 78, 121] as [number, number, number];
    const redColor = [192, 80, 77] as [number, number, number];
    const orangeColor = [226, 107, 10] as [number, number, number];
    const grayColor = [128, 128, 128] as [number, number, number];
    
    if (logoData) doc.addImage(logoData, 'PNG', 14, y - 5, 16, 16);
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text("The Oval", 35, y + 4);
    

    
    doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
    doc.text("Minutes of Meeting", 100, y + 4);
    
    y += 12;
    doc.setDrawColor(redColor[0], redColor[1], redColor[2]);
    doc.setLineWidth(0.5);
    doc.line(14, y, 196, y);
    
    y += 10;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
    doc.text("Meeting Title:", 14, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("Monthly Operations & Facility Sync", 40, y);
    
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
    doc.text("Date:", 14, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text(dateStr, 40, y);
    

    
    y += 12;
    
    const drawSection = (title: string) => {
      y += 6;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(blueColor[0], blueColor[1], blueColor[2]);
      doc.text(title.toUpperCase(), 14, y);
      y += 8;
    };
    
    drawSection("Attendees");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    if (selected.attendees.length > 0) {
      selected.attendees.forEach((a: string) => {
        doc.text(`•  ${a}`, 18, y);
        y += 5;
      });
    } else {
      doc.text("•  None listed", 18, y);
      y += 5;
    }
    
    y += 5;
    if (selected.pointsEnglish) {
      if (y > 250) { doc.addPage(); y = 20; }
      drawSection("Discussed Points");
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0, 0, 0);
      
      const paragraphs = selected.pointsEnglish.split('\n');
      paragraphs.forEach((p: string) => {
        if (!p.trim()) {
          y += 3;
          return;
        }
        
        if (y > 275) { doc.addPage(); y = 20; }
        
        // Format numbered points (e.g. "1. Facility Maintenance") as bold blue
        const numMatch = p.match(/^(\d+\.\s+)(.*)/);
        if (numMatch) {
          doc.setFont("helvetica", "bold");
          doc.setTextColor(blueColor[0], blueColor[1], blueColor[2]);
          const wrappedTitle = doc.splitTextToSize(p, 170);
          wrappedTitle.forEach((line: string) => {
             if (y > 275) { doc.addPage(); y = 20; }
             doc.text(line, 14, y);
             y += 6;
          });
          doc.setFont("helvetica", "normal");
          doc.setTextColor(0, 0, 0);
          y += 2;
        } else {
          const wrappedPoints = doc.splitTextToSize(p, 170);
          wrappedPoints.forEach((line: string) => {
            if (y > 275) { doc.addPage(); y = 20; }
            doc.text(line, 14, y);
            y += 5;
          });
        }
      });
    }
    
    y += 5;
    if (y > 250) { doc.addPage(); y = 20; }
    drawSection("Decisions");
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    if (selected.decisions && selected.decisions.length > 0) {
      selected.decisions.forEach((d: string) => {
        if (y > 275) { doc.addPage(); y = 20; }
        const colonIndex = d.indexOf(':');
        if (colonIndex !== -1 && colonIndex < 30) {
          const boldPart = `•  ${d.substring(0, colonIndex + 1)}`;
          const fullWrapped = doc.splitTextToSize(`•  ${d}`, 170);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(blueColor[0], blueColor[1], blueColor[2]);
          doc.text(boldPart, 18, y);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(0, 0, 0);
          const firstLineRest = fullWrapped[0].substring(boldPart.length);
          doc.text(firstLineRest, 18 + doc.getTextWidth(boldPart), y);
          if (fullWrapped.length > 1) {
            for(let j = 1; j < fullWrapped.length; j++) {
              y += 5;
              doc.text(fullWrapped[j], 18, y);
            }
          }
          y += 5;
        } else {
          const wrapped = doc.splitTextToSize(`•  ${d}`, 170);
          doc.text(wrapped, 18, y);
          y += wrapped.length * 5;
        }
      });
    } else {
      doc.text("•  No decisions recorded", 18, y);
      y += 5;
    }
    

    
    if (y > 230) { doc.addPage(); }
    y = 250;
    drawSection("Signatures");
    y += 20;
    doc.setDrawColor(0, 0, 0);
    doc.line(14, y, 196, y);
    y += 5;
    doc.setFontSize(9);
    doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
    doc.text("Authorized Signatory — Facility Management", 14, y);
    
    doc.autoPrint();
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  const toggleAttendee = (name: string) => {
    if (selectedAttendees.includes(name)) {
      setSelectedAttendees(selectedAttendees.filter(a => a !== name));
    } else {
      setSelectedAttendees([...selectedAttendees, name]);
    }
  };

  const addTask = () => {
    setTasks([...tasks, { title: '', priority: 'Medium', dueDate: new Date().toISOString().split('T')[0], assigneeId: '', estimatedCost: '' }]);
  };

  const updateTask = (index: number, field: string, value: string) => {
    const newTasks = [...tasks];
    newTasks[index] = { ...newTasks[index], [field]: value };
    setTasks(newTasks);
  };

  const removeTask = (index: number) => {
    setTasks(tasks.filter((_, i) => i !== index));
  };

  return (
    <div className="page-container">
      {toast && <div className="toast-container"><div className={`toast toast-${toast.type === 'error' ? 'error' : 'success'}`}><span className="toast-icon">{toast.type === 'error' ? <X size={16} /> : <Check size={16} />}</span><div className="toast-content"><div className="toast-title">{toast.message}</div></div></div></div>}
      <div className="page-header" style={{ flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div><h1>Meeting of Minutes</h1><p className="page-subtitle">Create, translate, and manage meeting records</p></div>
        {view === 'list' && canCreate && <button className="btn btn-primary btn-md" onClick={() => { setView('form'); setEditingId(null); setPointsEnglish(''); setPointsMalayalam(''); setDecisions(''); setSelectedAttendees([]); setTasks([]); setFormDate(new Date().toISOString().split('T')[0]); }}>+ New Record</button>}
        {view === 'form' && <button className="btn btn-secondary btn-md" onClick={() => { setView('list'); setEditingId(null); }}>← Back</button>}
      </div>

      {view === 'form' ? (
        <div className="form-grid-2">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="card" style={{ padding: '24px' }}>
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label required">Meeting Date</label>
                <CustomDatePicker value={formDate} onChange={(val) => setFormDate(val)} />
              </div>
              
              <div className="form-group" style={{ marginBottom: '16px', position: 'relative' }} ref={dropdownRef}>
                <label className="form-label">Attendees (Select from Members)</label>
                
                <button
                  type="button"
                  className="form-input"
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: 'var(--bg-primary)', textAlign: 'left', minHeight: '42px', height: 'auto', padding: '8px 12px', width: '100%', border: '1px solid var(--surface-glass-border)', borderRadius: '12px' }}
                  onClick={() => setAttendeesDropdownOpen(!attendeesDropdownOpen)}
                >
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '90%' }}>
                    {selectedAttendees.length > 0 ? (
                      selectedAttendees.map(name => (
                        <span key={name} style={{ background: 'var(--accent-primary)', color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {name}
                          <X size={12} style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); toggleAttendee(name); }} />
                        </span>
                      ))
                    ) : (
                      <span style={{ color: 'var(--text-secondary)' }}>Select attendees...</span>
                    )}
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>▼</span>
                </button>

                {attendeesDropdownOpen && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                    background: 'var(--bg-primary)', border: '1px solid var(--surface-glass-border)',
                    borderRadius: '12px', marginTop: '4px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                    padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', borderBottom: '1px solid var(--surface-glass-border)' }}>
                      <input
                        type="text"
                        value={attendeeSearch}
                        onChange={(e) => setAttendeeSearch(e.target.value)}
                        placeholder="Search members..."
                        style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '13px', color: 'var(--text-primary)' }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {users.filter(u => u.name.toLowerCase().includes(attendeeSearch.toLowerCase())).length > 0 ? (
                        users.filter(u => u.name.toLowerCase().includes(attendeeSearch.toLowerCase())).map(u => {
                          const isChecked = selectedAttendees.includes(u.name);
                          return (
                            <label key={u._id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', borderRadius: '8px', background: isChecked ? 'var(--surface-secondary)' : 'transparent', cursor: 'pointer', fontSize: '13px', transition: 'background 0.2s' }} onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleAttendee(u.name)}
                                style={{ accentColor: 'var(--accent-primary)' }}
                              />
                              <span style={{ color: 'var(--text-primary)' }}>{u.name}</span>
                            </label>
                          );
                        })
                      ) : (
                        <div style={{ padding: '8px', fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center' }}>No members found</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label required">Meeting Points (English)</label>
                <textarea className="form-input form-textarea" value={pointsEnglish} onChange={(e) => setPointsEnglish(e.target.value)} rows={8} placeholder="Enter meeting discussion points..." />
              </div>
              
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">Decisions (one per line)</label>
                <textarea className="form-input form-textarea" value={decisions} onChange={(e) => setDecisions(e.target.value)} rows={4} placeholder="Decision 1&#10;Decision 2" />
              </div>
            </div>

            {!editingId && (
              <div className="card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Action Tasks</h3>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Assign follow-up tasks to maintenance module</div>
                  </div>
                  <button className="btn btn-secondary btn-sm" onClick={addTask}><Plus size={16} /> Add Task</button>
                </div>
                
                {tasks.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {tasks.map((task, idx) => (
                      <div key={idx} style={{ padding: '16px', background: 'var(--surface-secondary)', borderRadius: '12px', border: '1px solid var(--surface-glass-border)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '14px', fontWeight: 600 }}>Task #{idx + 1}</span>
                          <button className="btn btn-icon" onClick={() => removeTask(idx)} style={{ color: 'var(--status-danger)' }}><Trash2 size={16} /></button>
                        </div>
                        <input className="form-input" value={task.title} onChange={e => updateTask(idx, 'title', e.target.value)} placeholder="Task Description" />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          <div>
                            <label className="form-label" style={{ fontSize: '11px' }}>Assign To</label>
                            <CustomSelect 
                              value={task.assigneeId} 
                              onChange={(val) => updateTask(idx, 'assigneeId', val)}
                              options={users.map(u => ({ label: u.name, value: u._id }))}
                              placeholder="Select User"
                            />
                          </div>
                          <div>
                            <label className="form-label" style={{ fontSize: '11px' }}>Priority</label>
                            <CustomSelect 
                              value={task.priority} 
                              onChange={(val) => updateTask(idx, 'priority', val)}
                              options={[
                                { label: 'Urgent', value: 'Urgent' },
                                { label: 'High', value: 'High' },
                                { label: 'Medium', value: 'Medium' },
                                { label: 'Low', value: 'Low' }
                              ]}
                            />
                          </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          <div>
                            <label className="form-label" style={{ fontSize: '11px' }}>Deadline</label>
                            <CustomDatePicker value={task.dueDate} onChange={(val) => updateTask(idx, 'dueDate', val)} />
                          </div>
                          <div>
                            <label className="form-label" style={{ fontSize: '11px' }}>Estimated Cost</label>
                            <input type="number" className="form-input" value={task.estimatedCost || ''} onChange={e => updateTask(idx, 'estimatedCost', e.target.value)} placeholder="0.00" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: '24px', textAlign: 'center', background: 'var(--surface-secondary)', borderRadius: '12px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    No tasks added. Click "Add Task" to assign follow-ups.
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button className={`btn btn-primary btn-md ${saving ? 'btn-loading' : ''}`} onClick={handleSave} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Save size={16} /> Save Record</button>
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
        <div className="card"><div className="empty-state"><div className="empty-state-icon"><FileText size={48} /></div><div className="empty-state-title">No Access</div><div className="empty-state-description">You don't have permission to view Meeting Minutes history.</div></div></div>
      ) : records.length === 0 ? (
        <div className="card"><div className="empty-state"><div className="empty-state-icon"><FileText size={48} /></div><div className="empty-state-title">No meeting minutes</div><div className="empty-state-description">Create your first meeting record.</div></div></div>
      ) : (
        <div className="grid">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {records.map((r) => {
              const isSelected = selected?._id === r._id;
              return (
              <div key={r._id} className={`card ${isSelected ? 'card-active' : 'card-interactive'}`} style={{ borderColor: isSelected ? 'var(--accent-primary)' : undefined, overflow: 'hidden' }}>
                <div onClick={() => setSelected(isSelected ? null : r)} style={{ padding: 'var(--space-4)', cursor: 'pointer' }}>
                  <div style={{ fontWeight: 700 }}>{new Date(r.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 'var(--space-1)' }}>
                    {r.attendees.length} attendees · {r.decisions.length} decisions · {r.linkedTaskIds?.length || 0} tasks
                  </div>
                </div>
                
                {isSelected && (
                  <div style={{ borderTop: '1px solid var(--surface-glass-border)', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)', padding: 'var(--space-4)', paddingBottom: '0' }}>
                      <h3 style={{ fontSize: 'var(--text-sm)', display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}>
                        <FileText size={18} /> {new Date(selected.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </h3>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {canEdit && (
                          <button className="btn btn-secondary btn-sm" onClick={handleEdit} style={{ display: 'flex', alignItems: 'center', gap: '4px' }} title="Edit Record">
                            <Edit size={16} /> <span className="hide-on-mobile">Edit</span>
                          </button>
                        )}
                        {canExport && (
                          <button className="btn btn-secondary btn-sm" onClick={handleExportPDF} style={{ display: 'flex', alignItems: 'center', gap: '4px' }} title="Download PDF">
                            <Download size={16} /> <span className="hide-on-mobile">PDF</span>
                          </button>
                        )}
                      </div>
                    </div>
                    <div style={{ padding: 'var(--space-6)', overflowY: 'auto' }}>
                      <div style={{ marginBottom: 'var(--space-4)' }}><div className="form-label">Attendees</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {selected.attendees.length > 0 ? selected.attendees.map(a => (
                            <span key={a} style={{ background: 'var(--surface-secondary)', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 500 }}>{a}</span>
                          )) : <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>None listed</span>}
                        </div>
                      </div>
                      <div style={{ marginBottom: 'var(--space-4)' }}><div className="form-label">Meeting Points (English)</div><div style={{ fontSize: 'var(--text-sm)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{selected.pointsEnglish}</div></div>
                      {selected.pointsMalayalam && <div style={{ marginBottom: 'var(--space-4)' }}><div className="form-label">മലയാളം (Malayalam)</div><div style={{ fontSize: 'var(--text-sm)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{selected.pointsMalayalam}</div></div>}
                      
                      {selected.decisions && selected.decisions.length > 0 && (
                        <div style={{ marginBottom: 'var(--space-4)' }}>
                          <div className="form-label">Decisions</div>
                          <ul style={{ paddingLeft: 'var(--space-4)', fontSize: 'var(--text-sm)' }}>
                            {selected.decisions.map((d, i) => <li key={i} style={{ marginBottom: 'var(--space-1)', wordBreak: 'break-word' }}>{d}</li>)}
                          </ul>
                        </div>
                      )}
                      
                      {selected.linkedTaskIds && selected.linkedTaskIds.length > 0 && (
                        <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--surface-glass-border)' }}>
                          <div className="form-label" style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between' }}>
                            <span>Action Tasks</span>
                            <Link href="/superadmin/maintenance" style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-primary)', textDecoration: 'none' }}>
                              View in Maintenance <ExternalLink size={12} />
                            </Link>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {selected.linkedTaskIds.map((task) => {
                              const isOverdue = new Date(task.dueDate) < new Date() && task.status !== 'completed' && task.status !== 'closed';
                              return (
                                <div key={task._id} style={{ background: isOverdue ? 'rgba(239, 68, 68, 0.05)' : 'var(--surface-secondary)', border: `1px solid ${isOverdue ? 'rgba(239, 68, 68, 0.3)' : 'var(--surface-glass-border)'}`, padding: '12px', borderRadius: '12px' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                    <div style={{ fontSize: '14px', fontWeight: 600 }}>{task.title}</div>
                                    {isOverdue ? (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--status-danger)', fontWeight: 700, background: 'rgba(239, 68, 68, 0.1)', padding: '2px 8px', borderRadius: '12px' }}>
                                        <AlertTriangle size={12} /> Overdue
                                      </div>
                                    ) : (
                                      <span style={{ fontSize: '11px', fontWeight: 600, background: task.priority === 'urgent' ? 'var(--status-danger)' : task.priority === 'high' ? 'var(--status-warning)' : 'var(--status-info)', color: 'white', padding: '2px 8px', borderRadius: '12px', textTransform: 'capitalize' }}>
                                        {task.priority} Priority
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                    <div>Assignee: <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{task.assigneeId?.name || 'Unassigned'}</span></div>
                                    <div>Due: <span style={{ fontWeight: 500, color: isOverdue ? 'var(--status-danger)' : 'var(--text-primary)' }}>{new Date(task.dueDate).toLocaleDateString()}</span></div>
                                  </div>
                                  <div style={{ display: 'flex', gap: 'var(--space-4)', fontSize: '11px', background: 'var(--bg-primary)', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--surface-glass-border)', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                                    <div>Est: <span style={{ fontWeight: 600 }}>₹{task.estimatedCost || 0}</span></div>
                                    {['completed', 'closed'].includes(task.status) && (
                                      <>
                                        <div>Act: <span style={{ fontWeight: 600 }}>₹{task.actualCost || 0}</span></div>
                                        <div>
                                          Diff:{' '}
                                          <span style={{
                                            fontWeight: 700,
                                            color: (task.actualCost || 0) > (task.estimatedCost || 0) ? 'var(--status-danger)' : (task.actualCost || 0) < (task.estimatedCost || 0) ? 'var(--status-success)' : 'var(--text-secondary)'
                                          }}>
                                            {(task.actualCost || 0) > (task.estimatedCost || 0)
                                              ? `₹${(task.actualCost || 0) - (task.estimatedCost || 0)} Over`
                                              : (task.actualCost || 0) < (task.estimatedCost || 0)
                                              ? `₹${(task.estimatedCost || 0) - (task.actualCost || 0)} Under`
                                              : 'On Budget'}
                                          </span>
                                        </div>
                                      </>
                                    )}
                                    {!['completed', 'closed'].includes(task.status) && (
                                      <div style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>Pending completion</div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          </div>
        </div>
      )}
    </div>
  );
}
