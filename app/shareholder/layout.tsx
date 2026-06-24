'use client';

import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { getInitials } from '@/lib/utils';

import { LayoutDashboard, BarChart3, Wallet, Bell, Building2, Package, ShoppingCart, Wrench, CheckSquare, Shield, FileText, Calendar, Menu, ClipboardList, MessageSquare } from 'lucide-react';

const defaultNav = [
  { label: 'Dashboard', href: '/shareholder/dashboard', icon: <LayoutDashboard size={20} /> },
];

const moduleNavItems = [
  { label: 'User Management', href: '/shareholder/users', icon: <Building2 size={20} />, moduleKey: 'user_permission' },
  { label: 'Accounts', href: '/shareholder/accounts', icon: <Wallet size={20} />, moduleKey: 'accounts_finance' },
  { label: 'Inventory', href: '/shareholder/inventory', icon: <Package size={20} />, moduleKey: 'inventory' },
  { label: 'Sales', href: '/shareholder/sales', icon: <ShoppingCart size={20} />, moduleKey: 'inventory_sales' },
  { label: 'Checklist', href: '/shareholder/checklist', icon: <CheckSquare size={20} />, moduleKey: 'daily_operations' },
  { label: 'Feedback & Support', href: '/shareholder/feedback', icon: <MessageSquare size={20} /> },
  { label: 'Tasks', href: '/shareholder/maintenance', icon: <Wrench size={20} />, moduleKey: 'maintenance_tasks' },
  { label: 'Safety', href: '/shareholder/safety-checkout', icon: <Shield size={20} />, moduleKey: 'safety_checklist' },
  { label: 'Reports', href: '/shareholder/reports', icon: <BarChart3 size={20} />, moduleKey: 'reports_analytics' },
  { label: 'MOM', href: '/shareholder/mom', icon: <FileText size={20} />, moduleKey: 'malayalam_mom' },
  { label: 'Bookings', href: '/shareholder/bookings', icon: <Calendar size={20} />, moduleKey: 'bookings' },
  { label: 'Complaints', href: '/shareholder/complaints', icon: <MessageSquare size={20} />, moduleKey: 'complaints' },
  { label: 'Audit Log', href: '/shareholder/audit-log', icon: <ClipboardList size={20} />, moduleKey: 'audit_log' },
];

export default function ShareholderLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [accessibleModules, setAccessibleModules] = useState<string[]>([]);
  const [loadingAccess, setLoadingAccess] = useState(true);

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
      } finally {
        setLoadingAccess(false);
      }
    }
    if (session?.user && pathname !== '/shareholder/login') fetchAccess();
    else setLoadingAccess(false);
  }, [session, pathname]);

  if (pathname === '/shareholder/login') {
    return <>{children}</>;
  }

  const handleSignOut = () => {
    signOut({ callbackUrl: '/shareholder/login' });
  };

  const visibleNavItems = [
    ...defaultNav,
    ...moduleNavItems.filter((item) => !item.moduleKey || accessibleModules.includes(item.moduleKey)),
  ];

  if (loadingAccess) {
    return (
      <div className="app-layout">
        <div className="loading-screen"><div className="spinner spinner-lg" /></div>
      </div>
    );
  }

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
                {visibleNavItems.find((n) => pathname?.startsWith(n.href))?.label || 'Dashboard'}
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
          {visibleNavItems.map((item) => {
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
