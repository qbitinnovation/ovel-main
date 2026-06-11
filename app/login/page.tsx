'use client';

import { Suspense, useState, type FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await signIn('credentials', {
        email: email.trim().toLowerCase(),
        password,
        callbackUrl,
        redirect: false,
      });

      if (result?.error) {
        setError(result.error);
        setLoading(false);
        return;
      }

      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      {/* Background decorative elements */}
      <div style={{
        position: 'fixed',
        top: '-20%',
        right: '-10%',
        width: '500px',
        height: '500px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, hsla(160, 84%, 39%, 0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'fixed',
        bottom: '-20%',
        left: '-10%',
        width: '600px',
        height: '600px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, hsla(199, 89%, 48%, 0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div className="login-card card" style={{ position: 'relative', zIndex: 1 }}>
        <div className="card-body" style={{ padding: 'var(--space-8) var(--space-8) var(--space-6)' }}>
          {/* Logo */}
          <div className="login-logo">
            <div className="login-logo-icon">🏏</div>
            <div>
              <h1 className="login-title">Oval Turf</h1>
              <p className="login-subtitle">Operations Management System</p>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="login-error" style={{ marginBottom: 'var(--space-4)' }}>
              <span>⚠</span>
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label htmlFor="login-email" className="form-label">Email Address</label>
              <input
                id="login-email"
                type="email"
                className="form-input"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="login-password" className="form-label">Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  disabled={loading}
                  style={{ paddingRight: '48px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: 'var(--text-md)',
                    padding: '4px',
                  }}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <div className="login-actions">
              <button
                type="submit"
                className={`btn btn-primary btn-lg ${loading ? 'btn-loading' : ''}`}
                disabled={loading || !email || !password}
                id="login-submit"
              >
                {loading ? '' : 'Sign In'}
              </button>
            </div>
          </form>
        </div>

        <div className="card-footer" style={{ justifyContent: 'center', padding: 'var(--space-4) var(--space-8) var(--space-6)' }}>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            Contact SuperAdmin if you need access
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
