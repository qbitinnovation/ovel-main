'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, Save, Trash2, Calendar, Check, X } from 'lucide-react';
import { type TurfHoliday } from '@/lib/turf-pricing';

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

export default function HolidayPricingPage() {
  const [facility, setFacility] = useState<'turf' | 'nets_machine' | 'nets_nomachine'>('turf');
  const [holidays, setHolidays] = useState<TurfHoliday[]>([]);
  const [allHolidays, setAllHolidays] = useState<Record<string, TurfHoliday[]>>({
    turf: [],
    nets_machine: [],
    nets_nomachine: [],
  });
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
        const settings = data.data as Setting[];
        const getKey = (f: string) => f === 'turf' ? 'turf_holidays' : `${f}_holidays`;
        const newHolidays = { turf: [], nets_machine: [], nets_nomachine: [] } as Record<string, TurfHoliday[]>;
        
        ['turf', 'nets_machine', 'nets_nomachine'].forEach((f) => {
          const holidaysSetting = settings.find((s) => s.key === getKey(f));
          if (holidaysSetting && Array.isArray(holidaysSetting.value)) {
            newHolidays[f] = holidaysSetting.value as TurfHoliday[];
          }
        });
        
        setAllHolidays(newHolidays);
        setHolidays(newHolidays[facility]);
      }
    } catch (error) {
      console.error(error);
      showToast('Failed to load holidays configuration', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    setHolidays(allHolidays[facility] || []);
  }, [facility, allHolidays]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const finalHolidays = { ...allHolidays, [facility]: holidays };

      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: [
            { key: 'turf_holidays', value: finalHolidays.turf },
            { key: 'nets_machine_holidays', value: finalHolidays.nets_machine },
            { key: 'nets_nomachine_holidays', value: finalHolidays.nets_nomachine }
          ]
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Holiday pricing saved successfully');
        setHasChanges(false);

        const settings = data.data as Setting[];
        const getKey = (f: string) => f === 'turf' ? 'turf_holidays' : `${f}_holidays`;
        const newHolidays = { turf: [], nets_machine: [], nets_nomachine: [] } as Record<string, TurfHoliday[]>;
        ['turf', 'nets_machine', 'nets_nomachine'].forEach((f) => {
          const holidaysSetting = settings.find((s) => s.key === getKey(f));
          if (holidaysSetting && Array.isArray(holidaysSetting.value)) {
            newHolidays[f] = holidaysSetting.value as TurfHoliday[];
          }
        });
        setAllHolidays(newHolidays);
        setHolidays(newHolidays[facility]);
      } else {
        showToast(data.message, 'error');
      }
    } catch {
      showToast('Error saving holidays configuration', 'error');
    } finally {
      setSaving(false);
    }
  };

  const updateHoliday = (index: number, patch: Partial<TurfHoliday>) => {
    const updated = holidays.map((hol, idx) => idx === index ? { ...hol, ...patch } : hol);
    setHolidays(updated);
    setAllHolidays(prev => ({ ...prev, [facility]: updated }));
    setHasChanges(true);
  };

  const addHoliday = () => {
    const updated = [
      ...holidays,
      {
        date: new Date().toISOString().split('T')[0],
        name: 'New Holiday',
        startTime: '00:00',
        endTime: '23:59',
        normalPricePerHour: 0,
        regularPricePerHour: 0,
      }
    ];
    setHolidays(updated);
    setAllHolidays(prev => ({ ...prev, [facility]: updated }));
    setHasChanges(true);
  };

  const removeHoliday = (index: number) => {
    const updated = holidays.filter((_, idx) => idx !== index);
    setHolidays(updated);
    setAllHolidays(prev => ({ ...prev, [facility]: updated }));
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
          <h1>Holiday Pricing Rules</h1>
          <p className="page-subtitle">Configure custom flat hourly rates for specific calendar dates</p>
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
                  <Calendar size={16} /> <span>Holiday Customization Rules</span>
                </h3>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={addHoliday}
              >
                + Add Holiday
              </button>
            </div>
          </div>

          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {holidays.length === 0 ? (
              <div style={{ padding: 'var(--space-8)', textAlign: 'center', fontSize: 'var(--text-sm)', color: 'var(--text-muted)', border: '1px dashed var(--surface-glass-border)', borderRadius: '8px' }}>
                No holidays configured. Click the button above to add a custom holiday date.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {holidays.map((holiday, index) => (
                  <div key={index} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--space-3)', alignItems: 'end', background: 'var(--bg-tertiary)', border: '1px solid var(--surface-glass-border)', borderRadius: '8px', padding: 'var(--space-3)' }}>
                    <div>
                      <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Holiday Date</span>
                      <input
                        type="date"
                        className="form-input"
                        value={holiday.date || ''}
                        onChange={(e) => updateHoliday(index, { date: e.target.value })}
                        style={{ height: '34px', fontSize: 'var(--text-xs)' }}
                      />
                    </div>
                    <div>
                      <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Holiday Name</span>
                      <input
                        className="form-input"
                        value={holiday.name || ''}
                        onChange={(e) => updateHoliday(index, { name: e.target.value })}
                        placeholder="Christmas"
                        style={{ height: '34px', fontSize: 'var(--text-xs)' }}
                      />
                    </div>
                    <div>
                      <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Start Time</span>
                      <select className="form-input" value={holiday.startTime || '00:00'} onChange={(e) => updateHoliday(index, { startTime: e.target.value })} style={{ height: '34px', padding: '0 6px', fontSize: 'var(--text-xs)' }}>
                        {TIME_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>End Time</span>
                      <select className="form-input" value={holiday.endTime || '23:59'} onChange={(e) => updateHoliday(index, { endTime: e.target.value })} style={{ height: '34px', padding: '0 6px', fontSize: 'var(--text-xs)' }}>
                        {TIME_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        <option value="23:59">11:59 PM (Midnight)</option>
                      </select>
                    </div>
                    <div>
                      <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Normal / Hour</span>
                      <input
                        type="number"
                        min="0"
                        className="form-input"
                        value={holiday.normalPricePerHour === 0 ? '' : holiday.normalPricePerHour}
                        placeholder="0"
                        onChange={(e) => updateHoliday(index, { normalPricePerHour: e.target.value === '' ? 0 : Number(e.target.value) })}
                        style={{ height: '34px', fontSize: 'var(--text-xs)' }}
                      />
                    </div>
                    <div>
                      <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Regular / Hour</span>
                      <input
                        type="number"
                        min="0"
                        className="form-input"
                        value={holiday.regularPricePerHour === 0 ? '' : holiday.regularPricePerHour}
                        placeholder="0"
                        onChange={(e) => updateHoliday(index, { regularPricePerHour: e.target.value === '' ? 0 : Number(e.target.value) })}
                        style={{ height: '34px', fontSize: 'var(--text-xs)' }}
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => removeHoliday(index)}
                        style={{ color: 'var(--status-danger)', borderColor: 'var(--status-danger-border)', padding: '6px 8px' }}
                        title="Remove holiday"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', borderTop: '1px solid var(--surface-glass-border)', paddingTop: 'var(--space-4)', marginTop: 'var(--space-2)' }}>
              All prices entered here should be inclusive of GST. Holiday rules take maximum priority over both weekday and weekend rules when the booking date matches.
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
