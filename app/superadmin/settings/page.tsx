'use client';

import Link from 'next/link';
import { Wrench, Package, Bell, Globe, BarChart3, Home, Calendar, ArrowRight } from 'lucide-react';

const CATEGORIES = [
  {
    key: 'bookings',
    label: 'Booking Price Customization',
    desc: 'Configure weekday slot rates, weekend configurations, and holiday flat rates.',
    icon: <Calendar size={18} style={{ color: 'var(--accent-primary)' }} />,
    href: '/superadmin/settings/bookings',
  },

  {
    key: 'operations',
    label: 'Operations Settings',
    desc: 'Configure operating hours, slot intervals, buffers, and operational rules.',
    icon: <Wrench size={18} style={{ color: 'var(--accent-primary)' }} />,
    href: '/superadmin/settings/operations',
  },
  {
    key: 'inventory',
    label: 'Inventory Settings',
    desc: 'Manage turf equipment, stocks, alerts, and items catalog.',
    icon: <Package size={18} style={{ color: 'var(--accent-primary)' }} />,
    href: '/superadmin/settings/inventory',
  },

  {
    key: 'attendance',
    label: 'Attendance Settings',
    desc: 'Configure geofence for Smart Attendance and device verification parameters.',
    icon: <Globe size={18} style={{ color: 'var(--accent-primary)' }} />,
    href: '/superadmin/settings/attendance',
  },
  {
    key: 'general',
    label: 'General Settings',
    desc: 'Configure system-wide preferences, dynamic invoice signatures, and defaults.',
    icon: <Home size={18} style={{ color: 'var(--accent-primary)' }} />,
    href: '/superadmin/settings/general',
  },
];

export default function SettingsDashboard() {
  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Settings</h1>
          <p className="page-subtitle">Select a module to customize system settings and preferences</p>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 'var(--space-4)',
        marginTop: 'var(--space-4)'
      }}>
        {CATEGORIES.map((cat) => (
          <div key={cat.key} className="card card-interactive" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', flexGrow: 1, padding: 'var(--space-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '36px',
                  height: '36px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--accent-primary-soft)',
                  flexShrink: 0,
                }}>
                  {cat.icon}
                </div>
                <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, margin: 0 }}>{cat.label}</h3>
              </div>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 'var(--leading-normal)', margin: 0, flexGrow: 1 }}>
                {cat.desc}
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-3)' }}>
                <Link href={cat.href} className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', padding: '4px 10px', height: '28px', fontSize: 'var(--text-xs)' }}>
                  <span>Open Settings</span>
                  <ArrowRight size={12} />
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
