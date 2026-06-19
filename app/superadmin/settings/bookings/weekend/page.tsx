'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, Save, Trash2, Calendar, Check, X } from 'lucide-react';
import { type TurfSlotPriceRule } from '@/lib/turf-pricing';

interface Setting {
  _id: string;
  key: string;
  value: unknown;
  label: string;
  category: string;
}

const TIME_OPTIONS = Array.from({ length: 48 }, (_, idx) => {
  const totalMinutes = idx * 30;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const value = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return { value, label: `${h12}:${m.toString().padStart(2, '0')} ${ampm}` };
});

export default function WeekendPricingPage() {
  const [weekendDays, setWeekendDays] = useState<number[]>([0, 6]);
  const [weekendRules, setWeekendRules] = useState<TurfSlotPriceRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: string } | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const showToast = (message: string, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data.success) {
        const daysSetting = (data.data as Setting[]).find((s) => s.key === 'turf_weekend_days');
        const rulesSetting = (data.data as Setting[]).find((s) => s.key === 'turf_weekend_rules');

        if (daysSetting && Array.isArray(daysSetting.value)) {
          setWeekendDays(daysSetting.value as number[]);
        }
        if (rulesSetting && Array.isArray(rulesSetting.value)) {
          setWeekendRules(rulesSetting.value as TurfSlotPriceRule[]);
        }
      }
    } catch (error) {
      console.error(error);
      showToast('Failed to load weekend configuration', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: [
            { key: 'turf_weekend_days', value: weekendDays },
            { key: 'turf_weekend_rules', value: weekendRules }
          ]
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Weekend configuration saved successfully');
        setHasChanges(false);

        // Refresh state
        const daysSetting = (data.data as Setting[]).find((s) => s.key === 'turf_weekend_days');
        const rulesSetting = (data.data as Setting[]).find((s) => s.key === 'turf_weekend_rules');
        if (daysSetting && Array.isArray(daysSetting.value)) {
          setWeekendDays(daysSetting.value as number[]);
        }
        if (rulesSetting && Array.isArray(rulesSetting.value)) {
          setWeekendRules(rulesSetting.value as TurfSlotPriceRule[]);
        }
      } else {
        showToast(data.message, 'error');
      }
    } catch {
      showToast('Error saving configuration', 'error');
    } finally {
      setSaving(false);
    }
  };

  const updateRule = (index: number, patch: Partial<TurfSlotPriceRule>) => {
    setWeekendRules((prev) => prev.map((rule, idx) => idx === index ? { ...rule, ...patch } : rule));
    setHasChanges(true);
  };

  const addRule = () => {
    setWeekendRules((prev) => [
      ...prev,
      {
        id: `rule-we-${Date.now()}`,
        name: 'New Weekend Slot',
        startTime: '06:00',
        endTime: '07:00',
        normalPricePerHour: 0,
        regularPricePerHour: 0,
        dayType: 'weekends',
        isActive: true,
      }
    ]);
    setHasChanges(true);
  };

  const removeRule = (index: number) => {
    setWeekendRules((prev) => prev.filter((_, idx) => idx !== index));
    setHasChanges(true);
  };

  const toggleWeekendDay = (dayIndex: number) => {
    setWeekendDays((prev) => {
      const isSelected = prev.includes(dayIndex);
      const next = isSelected
        ? prev.filter((d) => d !== dayIndex)
        : [...prev, dayIndex].sort();
      return next;
    });
    setHasChanges(true);
  };

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
          <Link href="/superadmin/settings/bookings" className="btn btn-secondary btn-sm" style={{ padding: '4px 8px', height: 'auto' }}>
            <ArrowLeft size={16} /> Back to Booking Pricing
          </Link>
        </div>
        <div style={{ marginTop: 'var(--space-2)' }}>
          <h1>Weekend Pricing & Days Configuration</h1>
          <p className="page-subtitle">Select which days act as weekends and define their respective slot rates</p>
        </div>
      </div>

      {loading ? (
        <div className="loading-screen"><div className="spinner spinner-lg" /></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', marginTop: 'var(--space-4)' }}>
          {/* Days selector */}
          <div className="card">
            <div className="card-header">
              <h3 style={{ fontSize: 'var(--text-sm)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', margin: 0 }}>
                <Calendar size={16} /> <span>Weekend Days Selection</span>
              </h3>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                  Selected days will bypass weekday slot rates and use weekend rules instead.
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((dayName, idx) => {
                  const isSelected = weekendDays.includes(idx);
                  return (
                    <button
                      key={dayName}
                      type="button"
                      className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => toggleWeekendDay(idx)}
                      style={{
                        borderRadius: '20px',
                        padding: '6px 16px',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {dayName}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Slots pricing */}
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
              <div>
                <h3 style={{ fontSize: 'var(--text-sm)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', margin: 0 }}>
                  <Calendar size={16} /> <span>Weekend Price Customization Slots</span>
                </h3>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={addRule}
              >
                + Add Weekend Slot Rate
              </button>
            </div>

            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {weekendRules.length === 0 ? (
                <div style={{ padding: 'var(--space-8)', textAlign: 'center', fontSize: 'var(--text-sm)', color: 'var(--text-muted)', border: '1px dashed var(--surface-glass-border)', borderRadius: '8px' }}>
                  No weekend pricing rules configured. Click the button above to add a weekend slot.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  {weekendRules.map((rule, index) => {
                    const normalPrice = Number(rule.normalPricePerHour ?? 0);
                    const regularPrice = Number(rule.regularPricePerHour ?? 0);
                    return (
                      <div key={rule.id || index} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--space-3)', alignItems: 'end', background: 'var(--bg-tertiary)', border: '1px solid var(--surface-glass-border)', borderRadius: '8px', padding: 'var(--space-3)' }}>
                        <div>
                          <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Rule Name</span>
                          <input
                            className="form-input"
                            value={rule.name || ''}
                            onChange={(e) => updateRule(index, { name: e.target.value })}
                            placeholder="Slot name"
                            style={{ height: '34px', fontSize: 'var(--text-xs)' }}
                          />
                        </div>
                        <div>
                          <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Start Time</span>
                          <select className="form-input" value={rule.startTime || '00:00'} onChange={(e) => updateRule(index, { startTime: e.target.value })} style={{ height: '34px', padding: '0 6px', fontSize: 'var(--text-xs)' }}>
                            {TIME_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>End Time</span>
                          <select className="form-input" value={rule.endTime || '01:00'} onChange={(e) => updateRule(index, { endTime: e.target.value })} style={{ height: '34px', padding: '0 6px', fontSize: 'var(--text-xs)' }}>
                            {TIME_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Normal / Hour</span>
                          <input
                            type="number"
                            min="0"
                            className="form-input"
                            value={normalPrice === 0 ? '' : normalPrice}
                            placeholder="0"
                            onChange={(e) => updateRule(index, { normalPricePerHour: e.target.value === '' ? 0 : Number(e.target.value) })}
                            style={{ height: '34px', fontSize: 'var(--text-xs)' }}
                          />
                        </div>
                        <div>
                          <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Regular / Hour</span>
                          <input
                            type="number"
                            min="0"
                            className="form-input"
                            value={regularPrice === 0 ? '' : regularPrice}
                            placeholder="0"
                            onChange={(e) => updateRule(index, { regularPricePerHour: e.target.value === '' ? 0 : Number(e.target.value) })}
                            style={{ height: '34px', fontSize: 'var(--text-xs)' }}
                          />
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', justifyContent: 'flex-end' }}>
                          <div className="toggle-wrapper" onClick={() => updateRule(index, { isActive: rule.isActive === false })} style={{ cursor: 'pointer' }}>
                            <div className={`toggle ${rule.isActive !== false ? 'active' : ''}`} />
                            <span className="toggle-label">{rule.isActive !== false ? 'Active' : 'Inactive'}</span>
                          </div>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => removeRule(index)}
                            style={{ color: 'var(--status-danger)', borderColor: 'var(--status-danger-border)', padding: '6px 8px' }}
                            title="Remove rule"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', borderTop: '1px solid var(--surface-glass-border)', paddingTop: 'var(--space-4)', marginTop: 'var(--space-2)' }}>
                All prices entered here should be inclusive of GST. Weekend pricing rules automatically apply during bookings falling on any of the selected weekend days.
              </div>
            </div>
          </div>

          {/* Page-level save changes button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
            <button 
              type="button"
              className={`btn btn-primary btn-md ${saving ? 'btn-loading' : ''}`} 
              onClick={handleSave} 
              disabled={!hasChanges || saving} 
              style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <Save size={16} /> Save Changes
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
