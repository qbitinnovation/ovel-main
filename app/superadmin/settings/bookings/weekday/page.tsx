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

export default function WeekdayPricingPage() {
  const [weekdayRules, setWeekdayRules] = useState<TurfSlotPriceRule[]>([]);
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
        const settings = data.data as Setting[];
        const getKey = (f: string) => f === 'turf' ? 'turf_weekday_rules' : `${f}_weekday_rules`;
        
        const newRules = { turf: [], nets_machine: [], nets_nomachine: [] } as Record<string, TurfSlotPriceRule[]>;
        
        ['turf', 'nets_machine', 'nets_nomachine'].forEach((f) => {
          const rulesSetting = settings.find((s) => s.key === getKey(f));
          if (rulesSetting && Array.isArray(rulesSetting.value) && rulesSetting.value.length > 0) {
            newRules[f] = rulesSetting.value as TurfSlotPriceRule[];
          } else {
            // Default rules
            newRules[f] = [
              { id: `rule-wd-1-${f}`, name: '6AM-10AM', startTime: '06:00', endTime: '10:00', normalPricePerHour: 2420, regularPricePerHour: 2200, dayType: 'weekdays' as const, isActive: true },
              { id: `rule-wd-2-${f}`, name: '10AM-4PM', startTime: '10:00', endTime: '16:00', normalPricePerHour: 1870, regularPricePerHour: 1650, dayType: 'weekdays' as const, isActive: true },
              { id: `rule-wd-3-${f}`, name: '4PM-6PM', startTime: '16:00', endTime: '18:00', normalPricePerHour: 2420, regularPricePerHour: 2200, dayType: 'weekdays' as const, isActive: true },
              { id: `rule-wd-4-${f}`, name: '6PM-12AM', startTime: '18:00', endTime: '00:00', normalPricePerHour: 2750, regularPricePerHour: 2530, dayType: 'weekdays' as const, isActive: true }
            ];
          }
        });
        
        setAllRules(newRules);
        setWeekdayRules(newRules[facility]);
      }
    } catch (error) {
      console.error(error);
      showToast('Failed to load weekday rules', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    setWeekdayRules(allRules[facility] || []);
  }, [facility, allRules]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Sync current facility rules before saving
      const finalRules = { ...allRules, [facility]: weekdayRules };
      
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: [
            { key: 'turf_weekday_rules', value: finalRules.turf },
            { key: 'nets_machine_weekday_rules', value: finalRules.nets_machine },
            { key: 'nets_nomachine_weekday_rules', value: finalRules.nets_nomachine },
          ]
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Weekday pricing rules saved successfully');
        setHasChanges(false);
        // Refresh values
        const getKey = (f: string) => f === 'turf' ? 'turf_weekday_rules' : `${f}_weekday_rules`;
        const rulesSetting = (data.data as Setting[]).find((s) => s.key === getKey(facility));
        if (rulesSetting && Array.isArray(rulesSetting.value)) {
          setWeekdayRules(rulesSetting.value as TurfSlotPriceRule[]);
        }
      } else {
        showToast(data.message, 'error');
      }
    } catch {
      showToast('Error saving rules', 'error');
    } finally {
      setSaving(false);
    }
  };

  const updateRule = (index: number, patch: Partial<TurfSlotPriceRule>) => {
    const updated = weekdayRules.map((rule, idx) => idx === index ? { ...rule, ...patch } : rule);
    setWeekdayRules(updated);
    setAllRules(prev => ({ ...prev, [facility]: updated }));
    setHasChanges(true);
  };

  const addRule = () => {
    const updated = [
      ...weekdayRules,
      {
        id: `rule-wd-${facility}-${Date.now()}`,
        name: 'New Weekday Slot',
        startTime: '06:00',
        endTime: '07:00',
        normalPricePerHour: 0,
        regularPricePerHour: 0,
        dayType: 'weekdays' as const,
        isActive: true,
      }
    ];
    setWeekdayRules(updated);
    setAllRules(prev => ({ ...prev, [facility]: updated }));
    setHasChanges(true);
  };

  const removeRule = (index: number) => {
    const updated = weekdayRules.filter((_, idx) => idx !== index);
    setWeekdayRules(updated);
    setAllRules(prev => ({ ...prev, [facility]: updated }));
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
          <h1>Weekday Pricing Rules</h1>
          <p className="page-subtitle">Configure slot intervals and corresponding hourly rates for normal weekdays</p>
        </div>
      </div>

      {loading ? (
        <div className="loading-screen"><div className="spinner spinner-lg" /></div>
      ) : (
        <div className="card" style={{ marginTop: 'var(--space-4)' }}>
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
                  <Calendar size={16} /> <span>{facility === 'turf' ? 'Turf' : facility === 'nets_machine' ? 'Nets (Machine)' : 'Nets (No Machine)'} Weekday Pricing Slots</span>
                </h3>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={addRule}
              >
                + Add Weekday Slot Rate
              </button>
            </div>
          </div>

          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {weekdayRules.length === 0 ? (
              <div style={{ padding: 'var(--space-8)', textAlign: 'center', fontSize: 'var(--text-sm)', color: 'var(--text-muted)', border: '1px dashed var(--surface-glass-border)', borderRadius: '8px' }}>
                No weekday pricing rules configured. Click the button above to add a weekday slot.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {weekdayRules.map((rule, index) => {
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
              All prices entered here should be inclusive of GST. Weekday pricing rules apply only to days NOT configured as weekends.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--surface-glass-border)', paddingTop: 'var(--space-4)', marginTop: 'var(--space-2)' }}>
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
        </div>
      )}
    </div>
  );
}
