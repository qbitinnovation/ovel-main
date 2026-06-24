'use client';

import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { useState } from 'react';
import { getInitials } from '@/lib/utils';

import {
  LayoutDashboard, Users, Link as LinkIcon, Wallet, Package, ShoppingCart, Wrench, CheckSquare, FileText, Calendar,
  BarChart3, Bell, ClipboardList, Settings, Building2, Camera, Receipt, MapPin, CheckCircle, MessageSquare
} from 'lucide-react';

const navItems = [
  { label: 'Dashboard', href: '/superadmin/dashboard', icon: <LayoutDashboard size={20} /> },
  { label: 'Users', href: '/superadmin/users', icon: <Users size={20} /> },
  { label: 'Module Mapping', href: '/superadmin/modules', icon: <LinkIcon size={20} /> },
  { divider: true, label: 'Operations' },
  { label: 'Accounts', href: '/superadmin/accounts', icon: <Wallet size={20} /> },
  { label: 'Inventory', href: '/superadmin/inventory', icon: <Package size={20} /> },
  { label: 'Sales', href: '/superadmin/sales', icon: <ShoppingCart size={20} /> },
  { label: 'Maintenance', href: '/superadmin/maintenance', icon: <Wrench size={20} /> },
  { label: 'Checklists', href: '/superadmin/checklists', icon: <CheckSquare size={20} /> },
  { label: 'MOM', href: '/superadmin/mom', icon: <FileText size={20} /> },
  { label: 'Bookings', href: '/superadmin/bookings', icon: <Calendar size={20} /> },
  { divider: true, label: 'Smart Attendance' },
  { label: 'Submit Attendance', href: '/superadmin/attendance/submit', icon: <MapPin size={20} /> },
  { label: 'Verify Attendance', href: '/superadmin/attendance/verify', icon: <CheckCircle size={20} /> },
  { divider: true, label: 'System' },
  { label: 'Feedback & Support', href: '/superadmin/feedback', icon: <MessageSquare size={20} /> },
  { label: 'Audit Log', href: '/superadmin/audit-log', icon: <ClipboardList size={20} /> },
  { label: 'Settings', href: '/superadmin/settings', icon: <Settings size={20} /> },
];

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = () => {
    signOut({ callbackUrl: '/super-admin/login' });
  };

  return (
    <div className="app-layout">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="sidebar-overlay visible"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo"><Building2 size={20} /></div>
          <div>
            <div className="sidebar-title">Oval Turf</div>
            <div className="sidebar-subtitle">SuperAdmin Portal</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => {
            if ('divider' in item && item.divider) {
              return (
                <div key={`divider-${item.label}`} className="sidebar-section">
                  <span className="sidebar-section-title">{item.label}</span>
                </div>
              );
            }
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href!}
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
              {session?.user?.name ? getInitials(session.user.name) : 'SA'}
            </div>
            <div className="user-info">
              <div className="user-name">{session?.user?.name || 'SuperAdmin'}</div>
              <div className="user-role">Sign Out</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {/* Top Bar */}
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
              <span>SuperAdmin</span>
              <span>/</span>
              <span style={{ color: 'var(--text-primary)' }}>
                {navItems.find((n) => n.href && pathname?.startsWith(n.href))?.label || 'Dashboard'}
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

        {/* Page Content */}
        {children}
      </main>
    </div>
  );
}
