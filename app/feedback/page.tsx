'use client';

import { useState } from 'react';
import { Send, CheckCircle2, MessageSquare, AlertTriangle, Lightbulb } from 'lucide-react';

export default function PublicFeedbackPage() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    type: 'general',
    title: '',
    description: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) throw new Error('Failed to submit feedback');
      
      setSuccess(true);
    } catch (error) {
      alert('Error submitting your feedback. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-app)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)' }}>
        <div className="card" style={{ maxWidth: '400px', width: '100%', textAlign: 'center', padding: 'var(--space-8)' }}>
          <div style={{ width: '64px', height: '64px', backgroundColor: 'var(--surface-primary)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-6)', color: 'var(--status-success)', border: '1px solid var(--status-success)' }}>
            <CheckCircle2 size={32} />
          </div>
          <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>Thank You!</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-8)', lineHeight: '1.5' }}>
            Your feedback has been submitted successfully and will be reviewed by our team.
          </p>
          <button 
            onClick={() => { setSuccess(false); setFormData({ type: 'general', title: '', description: '' }); }}
            className="btn btn-primary btn-lg"
            style={{ width: '100%' }}
          >
            Submit Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-app)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)' }}>
      <div className="card" style={{ maxWidth: '450px', width: '100%', overflow: 'hidden', padding: 0 }}>
        <div style={{ backgroundColor: 'var(--text-primary)', padding: 'var(--space-6)', textAlign: 'center' }}>
          <div style={{ width: '48px', height: '48px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-4)', color: 'white' }}>
            <MessageSquare size={24} />
          </div>
          <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'white', marginBottom: '4px' }}>Oval Turf Feedback</h1>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 'var(--text-sm)' }}>We value your opinion to help us improve</p>
        </div>

        <div style={{ padding: 'var(--space-6)' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
            <div className="form-group">
              <label className="form-label">What is this regarding?</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)' }}>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: 'complaint' })}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-3)',
                    borderRadius: 'var(--radius-md)', border: '2px solid', transition: 'all 0.2s',
                    borderColor: formData.type === 'complaint' ? 'var(--status-danger)' : 'var(--surface-glass-border)',
                    backgroundColor: formData.type === 'complaint' ? 'rgba(239, 68, 68, 0.05)' : 'transparent',
                    color: formData.type === 'complaint' ? 'var(--status-danger)' : 'var(--text-secondary)'
                  }}
                >
                  <AlertTriangle size={20} style={{ marginBottom: '8px' }} />
                  <span style={{ fontSize: '11px', fontWeight: 600 }}>Complaint</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: 'suggestion' })}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-3)',
                    borderRadius: 'var(--radius-md)', border: '2px solid', transition: 'all 0.2s',
                    borderColor: formData.type === 'suggestion' ? 'var(--status-warning)' : 'var(--surface-glass-border)',
                    backgroundColor: formData.type === 'suggestion' ? 'rgba(245, 158, 11, 0.05)' : 'transparent',
                    color: formData.type === 'suggestion' ? 'var(--status-warning)' : 'var(--text-secondary)'
                  }}
                >
                  <Lightbulb size={20} style={{ marginBottom: '8px' }} />
                  <span style={{ fontSize: '11px', fontWeight: 600 }}>Suggestion</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: 'general' })}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-3)',
                    borderRadius: 'var(--radius-md)', border: '2px solid', transition: 'all 0.2s',
                    borderColor: formData.type === 'general' ? 'var(--status-info)' : 'var(--surface-glass-border)',
                    backgroundColor: formData.type === 'general' ? 'rgba(59, 130, 246, 0.05)' : 'transparent',
                    color: formData.type === 'general' ? 'var(--status-info)' : 'var(--text-secondary)'
                  }}
                >
                  <MessageSquare size={20} style={{ marginBottom: '8px' }} />
                  <span style={{ fontSize: '11px', fontWeight: 600 }}>General</span>
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label required">Subject</label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="form-input"
                placeholder="Brief summary..."
              />
            </div>

            <div className="form-group">
              <label className="form-label required">Description</label>
              <textarea
                required
                rows={4}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="form-input"
                style={{ resize: 'none' }}
                placeholder="Please provide details..."
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`btn btn-primary btn-lg ${loading ? 'btn-loading' : ''}`}
              style={{ width: '100%', marginTop: 'var(--space-2)' }}
            >
              {!loading && <><Send size={18} /> Submit Feedback</>}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
