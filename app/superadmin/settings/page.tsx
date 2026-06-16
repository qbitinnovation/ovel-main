'use client';
import { useState, useEffect, useCallback } from 'react';
import { Wrench, Package, Bell, Globe, BarChart3, Home, X, Check, Save } from 'lucide-react';

interface Setting { _id: string; key: string; value: unknown; label: string; category: string; }

const CATEGORY_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  operations: { label: 'Operations', icon: <Wrench size={16} /> },
  inventory: { label: 'Inventory', icon: <Package size={16} /> },
  notifications: { label: 'Notifications', icon: <Bell size={16} /> },
  language: { label: 'Language', icon: <Globe size={16} /> },
  reports: { label: 'Reports', icon: <BarChart3 size={16} /> },
  general: { label: 'General', icon: <Home size={16} /> },
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [changes, setChanges] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: string } | null>(null);
  const showToast = (m: string, t = 'success') => { setToast({ message: m, type: t }); setTimeout(() => setToast(null), 3500); };

  const fetchSettings = useCallback(async () => {
    try { const res = await fetch('/api/settings'); const d = await res.json(); if (d.success) setSettings(d.data); } catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const updateChange = (key: string, value: unknown) => setChanges((prev) => ({ ...prev, [key]: value }));
  const getValue = (s: Setting) => changes[s.key] !== undefined ? changes[s.key] : s.value;
  const hasChanges = Object.keys(changes).length > 0;

  const handleSave = async () => {
    setSaving(true);
    try {
      const settingsArr = Object.entries(changes).map(([key, value]) => ({ key, value }));
      const res = await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings: settingsArr }) });
      const d = await res.json();
      if (d.success) { showToast('Settings saved'); setChanges({}); setSettings(d.data); }
      else showToast(d.message, 'error');
    } catch { showToast('Error', 'error'); } finally { setSaving(false); }
  };

  const categories = [...new Set(settings.map((s) => s.category))];

  const renderInput = (s: Setting) => {
    const val = getValue(s);
    if (typeof s.value === 'boolean') {
      return (
        <div className="toggle-wrapper" onClick={() => updateChange(s.key, !val)} style={{ cursor: 'pointer' }}>
          <div className={`toggle ${val ? 'active' : ''}`} />
          <span className="toggle-label">{val ? 'Enabled' : 'Disabled'}</span>
        </div>
      );
    }
    if (typeof s.value === 'number') {
      return <input type="number" className="form-input" value={val as number} onChange={(e) => updateChange(s.key, Number(e.target.value))} style={{ maxWidth: '120px' }} />;
    }
    if (Array.isArray(s.value)) {
      return <input className="form-input" value={Array.isArray(val) ? (val as string[]).join(', ') : ''} onChange={(e) => updateChange(s.key, e.target.value.split(',').map((x) => x.trim()).filter(Boolean))} placeholder="Comma-separated values" />;
    }
    return <input className="form-input" value={val as string} onChange={(e) => updateChange(s.key, e.target.value)} style={{ maxWidth: '200px' }} />;
  };

  return (
    <div className="page-container">
      {toast && <div className="toast-container"><div className={`toast toast-${toast.type === 'error' ? 'error' : 'success'}`}><span className="toast-icon">{toast.type === 'error' ? <X size={16} /> : <Check size={16} />}</span><div className="toast-content"><div className="toast-title">{toast.message}</div></div></div></div>}
      <div className="page-header">
        <div><h1>Settings</h1><p className="page-subtitle">Configure system-wide preferences and defaults</p></div>
        {hasChanges && <button className={`btn btn-primary btn-md ${saving ? 'btn-loading' : ''}`} onClick={handleSave} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Save size={16} /> Save Changes</button>}
      </div>

      {loading ? <div className="loading-screen"><div className="spinner spinner-lg" /></div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {categories.map((cat) => {
            const catSettings = settings.filter((s) => s.category === cat);
            const catInfo = CATEGORY_LABELS[cat] || { label: cat, icon: <Wrench size={16} /> };
            return (
              <div key={cat} className="card">
                <div className="card-header">
                  <h3 style={{ fontSize: 'var(--text-sm)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    {catInfo.icon} <span>{catInfo.label}</span>
                  </h3>
                </div>
                <div className="card-body" style={{ padding: 0 }}>
                  {catSettings.map((s) => (
                    <div key={s.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-4) var(--space-6)', borderBottom: '1px solid var(--border-primary)' }}>
                      <div><div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{s.label}</div><div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>{s.key}</div></div>
                      <div>{renderInput(s)}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
