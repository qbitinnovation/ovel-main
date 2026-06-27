'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft, Save, Trash2, Calendar, Check, X, Clock, HelpCircle } from 'lucide-react';
import { type TurfSlotPriceRule } from '@/lib/turf-pricing';
import { CustomTimePicker } from '@/components/ui/CustomTimePicker';

interface Setting {
  _id: string;
  key: string;
  value: unknown;
  label: string;
  category: string;
}

interface UnifiedTurfPriceRule {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  isActive: boolean;
  turfNormal: number;
  turfRegular: number;
  netsMachineNormal: number;
  netsMachineRegular: number;
  netsNoMachineNormal: number;
  netsNoMachineRegular: number;
}

const DEFAULT_WEEKDAY_SLOTS = [
  { startTime: '06:00', endTime: '10:00', name: '6AM-10AM', turfN: 2420, turfR: 2200, machN: 2420, machR: 2200, noMachN: 2420, noMachR: 2200 },
  { startTime: '10:00', endTime: '16:00', name: '10AM-4PM', turfN: 1870, turfR: 1650, machN: 1870, machR: 1650, noMachN: 1870, noMachR: 1650 },
  { startTime: '16:00', endTime: '18:00', name: '4PM-6PM', turfN: 2420, turfR: 2200, machN: 2420, machR: 2200, noMachN: 2420, noMachR: 2200 },
  { startTime: '18:00', endTime: '00:00', name: '6PM-12AM', turfN: 2750, turfR: 2530, machN: 2750, machR: 2530, noMachN: 2750, noMachR: 2530 }
];

