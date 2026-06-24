'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { 
  MessageSquare, AlertTriangle, Lightbulb, Clock, CheckCircle2, 
  XCircle, Filter, Search, User, QrCode, X, Calendar, Download, Send, FileText, Plus 
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';

interface Feedback {
  _id: string;
  type: 'complaint' | 'suggestion' | 'general';
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'resolved' | 'dismissed' | 'closed';
  createdAt: string;
  submittedBy?: { _id: string, name: string, email: string };
  assignedTo?: { _id: string, name: string, email: string };
  assignedBy?: { _id: string, name: string, email: string };
  comments: Array<{ _id: string, user: { _id: string, name: string }, text: string, createdAt: string }>;
  source?: 'portal' | 'qr';
  guestName?: string;
  guestMobile?: string;
  attachmentUrl?: string;
}

interface AssignableUser {
  _id: string;
  name: string;
  email: string;
  portalType: string;
}

export default function FeedbackModule() {
  const { data: session } = useSession();
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, open, resolved
  const [search, setSearch] = useState('');
  const [showQRModal, setShowQRModal] = useState(false);
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [assignRoleFilters, setAssignRoleFilters] = useState<Record<string, string>>({});
  const [selectedItem, setSelectedItem] = useState<Feedback | null>(null);

  const getFilteredAssignableUsers = (itemId: string) => {
    const filter = assignRoleFilters[itemId] || 'all';
    if (filter === 'all') return assignableUsers;
    return assignableUsers.filter(u => u.portalType === filter);
  };

  // Submission State
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitType, setSubmitType] = useState('general');
  const [submitTitle, setSubmitTitle] = useState('');
  const [submitDescription, setSubmitDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const user = session?.user as any;
  const isAdmin = user?.portalType === 'admin' || user?.portalType === 'superadmin';

  useEffect(() => {
    fetchFeedbacks();
    if (isAdmin) {
      fetchAssignableUsers();
    }
  }, [isAdmin]);

  const fetchFeedbacks = async () => {
    try {
      const res = await fetch('/api/feedback/queue');
      const data = await res.json();
      if (data.success) {
        setFeedbacks(data.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignableUsers = async () => {
    try {
      const res = await fetch('/api/users/assignable');
      const data = await res.json();
      if (data.success) {
        // Only allow assignment to staff/admins, exclude superadmin
        setAssignableUsers(data.data.filter((u: any) => u.portalType !== 'community' && u.portalType !== 'superadmin'));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    if (!isAdmin) return;
    try {
      await fetch(`/api/feedback/queue`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'update_status', status })
      });
      fetchFeedbacks();
    } catch (e) {
      console.error(e);
    }
  };

  const assignFeedback = async (id: string, assignedTo: string) => {
    if (!isAdmin) return;
    try {
      await fetch(`/api/feedback/queue`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'assign', assignedTo })
      });
      fetchFeedbacks();
    } catch (e) {
      console.error(e);
    }
  };

  const addComment = async (id: string) => {
    if (!isAdmin) return; // Only admins can add comments based on rules
    const comment = commentInputs[id];
    if (!comment?.trim()) return;

    try {
      await fetch(`/api/feedback/queue`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'add_comment', comment })
      });
      setCommentInputs(prev => ({ ...prev, [id]: '' }));
      fetchFeedbacks();
    } catch (e) {
      console.error(e);
    }
  };

  const submitNewFeedback = async () => {
    if (!submitTitle || !submitDescription) return;
    setSubmitting(true);
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: submitType, title: submitTitle, description: submitDescription })
      });
      setShowSubmitModal(false);
      setSubmitTitle('');
      setSubmitDescription('');
      fetchFeedbacks();
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const exportCSV = () => {
    const headers = ['Type,Title,Status,Priority,Source,Submitted By,Mobile,Assigned To,Created At'];
    const rows = feedbacks.map(f => {
      const submitterName = f.source === 'qr' ? f.guestName : (f.submittedBy?.name || 'Anonymous');
      const mobile = f.guestMobile || 'N/A';
      return `"${f.type}","${f.title}","${f.status}","${f.priority}","${f.source || 'portal'}","${submitterName}","${mobile}","${f.assignedTo?.name || 'Unassigned'}","${new Date(f.createdAt).toLocaleString()}"`;
    });
    
    const csvContent = headers.concat(rows).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `feedback_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportPDF = () => {
    window.print();
  };

  const filtered = feedbacks.filter(f => {
    if (filter === 'open' && !['open', 'in_progress'].includes(f.status)) return false;
    if (filter === 'resolved' && !['resolved', 'closed', 'dismissed'].includes(f.status)) return false;
    if (search && !f.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const usersByPortal = assignableUsers.reduce((acc, user) => {
    const portal = user.portalType || 'other';
    if (!acc[portal]) acc[portal] = [];
    acc[portal].push(user);
    return acc;
  }, {} as Record<string, AssignableUser[]>);

  // Admin Dashboard Metrics
  const totalFeedback = feedbacks.length;
  const totalComplaints = feedbacks.filter(f => f.type === 'complaint').length;
  const totalSuggestions = feedbacks.filter(f => f.type === 'suggestion').length;
  const openItems = feedbacks.filter(f => f.status === 'open').length;
  const inProgressItems = feedbacks.filter(f => f.status === 'in_progress').length;
  const resolvedItems = feedbacks.filter(f => f.status === 'resolved' || f.status === 'closed').length;

  return (
    <div className="page-container">
      <div className="page-header" style={{ '@media print': { display: 'none' } } as any}>
        <div>
          <h1>{isAdmin ? 'Feedback Management Dashboard' : 'My Feedback'}</h1>
          <p className="page-subtitle">
            {isAdmin ? 'Manage complaints, suggestions, and feedback' : 'View your submitted complaints and suggestions'}
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          {!isAdmin && (
            <button 
              onClick={() => setShowSubmitModal(true)}
              className="btn btn-primary btn-md"
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Plus size={18} />
              Submit New
            </button>
          )}

          {isAdmin && (
            <>
              <button onClick={exportCSV} className="btn btn-secondary btn-md">
                <Download size={18} /> Export Excel
              </button>
              <button onClick={exportPDF} className="btn btn-secondary btn-md">
                <FileText size={18} /> Export PDF
              </button>
              <button 
                onClick={() => setShowQRModal(true)}
                className="btn btn-primary btn-md"
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <QrCode size={18} />
                Generate Turf QR
              </button>
            </>
          )}
        </div>
      </div>

      {isAdmin && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }} className="print-hide">
          <div className="stat-card">
            <div className="stat-label">Total Feedback</div>
            <div className="stat-value">{totalFeedback}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Complaints</div>
            <div className="stat-value" style={{ color: 'var(--status-danger)' }}>{totalComplaints}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Suggestions</div>
            <div className="stat-value" style={{ color: 'var(--status-warning)' }}>{totalSuggestions}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Open</div>
            <div className="stat-value">{openItems}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">In Progress</div>
            <div className="stat-value" style={{ color: 'var(--status-info)' }}>{inProgressItems}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Resolved</div>
            <div className="stat-value" style={{ color: 'var(--status-success)' }}>{resolvedItems}</div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', marginBottom: 'var(--space-6)', justifyContent: 'space-between', alignItems: 'center' }} className="print-hide">
          <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-elevated)', padding: '4px', borderRadius: 'var(--radius-lg)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <button 
              className={`btn ${filter === 'all' ? 'btn-primary' : 'btn-ghost'}`} 
              onClick={() => setFilter('all')}
              style={{ borderRadius: 'var(--radius-md)' }}
            >
              All
            </button>
            <button 
              className={`btn ${filter === 'open' ? 'btn-primary' : 'btn-ghost'}`} 
              onClick={() => setFilter('open')}
              style={{ borderRadius: 'var(--radius-md)', color: filter === 'open' ? 'white' : 'var(--status-success)' }}
            >
              Open
            </button>
            <button 
              className={`btn ${filter === 'resolved' ? 'btn-primary' : 'btn-ghost'}`} 
              onClick={() => setFilter('resolved')}
              style={{ borderRadius: 'var(--radius-md)', color: filter === 'resolved' ? 'white' : 'var(--text-secondary)' }}
            >
              Resolved
            </button>
          </div>

          <div style={{ position: 'relative', width: '300px' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search feedback..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="form-input"
              style={{ paddingLeft: '40px', background: 'var(--bg-elevated)' }}
            />
          </div>
        </div>

      {loading ? (
        <div className="loading-screen"><div className="spinner spinner-lg" /><div className="loading-text">Loading feedback...</div></div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon"><MessageSquare size={48} /></div>
            <div className="empty-state-title">No feedback found</div>
            <div className="empty-state-description">There are no submissions matching your current filters.</div>
          </div>
        </div>
      ) : (
        <div className="grid grid-4" style={{ marginBottom: 'var(--space-6)' }}>
          {filtered.map((item) => {
            const isComplaint = item.type === 'complaint';
            const isSuggestion = item.type === 'suggestion';
            const Icon = isComplaint ? AlertTriangle : isSuggestion ? Lightbulb : MessageSquare;
            const accentBg = isComplaint ? 'var(--status-danger-soft)' : isSuggestion ? 'var(--status-warning-soft)' : 'var(--status-info-soft)';
            const accentColor = isComplaint ? 'var(--status-danger)' : isSuggestion ? 'var(--status-warning)' : 'var(--status-info)';
            
            return (
              <button
                key={item._id}
                className="card stat-card inventory-item-card"
                type="button"
                onClick={() => setSelectedItem(item)}
                style={{ width: '100%', height: '100%', cursor: 'pointer', textAlign: 'left', padding: 'var(--space-5)', position: 'relative', display: 'flex', flexDirection: 'column' }}
              >
                <div className="stat-icon" style={{ background: accentBg, color: accentColor, marginBottom: 'var(--space-3)' }}>
                  <Icon size={20} />
                </div>
                
                <div style={{ flex: 1, width: '100%' }}>
                  <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.title}
                  </h3>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginBottom: 'var(--space-3)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {item.description}
                  </div>
                  
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    {item.source === 'qr' ? 'QR Guest' : (item.submittedBy?.name || 'Anonymous')} | {new Date(item.createdAt).toLocaleDateString()}
                  </div>
                </div>

                <div style={{ marginTop: 'var(--space-4)', width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className={`badge ${item.status === 'resolved' || item.status === 'closed' ? 'badge-success' : item.status === 'in_progress' ? 'badge-warning' : 'badge-neutral'} badge-dot`} style={{ fontSize: '10px', textTransform: 'uppercase' }}>
                    {item.status.replace('_', ' ')}
                  </span>

                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Selected Item Modal */}
      {selectedItem && (() => {
        const activeItem = feedbacks.find(f => f._id === selectedItem._id) || selectedItem;
        return (
          <div className="modal-backdrop" onClick={() => setSelectedItem(null)}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px' }}>
              <div className="modal-header">
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                  {activeItem.type === 'complaint' && <span className="badge badge-danger badge-dot"><AlertTriangle size={12}/> Complaint</span>}
                  {activeItem.type === 'suggestion' && <span className="badge badge-warning badge-dot"><Lightbulb size={12}/> Suggestion</span>}
                  {activeItem.type === 'general' && <span className="badge badge-info badge-dot"><MessageSquare size={12}/> General</span>}
                  
                  {isAdmin && (
                    <span className="badge" style={{ textTransform: 'uppercase', fontSize: '10px' }}>
                      {activeItem.priority}
                    </span>
                  )}

                  {activeItem.source === 'qr' && (
                    <span className="badge badge-neutral badge-dot" style={{ textTransform: 'uppercase', fontSize: '10px', background: 'var(--bg-tertiary)' }}>
                      <QrCode size={10} style={{ marginRight: '4px' }} /> Source: QR Feedback
                    </span>
                  )}

                  <span className={`badge ${activeItem.status === 'resolved' || activeItem.status === 'closed' ? 'badge-success' : activeItem.status === 'in_progress' ? 'badge-warning' : 'badge-neutral'}`} style={{ textTransform: 'uppercase', fontSize: '10px' }}>
                    {activeItem.status.replace('_', ' ')}
                  </span>
                </div>
                <button className="modal-close" onClick={() => setSelectedItem(null)}><X size={20} /></button>
              </div>

              <div className="modal-body" style={{ maxHeight: 'calc(100vh - 150px)', overflowY: 'auto' }}>

              <h3 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>{activeItem.title}</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', lineHeight: '1.6', marginBottom: 'var(--space-4)' }}>{activeItem.description}</p>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: 'var(--space-6)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={12} /> {new Date(activeItem.createdAt).toLocaleString()}</span>
                {isAdmin && (
                  activeItem.source === 'qr' ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <User size={12} /> By: {activeItem.guestName || 'Anonymous'} (QR Guest)
                      {activeItem.guestMobile && <span style={{ marginLeft: '8px' }}>📞 {activeItem.guestMobile}</span>}
                    </span>
                  ) : activeItem.submittedBy ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><User size={12} /> By: {activeItem.submittedBy.name}</span>
                  ) : (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><User size={12} /> Anonymous (System)</span>
                  )
                )}
              </div>

              {isAdmin && (
                <div style={{ background: 'var(--bg-tertiary)', padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-6)' }} className="print-hide">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-5)' }}>
                    

                    {/* Status Actions */}
                    <div style={{ flex: '1 1 200px' }}>
                      <label style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>Update Status</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {activeItem.status === 'open' && (
                          <button onClick={() => updateStatus(activeItem._id, 'in_progress')} className="btn btn-secondary btn-sm" style={{ flex: '1' }}>
                            Start Progress
                          </button>
                        )}
                        {(activeItem.status === 'open' || activeItem.status === 'in_progress') && (
                          <button onClick={() => updateStatus(activeItem._id, 'resolved')} className="btn btn-primary btn-sm" style={{ flex: '1', display: 'flex', justifyContent: 'center', gap: '6px' }}>
                            <CheckCircle2 size={14}/> Resolve
                          </button>
                        )}
                        {activeItem.status === 'resolved' && (
                          <button onClick={() => updateStatus(activeItem._id, 'closed')} className="btn btn-secondary btn-sm" style={{ flex: '1' }}>
                            Close Issue
                          </button>
                        )}
                      </div>
                    </div>

                  </div>
                </div>
              )}

              {/* Comments / Replies Section */}
              <div style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--surface-glass-border)' }}>
                <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-3)' }}>{isAdmin ? 'Admin Activity & Replies' : 'Replies from Admin'}</h4>
                
                {activeItem.comments && activeItem.comments.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                    {activeItem.comments.map((comment, idx) => (
                      <div key={idx} style={{ background: 'var(--bg-tertiary)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>{comment.user?.name || 'Unknown Admin'}</span>
                          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{new Date(comment.createdAt).toLocaleString()}</span>
                        </div>
                        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{comment.text}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-4)' }}>No replies yet.</p>
                )}

                {isAdmin && activeItem.status !== 'closed' && (
                  <div style={{ display: 'flex', gap: 'var(--space-2)' }} className="print-hide">
                    <input 
                      type="text" 
                      className="form-input form-input-sm" 
                      placeholder="Add an admin reply..." 
                      value={commentInputs[activeItem._id] || ''}
                      onChange={(e) => setCommentInputs(prev => ({ ...prev, [activeItem._id]: e.target.value }))}
                      onKeyDown={(e) => e.key === 'Enter' && addComment(activeItem._id)}
                    />
                    <button onClick={() => addComment(activeItem._id)} className="btn btn-primary btn-sm">
                      <Send size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Submit Feedback Modal */}
      {showSubmitModal && (
        <div className="modal-backdrop" onClick={() => setShowSubmitModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Submit New Form</h3>
              <button className="modal-close" onClick={() => setShowSubmitModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div className="form-group">
                <label className="form-label">Type</label>
                <div style={{ display: 'flex', background: 'var(--surface-primary)', padding: '4px', borderRadius: 'var(--radius-lg)', gap: '4px' }}>
                  <button type="button" onClick={() => setSubmitType('complaint')} style={{ flex: 1, padding: '8px', fontSize: '13px', fontWeight: 600, border: 'none', borderRadius: 'var(--radius-md)', background: submitType === 'complaint' ? 'var(--status-danger)' : 'transparent', color: submitType === 'complaint' ? 'white' : 'var(--text-secondary)', transition: 'all 0.2s', cursor: 'pointer' }}>Complaint</button>
                  <button type="button" onClick={() => setSubmitType('suggestion')} style={{ flex: 1, padding: '8px', fontSize: '13px', fontWeight: 600, border: 'none', borderRadius: 'var(--radius-md)', background: submitType === 'suggestion' ? 'var(--status-warning)' : 'transparent', color: submitType === 'suggestion' ? 'white' : 'var(--text-secondary)', transition: 'all 0.2s', cursor: 'pointer' }}>Suggestion</button>
                  <button type="button" onClick={() => setSubmitType('general')} style={{ flex: 1, padding: '8px', fontSize: '13px', fontWeight: 600, border: 'none', borderRadius: 'var(--radius-md)', background: submitType === 'general' ? 'var(--status-info)' : 'transparent', color: submitType === 'general' ? 'white' : 'var(--text-secondary)', transition: 'all 0.2s', cursor: 'pointer' }}>General</button>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Title</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={submitTitle} 
                  onChange={e => setSubmitTitle(e.target.value)} 
                  placeholder="Brief summary..."
                />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea 
                  className="form-input" 
                  rows={4}
                  value={submitDescription} 
                  onChange={e => setSubmitDescription(e.target.value)} 
                  placeholder="Please provide details..."
                />
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
              <button onClick={() => setShowSubmitModal(false)} className="btn btn-ghost" style={{ padding: '8px 24px', minWidth: '100px', fontWeight: 600 }}>Cancel</button>
              <button onClick={submitNewFeedback} disabled={!submitTitle || !submitDescription || submitting} className="btn btn-primary" style={{ padding: '8px 24px', minWidth: '120px', fontWeight: 600, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                {submitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showQRModal && (
        <div className="modal-backdrop" onClick={() => setShowQRModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Player Feedback QR</h3>
              <button className="modal-close" onClick={() => setShowQRModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-body" style={{ textAlign: 'center', padding: 'var(--space-8) var(--space-4)' }}>
              <div style={{ 
                border: '4px solid var(--text-primary)', 
                padding: 'var(--space-4)', 
                borderRadius: 'var(--radius-lg)', 
                display: 'inline-block', 
                background: 'white',
                marginBottom: 'var(--space-4)'
              }}>
                <QRCodeCanvas 
                  value={`${window.location.origin}/public-feedback`}
                  size={200}
                  level={"H"}
                  includeMargin={false}
                />
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', lineHeight: '1.5' }}>
                Print this QR code and place it at the Turf. Players can scan it to submit feedback anonymously.
              </p>
            </div>
            <div className="modal-footer" style={{ borderTop: 'none', paddingTop: 0 }}>
              <button onClick={() => window.print()} className="btn btn-primary btn-lg" style={{ width: '100%' }}>
                Print QR Code
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
