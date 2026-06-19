'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Calendar, ArrowLeft, ArrowRight, Save, X, Check } from 'lucide-react';

interface Setting {
  _id: string;
  key: string;
  value: unknown;
  label: string;
  category: string;
}

const VISIBLE_BOOKING_SETTING_KEYS = new Set([
  'booking_payment_reminder_days',
]);

const BOOKING_SETTING_FALLBACKS: Setting[] = [
  { _id: 'fallback-booking-payment-reminder-days', key: 'booking_payment_reminder_days', value: 3, label: 'Booking Payment Reminder (days)', category: 'bookings' },
];

export default function BookingPricingDashboard() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [changes, setChanges] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: string } | null>(null);

  const showToast = (message: string, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data.success) setSettings(data.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateChange = (key: string, value: unknown) => {
    setChanges((prev) => ({ ...prev, [key]: value }));
  };

  const getValue = (setting: Setting) => {
    if (changes[setting.key] !== undefined) return changes[setting.key];
    return setting.value;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const settingsArr = Object.entries(changes).map(([key, value]) => ({ key, value }));
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: settingsArr }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Settings saved');
        setChanges({});
        setSettings(data.data);
      } else {
        showToast(data.message, 'error');
      }
    } catch {
      showToast('Error saving settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const renderInput = (setting: Setting) => {
    const val = getValue(setting);
    if (typeof setting.value === 'boolean') {
      return (
        <div className="toggle-wrapper" onClick={() => updateChange(setting.key, !val)} style={{ cursor: 'pointer' }}>
          <div className={`toggle ${val ? 'active' : ''}`} />
          <span className="toggle-label">{val ? 'Enabled' : 'Disabled'}</span>
        </div>
      );
    }
    if (typeof setting.value === 'number') {
      const numericValue = Number(val || 0);
      return (
        <input
          type="number"
          className="form-input"
          value={numericValue === 0 ? '' : numericValue}
          placeholder="0"
          onChange={(e) => updateChange(setting.key, e.target.value === '' ? 0 : Number(e.target.value))}
          style={{ maxWidth: '120px' }}
        />
      );
    }
    if (Array.isArray(setting.value)) {
      return (
        <input
          className="form-input"
          value={Array.isArray(val) ? (val as string[]).join(', ') : ''}
          onChange={(e) => updateChange(setting.key, e.target.value.split(',').map((x) => x.trim()).filter(Boolean))}
          placeholder="Comma-separated values"
        />
      );
    }
    return <input className="form-input" value={val as string} onChange={(e) => updateChange(setting.key, e.target.value)} style={{ maxWidth: '200px' }} />;
  };

  // Get other bookings settings (like payment reminder days)
  const bookingsSettings = settings.filter((s) => s.category === 'bookings');
  const otherSettings = bookingsSettings.length > 0
    ? bookingsSettings.filter((s) => VISIBLE_BOOKING_SETTING_KEYS.has(s.key))
    : BOOKING_SETTING_FALLBACKS;

  const hasChanges = Object.keys(changes).length > 0;

  const MODULES = [
    {
      key: 'weekday',
      title: 'Weekday Pricing',
      desc: 'Define time slots, regular, and normal rates applied on weekdays.',
      href: '/superadmin/settings/bookings/weekday',
    },
    {
      key: 'weekend',
      title: 'Weekend Pricing',
      desc: 'Select weekend days of the week, and configure weekend slots and rates.',
      href: '/superadmin/settings/bookings/weekend',
    },
    {
      key: 'holiday',
      title: 'Holiday Pricing',
      desc: 'Set custom calendar dates and flat hourly rates for holiday slots.',
      href: '/superadmin/settings/bookings/holiday',
    },
  ];

  return (
    <div className="page-container">
      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type === 'error' ? 'error' : 'success'}`}>
            <span className="toast-icon">{toast.type === 'error' ? <X size={16} /> : <Check size={16} />}</span>
            <div className="toast-content"><div className="toast-title">{toast.message}</div></div>
          </div>
        </div>
      )}

      <div className="page-header" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <Link href="/superadmin/settings" className="btn btn-secondary btn-sm" style={{ padding: '4px 8px', height: 'auto' }}>
            <ArrowLeft size={16} /> Back to Settings
          </Link>
        </div>
        <div style={{ marginTop: 'var(--space-2)' }}>
          <h1>Booking Price Customization</h1>
          <p className="page-subtitle">Configure slot pricing rules for weekdays, weekends, and holidays</p>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 'var(--space-4)',
        marginTop: 'var(--space-4)'
      }}>
        {MODULES.map((mod) => (
          <div key={mod.key} className="card card-interactive" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
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
                  <Calendar size={18} style={{ color: 'var(--accent-primary)' }} />
                </div>
                <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, margin: 0 }}>{mod.title}</h3>
              </div>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 'var(--leading-normal)', margin: 0, flexGrow: 1 }}>
                {mod.desc}
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-3)' }}>
                <Link href={mod.href} className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', padding: '4px 10px', height: '28px', fontSize: 'var(--text-xs)' }}>
                  <span>Open</span>
                  <ArrowRight size={12} />
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="loading-screen" style={{ minHeight: '150px', position: 'relative' }}><div className="spinner spinner-md" /></div>
      ) : (
        otherSettings.length > 0 && (
          <div className="card" style={{ marginTop: 'var(--space-6)' }}>
            <div className="card-header">
              <h3 style={{ fontSize: 'var(--text-sm)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <Calendar size={16} /> <span>General Booking Settings</span>
              </h3>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              {otherSettings.map((setting) => (
                <div key={setting.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-4) var(--space-6)', borderBottom: '1px solid var(--border-primary)' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{setting.label}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>{setting.key}</div>
                  </div>
                  <div>{renderInput(setting)}</div>
                </div>
              ))}
              {hasChanges && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', padding: 'var(--space-4) var(--space-6)', background: 'var(--bg-tertiary)', borderTop: '1px solid var(--border-primary)' }}>
                  <button 
                    type="button"
                    className={`btn btn-primary btn-md ${saving ? 'btn-loading' : ''}`} 
                    onClick={handleSave} 
                    disabled={saving} 
                    style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Save size={16} /> Save Changes
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      )}
    </div>
  );
}
