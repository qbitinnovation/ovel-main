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

export default function HolidayPricingPage() {
  const [holidays, setHolidays] = useState<TurfHoliday[]>([]);
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
        const holidaysSetting = (data.data as Setting[]).find((s) => s.key === 'turf_holidays');
        if (holidaysSetting && Array.isArray(holidaysSetting.value)) {
          setHolidays(holidaysSetting.value as TurfHoliday[]);
        }
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

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: [
            { key: 'turf_holidays', value: holidays }
          ]
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Holiday pricing saved successfully');
        setHasChanges(false);

        // Refresh state
        const holidaysSetting = (data.data as Setting[]).find((s) => s.key === 'turf_holidays');
        if (holidaysSetting && Array.isArray(holidaysSetting.value)) {
          setHolidays(holidaysSetting.value as TurfHoliday[]);
        }
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
    setHolidays((prev) => prev.map((hol, idx) => idx === index ? { ...hol, ...patch } : hol));
    setHasChanges(true);
  };

  const addHoliday = () => {
    setHolidays((prev) => [
      ...prev,
      {
        date: new Date().toISOString().split('T')[0],
        name: 'New Holiday',
        normalPricePerHour: 0,
        regularPricePerHour: 0,
      }
    ]);
    setHasChanges(true);
  };

  const removeHoliday = (index: number) => {
    setHolidays((prev) => prev.filter((_, idx) => idx !== index));
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
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
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
