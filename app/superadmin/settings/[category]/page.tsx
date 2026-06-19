'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Wrench, Package, Bell, Globe, BarChart3, Home, ArrowLeft, Save, X, Check } from 'lucide-react';

interface Setting {
  _id: string;
  key: string;
  value: unknown;
  label: string;
  category: string;
}

const CATEGORY_INFO: Record<string, { label: string; icon: React.ReactNode; desc: string }> = {
  operations: { label: 'Operations Settings', icon: <Wrench size={18} />, desc: 'Configure daily timings, intervals, buffers, and system operational bounds.' },
  inventory: { label: 'Inventory Settings', icon: <Package size={18} />, desc: 'Manage default stock levels, supplier preferences, and items metrics.' },
  notifications: { label: 'Notification Settings', icon: <Bell size={18} />, desc: 'Set email servers, SMS alerts timings, and push reminder frequencies.' },
  language: { label: 'Language Settings', icon: <Globe size={18} />, desc: 'Manage translations, default timezone formats, and localization details.' },
  reports: { label: 'Reports Settings', icon: <BarChart3 size={18} />, desc: 'Customize export filters, charts configurations, and report frequencies.' },
  general: { label: 'General Settings', icon: <Home size={18} />, desc: 'Configure general profile defaults, support contacts, and basic web assets.' },
};

export default function CategorySettingsPage() {
  const params = useParams();
  const router = useRouter();
  const category = (params?.category as string) || '';

  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [changes, setChanges] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: string } | null>(null);

  const info = CATEGORY_INFO[category] || { label: `${category.charAt(0).toUpperCase()}${category.slice(1)} Settings`, icon: <Wrench size={18} />, desc: `Configure settings for ${category}.` };

  const showToast = (message: string, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data.success) {
        setSettings(data.data);
      } else {
        showToast(data.message || 'Failed to load settings', 'error');
      }
    } catch (error) {
      console.error(error);
      showToast('Failed to load settings', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!category) return;
    fetchSettings();
  }, [category, fetchSettings]);

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
        showToast('Settings saved successfully');
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

  const categorySettings = settings.filter((s) => s.category === category);
  const categoryHasChanges = categorySettings.some((setting) => changes[setting.key] !== undefined);

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
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            {info.icon} <span>{info.label}</span>
          </h1>
          <p className="page-subtitle">{info.desc}</p>
        </div>
      </div>

      {loading ? (
        <div className="loading-screen"><div className="spinner spinner-lg" /></div>
      ) : (
        <div className="card" style={{ marginTop: 'var(--space-4)' }}>
          <div className="card-body" style={{ padding: 0 }}>
            {categorySettings.length === 0 ? (
              <div style={{ padding: 'var(--space-8)', textAlign: 'center', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                No settings found in this category.
              </div>
            ) : (
              <>
                {categorySettings.map((setting) => (
                  <div key={setting.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-4) var(--space-6)', borderBottom: '1px solid var(--border-primary)' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{setting.label}</div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>{setting.key}</div>
                    </div>
                    <div>{renderInput(setting)}</div>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'flex-end', padding: 'var(--space-4) var(--space-6)', background: 'var(--bg-tertiary)', borderTop: '1px solid var(--border-primary)' }}>
                  <button 
                    type="button"
                    className={`btn btn-primary btn-md ${saving ? 'btn-loading' : ''}`} 
                    onClick={handleSave} 
                    disabled={!categoryHasChanges || saving} 
                    style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Save size={16} /> Save Changes
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
