'use client';

import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { useState } from 'react';
import { getInitials } from '@/lib/utils';

import { LayoutDashboard, BarChart3, Wallet, Bell, Building2 } from 'lucide-react';

const navItems = [
  { label: 'Dashboard', href: '/shareholder/dashboard', icon: <LayoutDashboard size={20} /> },
  { label: 'Reports', href: '/shareholder/reports', icon: <BarChart3 size={20} /> },
  { label: 'Finance', href: '/shareholder/finance', icon: <Wallet size={20} /> },
  { label: 'Updates', href: '/shareholder/updates', icon: <Bell size={20} /> },
];

export default function ShareholderLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (pathname === '/shareholder/login') {
    return <>{children}</>;
  }

  const handleSignOut = () => {
    signOut({ callbackUrl: '/shareholder/login' });
  };

  return (
    <div className="app-layout">
      {sidebarOpen && (
        <div className="sidebar-overlay visible" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo"><Building2 size={20} /></div>
          <div>
            <div className="sidebar-title">Oval Turf</div>
            <div className="sidebar-subtitle">Shareholder Portal</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-link ${isActive ? 'active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <span className="sidebar-link-icon">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="user-menu" onClick={handleSignOut} role="button" tabIndex={0}>
            <div className="user-avatar">
              {session?.user?.name ? getInitials(session.user.name) : 'SH'}
            </div>
            <div className="user-info">
              <div className="user-name">{session?.user?.name || 'Shareholder'}</div>
              <div className="user-role">Sign Out</div>
            </div>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="mobile-menu-toggle"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="Toggle menu"
            >
              ☰
            </button>
            <div className="topbar-breadcrumb">
              <span>Shareholder</span>
              <span>/</span>
              <span style={{ color: 'var(--text-primary)' }}>
                {navItems.find((n) => pathname?.startsWith(n.href))?.label || 'Dashboard'}
              </span>
            </div>
          </div>
          <div className="topbar-right">
            <button className="notification-bell" aria-label="Notifications">
              <Bell size={20} />
            </button>
          </div>
        </header>

        {children}
      </main>

      <nav className="bottom-nav">
        <ul className="bottom-nav-items">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
            return (
              <li key={item.href}>
                <Link href={item.href} className={`bottom-nav-item ${isActive ? 'active' : ''}`}>
                  <span className="nav-icon">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
