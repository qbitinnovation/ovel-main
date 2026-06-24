'use client';

import { useState, useEffect } from 'react';
import { MessageSquare, AlertCircle, CheckCircle, Clock } from 'lucide-react';

export default function ComplaintsModule({ canSubmit, canView, canResolve, canViewAnalytics }: any) {
  const [complaints, setComplaints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState(canSubmit ? 'submit' : 'list');
  
  // Submit Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('general');
  const [priority, setPriority] = useState('medium');
  const [submitting, setSubmitting] = useState(false);

  const fetchComplaints = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/complaints');
      const data = await res.json();
      if (data.success) {
        setComplaints(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canView || canResolve || canViewAnalytics) {
      fetchComplaints();
    } else {
      setLoading(false);
    }
  }, [canView, canResolve, canViewAnalytics]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, category, priority })
      });
      if (res.ok) {
        alert('Complaint submitted successfully');
        setTitle('');
        setDescription('');
        setActiveTab('list');
        fetchComplaints();
      } else {
        alert('Failed to submit complaint');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolve = async (id: string) => {
    const note = prompt('Enter resolution note:');
    if (note === null) return;

    try {
      const res = await fetch('/api/complaints', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'resolved', resolutionNote: note })
      });
      if (res.ok) {
        fetchComplaints();
      } else {
        alert('Failed to resolve');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Analytics
  const totalComplaints = complaints.length;
  const resolvedComplaints = complaints.filter(c => c.status === 'resolved');
  const avgResolutionTimeMs = resolvedComplaints.length > 0 
    ? resolvedComplaints.reduce((sum, c) => sum + (c.resolutionTimeMs || 0), 0) / resolvedComplaints.length 
    : 0;
  const avgHours = (avgResolutionTimeMs / (1000 * 60 * 60)).toFixed(1);

  return (
    <div className="page-container" id="report-content">
      <div className="page-header">
        <h1 className="page-title">Complaints & Feedback</h1>
        <p className="page-subtitle">Submit, track, and resolve internal issues and feedback.</p>
      </div>

      <div className="tabs" style={{ marginBottom: '1.5rem' }}>
        {canSubmit && (
          <button 
            className={`tab ${activeTab === 'submit' ? 'active' : ''}`}
            onClick={() => setActiveTab('submit')}
          >
            Submit Complaint
          </button>
        )}
        {(canView || canResolve) && (
          <button 
            className={`tab ${activeTab === 'list' ? 'active' : ''}`}
            onClick={() => setActiveTab('list')}
          >
            Active Tickets
          </button>
        )}
        {canViewAnalytics && (
          <button 
            className={`tab ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            Analytics
          </button>
        )}
      </div>

      {activeTab === 'submit' && (
        <form className="card" onSubmit={handleSubmit} style={{ maxWidth: '600px' }}>
          <h2 className="card-title">New Complaint</h2>
          <div className="form-group">
            <label>Title</label>
            <input type="text" className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label>Category</label>
              <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="general">General</option>
                <option value="maintenance">Maintenance</option>
                <option value="finance">Finance</option>
                <option value="staff">Staff/HR</option>
              </select>
            </div>
            <div>
              <label>Priority</label>
              <select className="input" value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea className="input" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} required></textarea>
          </div>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Complaint'}
          </button>
        </form>
      )}

      {activeTab === 'list' && (
        <div className="card">
          <h2 className="card-title">Ticket List</h2>
          {loading ? <p>Loading...</p> : complaints.length === 0 ? <p>No complaints found.</p> : (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Ticket</th>
                    <th>Category</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {complaints.map(c => (
                    <tr key={c._id}>
                      <td>{new Date(c.createdAt).toLocaleDateString()}</td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{c.title}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{c.description}</div>
                      </td>
                      <td><span className="badge badge-secondary" style={{ textTransform: 'capitalize' }}>{c.category}</span></td>
                      <td>
                        <span className={`badge badge-${c.status === 'resolved' ? 'success' : c.status === 'open' ? 'danger' : 'warning'}`}>
                          {c.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td>
                        {canResolve && c.status !== 'resolved' && (
                          <button className="btn btn-primary btn-sm" onClick={() => handleResolve(c._id)}>Resolve</button>
                        )}
                        {c.status === 'resolved' && (
                          <span style={{ fontSize: '0.8rem', color: 'var(--success-600)' }}>{c.resolutionNote}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'analytics' && (
        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-icon" style={{ background: 'var(--primary-50)', color: 'var(--primary-500)' }}>
              <MessageSquare size={24} />
            </div>
            <div className="metric-content">
              <h3 className="metric-title">Total Tickets Received</h3>
              <p className="metric-value">{totalComplaints}</p>
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-icon" style={{ background: 'var(--success-50)', color: 'var(--success-500)' }}>
              <CheckCircle size={24} />
            </div>
            <div className="metric-content">
              <h3 className="metric-title">Tickets Resolved</h3>
              <p className="metric-value">{resolvedComplaints.length}</p>
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-icon" style={{ background: 'var(--warning-50)', color: 'var(--warning-500)' }}>
              <Clock size={24} />
            </div>
            <div className="metric-content">
              <h3 className="metric-title">Avg Resolution Time</h3>
              <p className="metric-value">{avgHours} hours</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
