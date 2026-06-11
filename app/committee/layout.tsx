'use client';

import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { getInitials } from '@/lib/utils';

interface NavItem {
  label: string;
  href: string;
  icon: string;
  moduleKey?: string;
}

// Dashboard is always visible. Module-specific items are shown based on user's access.
const defaultNav: NavItem[] = [
  { label: 'Dashboard', href: '/committee/dashboard', icon: '📊' },
];

const moduleNavItems: NavItem[] = [
  { label: 'Accounts', href: '/committee/accounts', icon: '💰', moduleKey: 'accounts_finance' },
  { label: 'Inventory', href: '/committee/inventory', icon: '📦', moduleKey: 'inventory_sales' },
  { label: 'Maintenance', href: '/committee/maintenance', icon: '🔧', moduleKey: 'maintenance_tasks' },
  { label: 'Checklists', href: '/committee/checklists', icon: '✅', moduleKey: 'daily_operations' },
  { label: 'Reports', href: '/committee/reports', icon: '📈', moduleKey: 'reports_analytics' },
  { label: 'MOM', href: '/committee/mom', icon: '📝', moduleKey: 'malayalam_mom' },
  { label: 'Bookings', href: '/committee/bookings', icon: '📅', moduleKey: 'bookings' },
  { label: 'Notifications', href: '/committee/notifications', icon: '🔔', moduleKey: 'notifications' },
];

export default function CommitteeLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [accessibleModules, setAccessibleModules] = useState<string[]>([]);

  // Fetch user's accessible modules
  useEffect(() => {
    async function fetchAccess() {
      try {
        const res = await fetch('/api/users/me/access');
        if (res.ok) {
          const data = await res.json();
          setAccessibleModules(data.data?.map((m: { moduleKey: string }) => m.moduleKey) || []);
        }
      } catch (error) {
        console.error('Failed to fetch module access:', error);
      }
    }
    if (session?.user) fetchAccess();
  }, [session]);

  const visibleNavItems = [
    ...defaultNav,
    ...moduleNavItems.filter((item) => accessibleModules.includes(item.moduleKey!)),
  ];

  // Bottom nav items for mobile (max 5)
  const bottomNavItems = visibleNavItems.slice(0, 5);

  const handleSignOut = () => {
    signOut({ callbackUrl: '/login' });
  };

  return (
    <div className="app-layout">
      {sidebarOpen && (
        <div className="sidebar-overlay visible" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">🏏</div>
          <div>
            <div className="sidebar-title">Oval Turf</div>
            <div className="sidebar-subtitle">Committee Portal</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {visibleNavItems.map((item) => {
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
              {session?.user?.name ? getInitials(session.user.name) : 'CM'}
            </div>
            <div className="user-info">
              <div className="user-name">{session?.user?.name || 'Committee Member'}</div>
              <div className="user-role">Sign Out</div>
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
              <span>Committee</span>
              <span>/</span>
              <span style={{ color: 'var(--text-primary)' }}>
                {visibleNavItems.find((n) => pathname?.startsWith(n.href))?.label || 'Dashboard'}
              </span>
            </div>
          </div>
          <div className="topbar-right">
            <button className="notification-bell" aria-label="Notifications">
              🔔
              <span className="bell-badge" />
            </button>
          </div>
        </header>

        {children}
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="bottom-nav">
        <ul className="bottom-nav-items">
          {bottomNavItems.map((item) => {
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
