'use client';

import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { getInitials } from '@/lib/utils';
import { usePermissions } from '@/components/providers/PermissionsProvider';

import { ReactNode } from 'react';
import {
  LayoutDashboard, Wallet, Package, ShoppingCart, Wrench, CheckSquare, BarChart3, FileText, Calendar, Bell, Building2, UserCircle, Camera, MessageSquare
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
  moduleKey?: string;
  requiredAction?: string;
  alternativeActions?: string[];
}

// Dashboard is always visible. Module-specific items are shown based on user's access.
const defaultNav: NavItem[] = [
  { label: 'Dashboard', href: '/committee/dashboard', icon: <LayoutDashboard size={20} /> },
];

const moduleNavItems: NavItem[] = [
  { label: 'Accounts', href: '/committee/accounts', icon: <Wallet size={20} />, moduleKey: 'accounts_finance' },
  { label: 'Inventory', href: '/committee/inventory', icon: <Package size={20} />, moduleKey: 'inventory' },
  { label: 'Sales', href: '/committee/sales', icon: <ShoppingCart size={20} />, moduleKey: 'inventory_sales' },
  { label: 'Maintenance', href: '/committee/maintenance', icon: <Wrench size={20} />, moduleKey: 'maintenance_tasks' },
  { label: 'Checklists', href: '/committee/checklists', icon: <CheckSquare size={20} />, moduleKey: 'daily_operations', alternativeActions: ['upload_checklist', 'view_checklist', 'verify_checklist', 'approve_checklist', 'reject_checklist'] },
  { label: 'Feedback & Support', href: '/committee/feedback', icon: <MessageSquare size={20} /> },
  { label: 'MOM', href: '/committee/mom', icon: <FileText size={20} />, moduleKey: 'malayalam_mom' },
  { label: 'Bookings', href: '/committee/bookings', icon: <Calendar size={20} />, moduleKey: 'bookings' },
  { label: 'Attendance', href: '/committee/attendance', icon: <Building2 size={20} />, moduleKey: 'smart_attendance' },
];

export default function CommitteeLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { hasModuleAccess, checkPermission, loading: permissionsLoading } = usePermissions();

  const visibleNavItems = [
    ...defaultNav,
    ...moduleNavItems.filter((item) => {
      if (!item.moduleKey) return true;
      if (!hasModuleAccess(item.moduleKey)) return false;
      
      if (item.requiredAction && !checkPermission(item.moduleKey, item.requiredAction)) return false;
      if (item.alternativeActions && !item.alternativeActions.some(a => checkPermission(item.moduleKey!, a))) return false;
      
      return true;
    }),
  ];

  // Bottom nav items for mobile (max 5)
  const bottomNavItems = visibleNavItems.slice(0, 5);

  const handleSignOut = () => {
    signOut({ callbackUrl: '/community/login' });
  };

  if (permissionsLoading) {
    return <div className="app-layout"><div className="loading-screen"><div className="spinner spinner-lg" /></div></div>;
  }

  return (
    <div className="app-layout">
      {sidebarOpen && (
        <div className="sidebar-overlay visible" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo"><img src="/logo.png" alt="Oval Turf Logo" className="sidebar-logo-img" /></div>
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
              {session?.user?.name ? getInitials(session.user.name) : 'U'}
            </div>
            <div className="user-info">
              <div className="user-name">{session?.user?.name || 'User'}</div>
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
              <Bell size={20} />
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
