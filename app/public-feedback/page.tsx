'use client';

import { useState, useEffect } from 'react';
import { Star, X } from 'lucide-react';

export default function PublicFeedbackPage() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [description, setDescription] = useState('');
  const [source, setSource] = useState('qr');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const s = params.get('source');
      if (s && ['community', 'shareholder', 'turf', 'qr'].includes(s)) {
        setSource(s);
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Require at least a rating or a description
    if (rating === 0 && !description.trim()) {
      alert("Please provide a rating or some feedback before submitting.");
      return;
    }
    
    setLoading(true);

    try {
      const type = rating <= 3 && rating > 0 ? 'complaint' : rating === 5 ? 'suggestion' : 'general';
      const title = rating > 0 ? `${rating} Star Feedback` : 'Customer Feedback';

      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          title,
          description: description || `User left a ${rating} star rating without a description.`,
          guestName: 'Anonymous Guest',
          source,
          rating
        }),
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
        <div style={{ 
          maxWidth: '400px', width: '100%', 
          backgroundColor: 'var(--bg-secondary)', 
          borderRadius: '24px', 
          padding: '40px 30px',
          textAlign: 'center',
          boxShadow: 'var(--shadow-xl)',
          position: 'relative'
        }}>
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '16px' }}>
            Thank you!
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '15px', lineHeight: '1.5', marginBottom: '24px' }}>
            Your feedback has been successfully submitted. We appreciate your time!
          </p>
          <button 
            onClick={() => { setSuccess(false); setRating(0); setDescription(''); }}
            style={{ 
              width: '100%', 
              backgroundColor: 'var(--accent-primary)', 
              color: 'white', 
              border: 'none', 
              padding: '12px', 
              borderRadius: '8px', 
              fontSize: '15px', 
              fontWeight: 600, 
              cursor: 'pointer' 
            }}
          >
            Submit Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-app)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)' }}>
      <div style={{ 
        maxWidth: '400px', width: '100%', 
        backgroundColor: 'var(--bg-secondary)', 
        borderRadius: '24px', 
        padding: '40px 30px',
        textAlign: 'center',
        boxShadow: 'var(--shadow-xl)',
        position: 'relative'
      }}>
        
        {/* Close Button Placeholder */}
        <button 
          onClick={() => window.history.back()}
          style={{ 
            position: 'absolute', 
            top: '20px', right: '20px', 
            background: 'var(--bg-tertiary)', 
            border: 'none', 
            width: '28px', height: '28px', 
            borderRadius: '50%', 
            display: 'flex', alignItems: 'center', justifyContent: 'center', 
            cursor: 'pointer',
            color: 'var(--text-secondary)'
          }}
        >
          <X size={14} strokeWidth={3} />
        </button>

        <h1 style={{ 
          fontSize: '24px', 
          fontWeight: 800, 
          color: 'var(--text-primary)', 
          lineHeight: '1.2',
          marginBottom: '16px',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          We appreciate your<br/>feedback.
        </h1>
        
        <p style={{ 
          color: 'var(--text-secondary)', 
          fontSize: '15px', 
          lineHeight: '1.5', 
          marginBottom: '32px'
        }}>
          We are always looking for ways to improve your experience. 
          Please take a moment to evaluate and tell us what you think.
        </p>

        <form onSubmit={handleSubmit}>
          {/* Star Rating */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '24px' }}>
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  cursor: 'pointer', 
                  padding: 0,
                  color: (hoverRating || rating) >= star ? 'var(--text-primary)' : 'var(--text-primary)',
                  transition: 'transform 0.1s'
                }}
              >
                <Star 
                  size={32} 
                  strokeWidth={2}
                  fill={(hoverRating || rating) >= star ? 'var(--text-primary)' : 'none'} 
                />
              </button>
            ))}
          </div>

          <div style={{ position: 'relative', marginBottom: '24px' }}>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What can we do to improve your experience?"
              style={{
                width: '100%',
                padding: '16px',
                borderRadius: '12px',
                border: '1px solid var(--surface-glass-border)',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: '14px',
                resize: 'none',
                outline: 'none',
                fontFamily: 'inherit'
              }}
            />
            {/* Optional decorative asterisk style like in the image */}
            <div style={{ position: 'absolute', top: '-6px', right: '-6px', color: 'var(--text-muted)' }}>✱</div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              backgroundColor: 'var(--accent-primary)',
              color: 'white',
              border: 'none',
              padding: '14px',
              borderRadius: '8px',
              fontSize: '15px',
              fontWeight: 600,
              cursor: 'pointer',
              opacity: loading ? 0.7 : 1,
              transition: 'opacity 0.2s'
            }}
          >
            {loading ? 'Submitting...' : 'Submit My Feedback'}
          </button>
        </form>
      </div>
    </div>
  );
}