export default function WeekdayPricingPage() {
  const [unifiedRules, setUnifiedRules] = useState<UnifiedTurfPriceRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: string } | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const showToast = (message: string, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const mergeRules = (
    turfRules: TurfSlotPriceRule[],
    netsMachineRules: TurfSlotPriceRule[],
    netsNoMachineRules: TurfSlotPriceRule[]
  ): UnifiedTurfPriceRule[] => {
    const slotsMap = new Map<string, { startTime: string; endTime: string }>();

    const addSlots = (rules: TurfSlotPriceRule[]) => {
      if (!Array.isArray(rules)) return;
      rules.forEach(r => {
        const key = `${r.startTime}-${r.endTime}`;
        if (!slotsMap.has(key)) {
          slotsMap.set(key, { startTime: r.startTime, endTime: r.endTime });
        }
      });
    };

    addSlots(turfRules);
    addSlots(netsMachineRules);
    addSlots(netsNoMachineRules);

    // If no rules exist at all across any facility, use default rules
    if (slotsMap.size === 0) {
      return DEFAULT_WEEKDAY_SLOTS.map((d, idx) => ({
        id: `default-wd-${idx}`,
        name: d.name,
        startTime: d.startTime,
        endTime: d.endTime,
        isActive: true,
        turfNormal: d.turfN,
        turfRegular: d.turfR,
        netsMachineNormal: d.machN,
        netsMachineRegular: d.machR,
        netsNoMachineNormal: d.noMachN,
        netsNoMachineRegular: d.noMachR
      }));
    }

    const unified: UnifiedTurfPriceRule[] = [];
    let index = 0;

    slotsMap.forEach(({ startTime, endTime }) => {
      const turfRule = turfRules?.find(r => r.startTime === startTime && r.endTime === endTime);
      const machineRule = netsMachineRules?.find(r => r.startTime === startTime && r.endTime === endTime);
      const noMachineRule = netsNoMachineRules?.find(r => r.startTime === startTime && r.endTime === endTime);

      const name = turfRule?.name || machineRule?.name || noMachineRule?.name || `${startTime}-${endTime}`;
      const isActive = turfRule?.isActive !== false || machineRule?.isActive !== false || noMachineRule?.isActive !== false;

      unified.push({
        id: turfRule?.id || machineRule?.id || noMachineRule?.id || `unified-slot-${index++}`,
        name,
        startTime,
        endTime,
        isActive,
        turfNormal: turfRule?.normalPricePerHour ?? 0,
        turfRegular: turfRule?.regularPricePerHour ?? 0,
        netsMachineNormal: machineRule?.normalPricePerHour ?? 0,
        netsMachineRegular: machineRule?.regularPricePerHour ?? 0,
        netsNoMachineNormal: noMachineRule?.normalPricePerHour ?? 0,
        netsNoMachineRegular: noMachineRule?.regularPricePerHour ?? 0
      });
    });

    return unified.sort((a, b) => a.startTime.localeCompare(b.startTime));
  };

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data.success) {
        const settings = data.data as Setting[];
        const turfRules = settings.find((s) => s.key === 'turf_weekday_rules')?.value as TurfSlotPriceRule[] || [];
        const machineRules = settings.find((s) => s.key === 'nets_machine_weekday_rules')?.value as TurfSlotPriceRule[] || [];
        const nomachineRules = settings.find((s) => s.key === 'nets_nomachine_weekday_rules')?.value as TurfSlotPriceRule[] || [];

        const merged = mergeRules(turfRules, machineRules, nomachineRules);
        setUnifiedRules(merged);
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

  const handleSave = async () => {
    setSaving(true);
    try {
      const turfRules: TurfSlotPriceRule[] = [];
      const netsMachineRules: TurfSlotPriceRule[] = [];
      const netsNoMachineRules: TurfSlotPriceRule[] = [];

      unifiedRules.forEach((ur, idx) => {
        const baseId = ur.id.includes('unified-slot') || ur.id.includes('default-wd')
          ? `rule-wd-${idx}-${Date.now()}`
          : ur.id;

        turfRules.push({
          id: `${baseId}-turf`,
          name: ur.name,
          startTime: ur.startTime,
          endTime: ur.endTime,
          normalPricePerHour: ur.turfNormal,
          regularPricePerHour: ur.turfRegular,
          dayType: 'weekdays',
          isActive: ur.isActive
        });

        netsMachineRules.push({
          id: `${baseId}-machine`,
          name: ur.name,
          startTime: ur.startTime,
          endTime: ur.endTime,
          normalPricePerHour: ur.netsMachineNormal,
          regularPricePerHour: ur.netsMachineRegular,
          dayType: 'weekdays',
          isActive: ur.isActive
        });

        netsNoMachineRules.push({
          id: `${baseId}-nomachine`,
          name: ur.name,
          startTime: ur.startTime,
          endTime: ur.endTime,
          normalPricePerHour: ur.netsNoMachineNormal,
          regularPricePerHour: ur.netsNoMachineRegular,
          dayType: 'weekdays',
          isActive: ur.isActive
        });
      });

      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: [
            { key: 'turf_weekday_rules', value: turfRules },
            { key: 'nets_machine_weekday_rules', value: netsMachineRules },
            { key: 'nets_nomachine_weekday_rules', value: netsNoMachineRules },
          ]
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast('Weekday pricing rules saved successfully');
        setHasChanges(false);
        fetchSettings(); // Refresh
      } else {
        showToast(data.message, 'error');
      }
    } catch {
      showToast('Error saving rules', 'error');
    } finally {
      setSaving(false);
    }
  };

  const updateRule = (index: number, patch: Partial<UnifiedTurfPriceRule>) => {
    const updated = unifiedRules.map((rule, idx) => idx === index ? { ...rule, ...patch } : rule);
    setUnifiedRules(updated);
    setHasChanges(true);
  };

  const addRule = () => {
    const updated = [
      ...unifiedRules,
      {
        id: `unified-slot-${Date.now()}`,
        name: 'New Weekday Slot',
        startTime: '06:00',
        endTime: '07:00',
        isActive: true,
        turfNormal: 0,
        turfRegular: 0,
        netsMachineNormal: 0,
        netsMachineRegular: 0,
        netsNoMachineNormal: 0,
        netsNoMachineRegular: 0
      }
    ];
    setUnifiedRules(updated);
    setHasChanges(true);
  };

  const removeRule = (index: number) => {
    const updated = unifiedRules.filter((_, idx) => idx !== index);
    setUnifiedRules(updated);
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
          <h1>Weekday Pricing Configuration</h1>
          <p className="page-subtitle">Configure slot intervals and corresponding hourly rates for weekdays side-by-side</p>
        </div>
      </div>

      {loading ? (
        <div className="loading-screen"><div className="spinner spinner-lg" /></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', marginTop: 'var(--space-4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              <HelpCircle size={14} />
              <span>Configure hours and rates across different facility types side-by-side. 12-hour AM/PM selection is supported.</span>
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={addRule}
              style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              + Add Weekday Slot
            </button>
          </div>

          {unifiedRules.length === 0 ? (
            <div style={{ padding: 'var(--space-12)', textAlign: 'center', fontSize: 'var(--text-sm)', color: 'var(--text-muted)', border: '1px dashed var(--surface-glass-border)', borderRadius: '12px', background: 'var(--bg-secondary)' }}>
              No weekday pricing rules configured. Click the button above to add a weekday slot.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {unifiedRules.map((rule, index) => {
                return (
                  <div
                    key={rule.id || index}
                    className="card"
                    style={{
                      border: '1px solid var(--surface-glass-border)',
                      borderRadius: '12px',
                      background: 'var(--bg-secondary)',
                      boxShadow: 'var(--shadow-sm)',
                      opacity: rule.isActive ? 1 : 0.6,
                      transition: 'opacity 0.2s ease',
                    }}
                  >
                    <div className="card-body" style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                      {/* Configuration Header */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', alignItems: 'center', borderBottom: '1px solid var(--surface-glass-border)', paddingBottom: 'var(--space-3)' }}>
                        <div style={{ flex: '1 1 200px' }}>
                          <label style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Slot Name</label>
                          <input
                            className="form-input"
                            value={rule.name || ''}
                            onChange={(e) => updateRule(index, { name: e.target.value })}
                            placeholder="e.g. Peak Morning"
                            style={{ height: '36px', fontSize: '13px' }}
                          />
                        </div>
                        <div style={{ flex: '0 0 140px' }}>
                          <label style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Start Time</label>
                          <CustomTimePicker
                            value={rule.startTime}
                            onChange={(time) => updateRule(index, { startTime: time })}
                          />
                        </div>
                        <div style={{ flex: '0 0 140px' }}>
                          <label style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>End Time</label>
                          <CustomTimePicker
                            value={rule.endTime}
                            onChange={(time) => updateRule(index, { endTime: time })}
                          />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginLeft: 'auto', paddingTop: '14px' }}>
                          <div className="toggle-wrapper" onClick={() => updateRule(index, { isActive: !rule.isActive })} style={{ cursor: 'pointer' }}>
                            <div className={`toggle ${rule.isActive ? 'active' : ''}`} />
                            <span className="toggle-label" style={{ fontSize: '12px', fontWeight: 500 }}>{rule.isActive ? 'Active' : 'Inactive'}</span>
                          </div>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => removeRule(index)}
                            style={{ color: 'var(--status-danger)', borderColor: 'var(--status-danger-border)', padding: '6px 8px', height: '36px' }}
                            title="Remove Slot"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      {/* Pricing Matrix */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
                        {/* Turf Booking */}
                        <div style={{ background: 'var(--bg-tertiary)', padding: '12px', borderRadius: '8px', border: '1px solid var(--surface-glass-border)' }}>
                          <div style={{ fontWeight: 600, fontSize: '12px', marginBottom: '8px', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-primary)' }}></span>
                            Turf Booking
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <div style={{ flex: 1 }}>
                              <label style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>Normal / Hr</label>
                              <input
                                type="number"
                                min="0"
                                className="form-input"
                                value={rule.turfNormal === 0 ? '' : rule.turfNormal}
                                placeholder="0"
                                onChange={(e) => updateRule(index, { turfNormal: e.target.value === '' ? 0 : Number(e.target.value) })}
                                style={{ height: '32px', fontSize: '12px' }}
                              />
                            </div>
                            <div style={{ flex: 1 }}>
                              <label style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>Regular / Hr</label>
                              <input
                                type="number"
                                min="0"
                                className="form-input"
                                value={rule.turfRegular === 0 ? '' : rule.turfRegular}
                                placeholder="0"
                                onChange={(e) => updateRule(index, { turfRegular: e.target.value === '' ? 0 : Number(e.target.value) })}
                                style={{ height: '32px', fontSize: '12px' }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Nets With Machine */}
                        <div style={{ background: 'var(--bg-tertiary)', padding: '12px', borderRadius: '8px', border: '1px solid var(--surface-glass-border)' }}>
                          <div style={{ fontWeight: 600, fontSize: '12px', marginBottom: '8px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--text-secondary)' }}></span>
                            Nets (With Machine)
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <div style={{ flex: 1 }}>
                              <label style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>Normal / Hr</label>
                              <input
                                type="number"
                                min="0"
                                className="form-input"
                                value={rule.netsMachineNormal === 0 ? '' : rule.netsMachineNormal}
                                placeholder="0"
                                onChange={(e) => updateRule(index, { netsMachineNormal: e.target.value === '' ? 0 : Number(e.target.value) })}
                                style={{ height: '32px', fontSize: '12px' }}
                              />
                            </div>
                            <div style={{ flex: 1 }}>
                              <label style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>Regular / Hr</label>
                              <input
                                type="number"
                                min="0"
                                className="form-input"
                                value={rule.netsMachineRegular === 0 ? '' : rule.netsMachineRegular}
                                placeholder="0"
                                onChange={(e) => updateRule(index, { netsMachineRegular: e.target.value === '' ? 0 : Number(e.target.value) })}
                                style={{ height: '32px', fontSize: '12px' }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Nets Without Machine */}
                        <div style={{ background: 'var(--bg-tertiary)', padding: '12px', borderRadius: '8px', border: '1px solid var(--surface-glass-border)' }}>
                          <div style={{ fontWeight: 600, fontSize: '12px', marginBottom: '8px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--text-secondary)' }}></span>
                            Nets (Without Machine)
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <div style={{ flex: 1 }}>
                              <label style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>Normal / Hr</label>
                              <input
                                type="number"
                                min="0"
                                className="form-input"
                                value={rule.netsNoMachineNormal === 0 ? '' : rule.netsNoMachineNormal}
                                placeholder="0"
                                onChange={(e) => updateRule(index, { netsNoMachineNormal: e.target.value === '' ? 0 : Number(e.target.value) })}
                                style={{ height: '32px', fontSize: '12px' }}
                              />
                            </div>
                            <div style={{ flex: 1 }}>
                              <label style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>Regular / Hr</label>
                              <input
                                type="number"
                                min="0"
                                className="form-input"
                                value={rule.netsNoMachineRegular === 0 ? '' : rule.netsNoMachineRegular}
                                placeholder="0"
                                onChange={(e) => updateRule(index, { netsNoMachineRegular: e.target.value === '' ? 0 : Number(e.target.value) })}
                                style={{ height: '32px', fontSize: '12px' }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
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
      )}
    </div>
  );
}
