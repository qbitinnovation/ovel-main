'use client';

import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { useState } from 'react';
import { getInitials } from '@/lib/utils';

const navItems = [
  { label: 'ഡാഷ്ബോർഡ്', labelEn: 'Dashboard', href: '/turf-manager/dashboard', icon: '🏠' },
  { label: 'ചെക്ക്ലിസ്റ്റ്', labelEn: 'Checklist', href: '/turf-manager/checklist', icon: '✅' },
  { label: 'മെയിൻറനൻസ്', labelEn: 'Tasks', href: '/turf-manager/maintenance', icon: '🔧' },
  { label: 'സേഫ്റ്റി', labelEn: 'Safety', href: '/turf-manager/safety-checkout', icon: '🛡️' },
];

export default function TurfLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = () => {
    signOut({ callbackUrl: '/login' });
  };

  return (
    <div className="app-layout">
      {sidebarOpen && (
        <div className="sidebar-overlay visible" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar — hidden by default on mobile, visible on desktop */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">🏏</div>
          <div>
            <div className="sidebar-title">Oval Turf</div>
            <div className="sidebar-subtitle">ടർഫ് മാനേജർ</div>
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
              {session?.user?.name ? getInitials(session.user.name) : 'TM'}
            </div>
            <div className="user-info">
              <div className="user-name">{session?.user?.name || 'Turf Manager'}</div>
              <div className="user-role">സൈൻ ഔട്ട്</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
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
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                {navItems.find((n) => pathname?.startsWith(n.href))?.label || 'ഡാഷ്ബോർഡ്'}
              </span>
            </div>
          </div>
          <div className="topbar-right">
            <button className="notification-bell" aria-label="Notifications">
              🔔
            </button>
          </div>
        </header>

        {children}
      </main>

      {/* Mobile Bottom Nav — Primary navigation for turf manager */}
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
