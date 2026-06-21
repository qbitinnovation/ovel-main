'use client';

import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { getInitials } from '@/lib/utils';

import { LayoutDashboard, CheckSquare, Wrench, Shield, Building2, Bell, Menu, Wallet, Package, ShoppingCart, BarChart3, FileText, Calendar, ClipboardList } from 'lucide-react';


export default function TurfLayout({ children }: { children: React.ReactNode }) {
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
    if (session?.user && pathname !== '/turf-manager/login') fetchAccess();
    else setLoadingAccess(false);
  }, [session, pathname]);

  if (pathname === '/turf-manager/login') {
    return <>{children}</>;
  }

  const handleSignOut = () => {
    signOut({ callbackUrl: '/turf-manager/login' });
  };

  const moduleNavItems = [
    { label: 'ഉപയോക്താക്കൾ', labelEn: 'User Management', href: '/turf-manager/users', icon: <Building2 size={20} />, moduleKey: 'user_permission' },
    { label: 'അക്കൗണ്ടുകൾ', labelEn: 'Accounts', href: '/turf-manager/accounts', icon: <Wallet size={20} />, moduleKey: 'accounts_finance' },
    { label: 'ഇൻവെൻ്ററി', labelEn: 'Inventory', href: '/turf-manager/inventory', icon: <Package size={20} />, moduleKey: 'inventory' },
    { label: 'വിൽപന', labelEn: 'Sales', href: '/turf-manager/sales', icon: <ShoppingCart size={20} />, moduleKey: 'inventory_sales' },
    { label: 'ചെക്ക്ലിസ്റ്റ്', labelEn: 'Checklist', href: '/turf-manager/checklist', icon: <CheckSquare size={20} />, moduleKey: 'daily_operations' },
    { label: 'മെയിൻറനൻസ്', labelEn: 'Tasks', href: '/turf-manager/maintenance', icon: <Wrench size={20} />, moduleKey: 'maintenance_tasks' },
    { label: 'സേഫ്റ്റി', labelEn: 'Safety', href: '/turf-manager/safety-checkout', icon: <Shield size={20} />, moduleKey: 'safety_checklist' },
    { label: 'റിപ്പോർട്ടുകൾ', labelEn: 'Reports', href: '/turf-manager/reports', icon: <BarChart3 size={20} />, moduleKey: 'reports_analytics' },
    { label: 'MOM', labelEn: 'MOM', href: '/turf-manager/mom', icon: <FileText size={20} />, moduleKey: 'malayalam_mom' },
    { label: 'ബുക്കിംഗ്', labelEn: 'Bookings', href: '/turf-manager/bookings', icon: <Calendar size={20} />, moduleKey: 'bookings' },
    { label: 'നോട്ടിഫിക്കേഷനുകൾ', labelEn: 'Notifications', href: '/turf-manager/notifications', icon: <Bell size={20} />, moduleKey: 'notifications' },
    { label: 'ഓഡിറ്റ് ലോഗ്', labelEn: 'Audit Log', href: '/turf-manager/audit-log', icon: <ClipboardList size={20} />, moduleKey: 'audit_log' },
  ];

  const visibleNavItems = [
    { label: 'ഡാഷ്ബോർഡ്', labelEn: 'Dashboard', href: '/turf-manager/dashboard', icon: <LayoutDashboard size={20} /> },
    ...moduleNavItems.filter((item) => accessibleModules.includes(item.moduleKey)),
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

      {/* Sidebar — hidden by default on mobile, visible on desktop */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo"><Building2 size={20} /></div>
          <div>
            <div className="sidebar-title">Oval Turf</div>
            <div className="sidebar-subtitle">ടർഫ് മാനേജർ</div>
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
              <Menu size={24} />
            </button>
            <div className="topbar-breadcrumb">
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                {visibleNavItems.find((n) => pathname?.startsWith(n.href))?.label || 'ഡാഷ്ബോർഡ്'}
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

      {/* Mobile Bottom Nav — Primary navigation for turf manager */}
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
