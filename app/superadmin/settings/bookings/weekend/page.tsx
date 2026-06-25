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
  const [facility, setFacility] = useState<'turf' | 'nets_machine' | 'nets_nomachine'>('turf');
  const [allRules, setAllRules] = useState<Record<string, TurfSlotPriceRule[]>>({
    turf: [],
    nets_machine: [],
    nets_nomachine: [],
  });

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
        if (daysSetting && Array.isArray(daysSetting.value)) {
          setWeekendDays(daysSetting.value as number[]);
        }

        const settings = data.data as Setting[];
        const getKey = (f: string) => f === 'turf' ? 'turf_weekend_rules' : `${f}_weekend_rules`;
        
        const newRules = { turf: [], nets_machine: [], nets_nomachine: [] } as Record<string, TurfSlotPriceRule[]>;
        
        ['turf', 'nets_machine', 'nets_nomachine'].forEach((f) => {
          const rulesSetting = settings.find((s) => s.key === getKey(f));
          if (rulesSetting && Array.isArray(rulesSetting.value)) {
            newRules[f] = rulesSetting.value as TurfSlotPriceRule[];
          }
        });
        
        setAllRules(newRules);
        setWeekendRules(newRules[facility]);
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

  useEffect(() => {
    setWeekendRules(allRules[facility] || []);
  }, [facility, allRules]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const finalRules = { ...allRules, [facility]: weekendRules };

      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: [
            { key: 'turf_weekend_days', value: weekendDays },
            { key: 'turf_weekend_rules', value: finalRules.turf },
            { key: 'nets_machine_weekend_rules', value: finalRules.nets_machine },
            { key: 'nets_nomachine_weekend_rules', value: finalRules.nets_nomachine }
          ]
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Weekend configuration saved successfully');
        setHasChanges(false);

        const daysSetting = (data.data as Setting[]).find((s) => s.key === 'turf_weekend_days');
        if (daysSetting && Array.isArray(daysSetting.value)) {
          setWeekendDays(daysSetting.value as number[]);
        }
        
        const settings = data.data as Setting[];
        const getKey = (f: string) => f === 'turf' ? 'turf_weekend_rules' : `${f}_weekend_rules`;
        const newRules = { turf: [], nets_machine: [], nets_nomachine: [] } as Record<string, TurfSlotPriceRule[]>;
        ['turf', 'nets_machine', 'nets_nomachine'].forEach((f) => {
          const rulesSetting = settings.find((s) => s.key === getKey(f));
          if (rulesSetting && Array.isArray(rulesSetting.value)) {
            newRules[f] = rulesSetting.value as TurfSlotPriceRule[];
          }
        });
        setAllRules(newRules);
        setWeekendRules(newRules[facility]);
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
    const updated = weekendRules.map((rule, idx) => idx === index ? { ...rule, ...patch } : rule);
    setWeekendRules(updated);
    setAllRules(prev => ({ ...prev, [facility]: updated }));
    setHasChanges(true);
  };

  const addRule = () => {
    const updated = [
      ...weekendRules,
      {
        id: `rule-we-${facility}-${Date.now()}`,
        name: 'New Weekend Slot',
        startTime: '06:00',
        endTime: '07:00',
        normalPricePerHour: 0,
        regularPricePerHour: 0,
        dayType: 'weekends' as const,
        isActive: true,
      }
    ];
    setWeekendRules(updated);
    setAllRules(prev => ({ ...prev, [facility]: updated }));
    setHasChanges(true);
  };

  const removeRule = (index: number) => {
    const updated = weekendRules.filter((_, idx) => idx !== index);
    setWeekendRules(updated);
    setAllRules(prev => ({ ...prev, [facility]: updated }));
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
            <div className="card-header" style={{ paddingBottom: 0 }}>
              <div style={{ display: 'flex', gap: 'var(--space-6)', borderBottom: '1px solid var(--border-primary)', marginBottom: 'var(--space-4)' }}>
                <div 
                  onClick={() => setFacility('turf')}
                  style={{ padding: '0 0 var(--space-3) 0', cursor: 'pointer', fontWeight: 600, borderBottom: facility === 'turf' ? '2px solid var(--accent-primary)' : '2px solid transparent', color: facility === 'turf' ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                  Turf Booking
                </div>
                <div 
                  onClick={() => setFacility('nets_machine')}
                  style={{ padding: '0 0 var(--space-3) 0', cursor: 'pointer', fontWeight: 600, borderBottom: facility === 'nets_machine' ? '2px solid var(--accent-primary)' : '2px solid transparent', color: facility === 'nets_machine' ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                  Nets (With Machine)
                </div>
                <div 
                  onClick={() => setFacility('nets_nomachine')}
                  style={{ padding: '0 0 var(--space-3) 0', cursor: 'pointer', fontWeight: 600, borderBottom: facility === 'nets_nomachine' ? '2px solid var(--accent-primary)' : '2px solid transparent', color: facility === 'nets_nomachine' ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                  Nets (Without Machine)
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)', paddingBottom: 'var(--space-4)' }}>
                <div>
                  <h3 style={{ fontSize: 'var(--text-sm)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', margin: 0 }}>
                    <Calendar size={16} /> <span>{facility === 'turf' ? 'Turf' : facility === 'nets_machine' ? 'Nets (Machine)' : 'Nets (No Machine)'} Weekend Pricing Slots</span>
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
