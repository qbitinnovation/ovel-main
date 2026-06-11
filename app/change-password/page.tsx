'use client';

import { useState, type FormEvent } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { PORTAL_ROUTES } from '@/lib/constants';
import type { PortalType } from '@/lib/constants';

export default function ChangePasswordPage() {
  const { data: session, update } = useSession();
  const router = useRouter();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const passwordStrength = getPasswordStrength(newPassword);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (passwordStrength.score < 2) {
      setError('Password is too weak. Include uppercase, lowercase, numbers, and special characters.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || 'Failed to change password');
        setLoading(false);
        return;
      }

      // Update session to remove mustChangePassword flag
      await update({ mustChangePassword: false });

      // Redirect to portal dashboard
      const portalType = (session?.user?.portalType || 'committee') as PortalType;
      const portalPath = PORTAL_ROUTES[portalType] || '/committee';
      router.push(`${portalPath}/dashboard`);
      router.refresh();
    } catch {
      setError('An unexpected error occurred');
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card card" style={{ position: 'relative', zIndex: 1 }}>
        <div className="card-body" style={{ padding: 'var(--space-8)' }}>
          <div className="login-logo">
            <div className="login-logo-icon" style={{ background: 'linear-gradient(135deg, var(--status-warning), var(--accent-primary))' }}>
              🔑
            </div>
            <div>
              <h1 className="login-title" style={{ fontSize: 'var(--text-xl)' }}>Change Password</h1>
              <p className="login-subtitle">Please set a new password to continue</p>
            </div>
          </div>

          {error && (
            <div className="login-error" style={{ marginBottom: 'var(--space-4)' }}>
              <span>⚠</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label htmlFor="current-password" className="form-label required">Current Password</label>
              <input
                id="current-password"
                type="password"
                className="form-input"
                placeholder="Enter current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                autoComplete="current-password"
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="new-password" className="form-label required">New Password</label>
              <input
                id="new-password"
                type="password"
                className="form-input"
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                autoComplete="new-password"
                disabled={loading}
              />
              {newPassword && (
                <div style={{ display: 'flex', gap: 'var(--space-1)', marginTop: 'var(--space-1)' }}>
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      style={{
                        flex: 1,
                        height: '3px',
                        borderRadius: '2px',
                        background: i < passwordStrength.score
                          ? passwordStrength.color
                          : 'var(--bg-elevated)',
                        transition: 'background 0.3s',
                      }}
                    />
                  ))}
                  <span style={{ fontSize: 'var(--text-xs)', color: passwordStrength.color, marginLeft: 'var(--space-2)', whiteSpace: 'nowrap' }}>
                    {passwordStrength.label}
                  </span>
                </div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="confirm-password" className="form-label required">Confirm New Password</label>
              <input
                id="confirm-password"
                type="password"
                className="form-input"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                disabled={loading}
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <div className="form-error">Passwords do not match</div>
              )}
            </div>

            <div className="login-actions">
              <button
                type="submit"
                className={`btn btn-primary btn-lg ${loading ? 'btn-loading' : ''}`}
                disabled={loading || !currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword}
                id="change-password-submit"
              >
                {loading ? '' : 'Change Password'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  if (!password) return { score: 0, label: '', color: '' };

  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  const labels = ['Weak', 'Fair', 'Good', 'Strong'];
  const colors = [
    'var(--status-danger)',
    'var(--status-warning)',
    'var(--accent-secondary)',
    'var(--status-success)',
  ];

  return {
    score,
    label: labels[Math.max(0, score - 1)] || 'Weak',
    color: colors[Math.max(0, score - 1)] || colors[0],
  };
}
