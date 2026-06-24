'use client';

import { Suspense, useMemo, useState, type FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  type AuthPortal,
  getDashboardPathForPortal,
  INVALID_LOGIN_PORTAL_MESSAGE,
  PORTAL_AUTH_RULES,
} from '@/lib/portal-auth';

const PORTAL_TITLES: Record<AuthPortal, string> = {
  superadmin: 'Super Admin Login',
  committee: 'Community Member Login',
  turf: 'Turf Manager Login',
  shareholder: 'Shareholder Login',
};

function PortalLoginContent({ portal }: { portal: AuthPortal }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultCallbackUrl = PORTAL_AUTH_RULES[portal].dashboardPath;
  const callbackUrl = useMemo(() => {
    const requestedCallbackUrl = searchParams.get('callbackUrl');
    if (!requestedCallbackUrl) return defaultCallbackUrl;

    try {
      const url = requestedCallbackUrl.startsWith('http')
        ? new URL(requestedCallbackUrl)
        : new URL(requestedCallbackUrl, 'http://localhost');

      return url.pathname.startsWith(PORTAL_AUTH_RULES[portal].portalPath)
        ? `${url.pathname}${url.search}`
        : defaultCallbackUrl;
    } catch {
      return requestedCallbackUrl.startsWith(PORTAL_AUTH_RULES[portal].portalPath)
        ? requestedCallbackUrl
        : defaultCallbackUrl;
    }
  }, [defaultCallbackUrl, portal, searchParams]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(
    searchParams.get('error') === 'InvalidPortal' ? INVALID_LOGIN_PORTAL_MESSAGE : ''
  );
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
        portal,
        callbackUrl,
        redirect: false,
      });

      if (result?.error) {
        setError(
          result.code === 'invalid_portal' || result.error === 'InvalidPortal'
            ? INVALID_LOGIN_PORTAL_MESSAGE
            : result.error === 'Configuration' || result.error === 'CredentialsSignin'
              ? 'Invalid email or password, or server database is unavailable.'
              : result.error
        );
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
      <div className="login-bg-overlay" />

      <main className="login-shell">
        <section className="login-card" aria-label={PORTAL_TITLES[portal]}>
          <div className="login-avatar-container">
            <img src="/logo.png" alt="Oval Turf Logo" className="login-logo" />
          </div>

          <div className="login-card-header">
            <h1 className="login-title">Oval Turf</h1>
            <p className="login-subtitle">{PORTAL_TITLES[portal]}</p>
          </div>

          {error && (
            <div className="login-error">
              <span>!</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label htmlFor="login-email" className="form-label">Email Address</label>
              <div className="login-input-wrap">
                <span className="login-input-icon" aria-hidden="true">@</span>
                <input
                  id="login-email"
                  type="email"
                  className="form-input"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  autoComplete="email"
                  autoFocus
                  disabled={loading}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="login-password" className="form-label">Password</label>
              <div className="login-input-wrap">
                <span className="login-input-icon login-lock-icon" aria-hidden="true" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  autoComplete="current-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="login-password-toggle"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? 'Hide' : 'Show'}
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

          <p className="login-help">Contact SuperAdmin if you need access</p>
        </section>
      </main>
    </div>
  );
}

export function PortalLoginPage({ portal }: { portal: AuthPortal }) {
  return (
    <Suspense fallback={null}>
      <PortalLoginContent portal={portal} />
    </Suspense>
  );
}
