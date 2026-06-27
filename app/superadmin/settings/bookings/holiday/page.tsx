'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, Save, Trash2, Calendar, Check, X, HelpCircle, Plus } from 'lucide-react';
import { type TurfHoliday } from '@/lib/turf-pricing';
import { CustomTimePicker } from '@/components/ui/CustomTimePicker';

interface Setting {
  _id: string;
  key: string;
  value: unknown;
  label: string;
  category: string;
}

interface UnifiedHolidaySlot {
  id: string;
  startTime: string;
  endTime: string;
  turfNormal: number;
  turfRegular: number;
  netsMachineNormal: number;
  netsMachineRegular: number;
  netsNoMachineNormal: number;
  netsNoMachineRegular: number;
}

interface GroupedHoliday {
  date: string;
  name: string;
  slots: UnifiedHolidaySlot[];
}

export default function HolidayPricingPage() {
  const [groupedHolidays, setGroupedHolidays] = useState<GroupedHoliday[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: string } | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const showToast = (message: string, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const mergeGroupedHolidays = (
    turfHols: TurfHoliday[],
    netsMachineHols: TurfHoliday[],
    netsNoMachineHols: TurfHoliday[]
  ): GroupedHoliday[] => {
    const datesMap = new Map<string, { date: string; name: string }>();

    const addHolsToDates = (hols: TurfHoliday[]) => {
      if (!Array.isArray(hols)) return;
      hols.forEach(h => {
        if (!datesMap.has(h.date)) {
          datesMap.set(h.date, { date: h.date, name: h.name });
        }
      });
    };

    addHolsToDates(turfHols);
    addHolsToDates(netsMachineHols);
    addHolsToDates(netsNoMachineHols);

    const grouped: GroupedHoliday[] = [];

    datesMap.forEach(({ date, name }) => {
      const slotsMap = new Map<string, { startTime: string; endTime: string }>();

      const addSlotsForDate = (hols: TurfHoliday[]) => {
        if (!Array.isArray(hols)) return;
        hols.forEach(h => {
          if (h.date === date) {
            const start = h.startTime || '00:00';
            const end = h.endTime || '23:30';
            const key = `${start}-${end}`;
            if (!slotsMap.has(key)) {
              slotsMap.set(key, { startTime: start, endTime: end });
            }
          }
        });
      };

      addSlotsForDate(turfHols);
      addSlotsForDate(netsMachineHols);
      addSlotsForDate(netsNoMachineHols);

      const slots: UnifiedHolidaySlot[] = [];
      let slotIdx = 0;

      slotsMap.forEach(({ startTime, endTime }) => {
        const turfHol = turfHols?.find(h => h.date === date && (h.startTime || '00:00') === startTime && (h.endTime || '23:30') === endTime);
        const machineHol = netsMachineHols?.find(h => h.date === date && (h.startTime || '00:00') === startTime && (h.endTime || '23:30') === endTime);
        const noMachineHol = netsNoMachineHols?.find(h => h.date === date && (h.startTime || '00:00') === startTime && (h.endTime || '23:30') === endTime);

        slots.push({
          id: `slot-${date}-${slotIdx++}`,
          startTime,
          endTime,
          turfNormal: turfHol?.normalPricePerHour ?? 0,
          turfRegular: turfHol?.regularPricePerHour ?? 0,
          netsMachineNormal: machineHol?.normalPricePerHour ?? 0,
          netsMachineRegular: machineHol?.regularPricePerHour ?? 0,
          netsNoMachineNormal: noMachineHol?.normalPricePerHour ?? 0,
          netsNoMachineRegular: noMachineHol?.regularPricePerHour ?? 0
        });
      });

      slots.sort((a, b) => a.startTime.localeCompare(b.startTime));

      grouped.push({
        date,
        name,
        slots
      });
    });

    return grouped.sort((a, b) => a.date.localeCompare(b.date));
  };

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data.success) {
        const settings = data.data as Setting[];
        const turfHols = settings.find((s) => s.key === 'turf_holidays')?.value as TurfHoliday[] || [];
        const machineHols = settings.find((s) => s.key === 'nets_machine_holidays')?.value as TurfHoliday[] || [];
        const nomachineHols = settings.find((s) => s.key === 'nets_nomachine_holidays')?.value as TurfHoliday[] || [];

        const merged = mergeGroupedHolidays(turfHols, machineHols, nomachineHols);
        setGroupedHolidays(merged);
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
      const turfHols: TurfHoliday[] = [];
      const netsMachineHols: TurfHoliday[] = [];
      const netsNoMachineHols: TurfHoliday[] = [];

      groupedHolidays.forEach(g => {
        g.slots.forEach(slot => {
          turfHols.push({
            date: g.date,
            name: g.name,
            startTime: slot.startTime,
            endTime: slot.endTime,
            normalPricePerHour: slot.turfNormal,
            regularPricePerHour: slot.turfRegular
          });

          netsMachineHols.push({
            date: g.date,
            name: g.name,
            startTime: slot.startTime,
            endTime: slot.endTime,
            normalPricePerHour: slot.netsMachineNormal,
            regularPricePerHour: slot.netsMachineRegular
          });

          netsNoMachineHols.push({
            date: g.date,
            name: g.name,
            startTime: slot.startTime,
            endTime: slot.endTime,
            normalPricePerHour: slot.netsNoMachineNormal,
            regularPricePerHour: slot.netsNoMachineRegular
          });
        });
      });

      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: [
            { key: 'turf_holidays', value: turfHols },
            { key: 'nets_machine_holidays', value: netsMachineHols },
            { key: 'nets_nomachine_holidays', value: netsNoMachineHols }
          ]
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast('Holiday pricing rules saved successfully');
        setHasChanges(false);
        fetchSettings(); // Refresh
      } else {
        showToast(data.message, 'error');
      }
    } catch {
      showToast('Error saving holidays configuration', 'error');
    } finally {
      setSaving(false);
    }
  };

  const updateHolidayGroup = (groupIndex: number, patch: Partial<GroupedHoliday>) => {
    const updated = groupedHolidays.map((group, idx) => idx === groupIndex ? { ...group, ...patch } : group);
    setGroupedHolidays(updated);
    setHasChanges(true);
  };

  const updateHolidaySlot = (groupIndex: number, slotIndex: number, patch: Partial<UnifiedHolidaySlot>) => {
    const updated = groupedHolidays.map((group, gIdx) => {
      if (gIdx !== groupIndex) return group;
      const updatedSlots = group.slots.map((slot, sIdx) => sIdx === slotIndex ? { ...slot, ...patch } : slot);
      return { ...group, slots: updatedSlots };
    });
    setGroupedHolidays(updated);
    setHasChanges(true);
  };

  const addHolidayGroup = () => {
    const updated = [
      ...groupedHolidays,
      {
        date: new Date().toISOString().split('T')[0],
        name: 'New Holiday Date',
        slots: [
          {
            id: `slot-${Date.now()}-0`,
            startTime: '00:00',
            endTime: '23:30',
            turfNormal: 0,
            turfRegular: 0,
            netsMachineNormal: 0,
            netsMachineRegular: 0,
            netsNoMachineNormal: 0,
            netsNoMachineRegular: 0
          }
        ]
      }
    ];
    setGroupedHolidays(updated);
    setHasChanges(true);
  };

  const addHolidaySlot = (groupIndex: number) => {
    const updated = groupedHolidays.map((group, gIdx) => {
      if (gIdx !== groupIndex) return group;
      const newSlot = {
        id: `slot-${Date.now()}-${group.slots.length}`,
        startTime: '06:00',
        endTime: '12:00',
        turfNormal: 0,
        turfRegular: 0,
        netsMachineNormal: 0,
        netsMachineRegular: 0,
        netsNoMachineNormal: 0,
        netsNoMachineRegular: 0
      };
      return { ...group, slots: [...group.slots, newSlot] };
    });
    setGroupedHolidays(updated);
    setHasChanges(true);
  };

  const removeHolidayGroup = (groupIndex: number) => {
    const updated = groupedHolidays.filter((_, idx) => idx !== groupIndex);
    setGroupedHolidays(updated);
    setHasChanges(true);
  };

  const removeHolidaySlot = (groupIndex: number, slotIndex: number) => {
    const updated = groupedHolidays.map((group, gIdx) => {
      if (gIdx !== groupIndex) return group;
      const updatedSlots = group.slots.filter((_, sIdx) => sIdx !== slotIndex);
      return { ...group, slots: updatedSlots };
    }).filter(group => group.slots.length > 0); // Remove group if it has no slots left

    setGroupedHolidays(updated);
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
          <p className="page-subtitle">Configure custom flat hourly rates for specific calendar dates and time slots side-by-side</p>
        </div>
      </div>

      {loading ? (
        <div className="loading-screen"><div className="spinner spinner-lg" /></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', marginTop: 'var(--space-4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              <HelpCircle size={14} />
              <span>Define holiday calendar dates. You can add multiple time slots for each holiday date with different rate models.</span>
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={addHolidayGroup}
              style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              + Add Holiday Date
            </button>
          </div>

          {groupedHolidays.length === 0 ? (
            <div style={{ padding: 'var(--space-12)', textAlign: 'center', fontSize: 'var(--text-sm)', color: 'var(--text-muted)', border: '1px dashed var(--surface-glass-border)', borderRadius: '12px', background: 'var(--bg-secondary)' }}>
              No holiday dates configured. Click the button above to add a custom holiday date.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
              {groupedHolidays.map((group, groupIndex) => {
                return (
                  <div
                    key={groupIndex}
                    className="card"
                    style={{
                      border: '1px solid var(--surface-glass-border)',
                      borderRadius: '12px',
                      background: 'var(--bg-secondary)',
                      boxShadow: 'var(--shadow-sm)',
                    }}
                  >
                    <div className="card-body" style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                      {/* Holiday Date and Name Header */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', alignItems: 'center', borderBottom: '1px solid var(--surface-glass-border)', paddingBottom: 'var(--space-3)' }}>
                        <div style={{ flex: '0 0 160px' }}>
                          <label style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Holiday Date</label>
                          <input
                            type="date"
                            className="form-input"
                            value={group.date || ''}
                            onChange={(e) => updateHolidayGroup(groupIndex, { date: e.target.value })}
                            style={{ height: '36px', fontSize: '13px' }}
                          />
                        </div>
                        <div style={{ flex: '1 1 200px' }}>
                          <label style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Holiday Name</label>
                          <input
                            className="form-input"
                            value={group.name || ''}
                            onChange={(e) => updateHolidayGroup(groupIndex, { name: e.target.value })}
                            placeholder="e.g. Christmas"
                            style={{ height: '36px', fontSize: '13px' }}
                          />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', marginLeft: 'auto', paddingTop: '14px' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => removeHolidayGroup(groupIndex)}
                            style={{ color: 'var(--status-danger)', borderColor: 'var(--status-danger-border)', padding: '6px 8px', height: '36px' }}
                            title="Remove Entire Holiday Date"
                          >
                            <Trash2 size={16} /> Remove Date
                          </button>
                        </div>
                      </div>

                      {/* Time Slots List */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
                        {group.slots.map((slot, slotIndex) => (
                          <div
                            key={slot.id || slotIndex}
                            style={{
                              padding: '14px',
                              background: 'var(--bg-tertiary)',
                              borderRadius: '8px',
                              border: '1px solid var(--surface-glass-border)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '12px'
                            }}
                          >
                            {/* Slot Header: Time picker and remove slot */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', borderBottom: '1px dashed var(--surface-glass-border)', paddingBottom: '10px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 auto' }}>
                                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>Slot Time Range:</span>
                                <div style={{ width: '130px' }}>
                                  <CustomTimePicker
                                    value={slot.startTime}
                                    onChange={(time) => updateHolidaySlot(groupIndex, slotIndex, { startTime: time })}
                                  />
                                </div>
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>to</span>
                                <div style={{ width: '130px' }}>
                                  <CustomTimePicker
                                    value={slot.endTime}
                                    onChange={(time) => updateHolidaySlot(groupIndex, slotIndex, { endTime: time })}
                                  />
                                </div>
                              </div>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => removeHolidaySlot(groupIndex, slotIndex)}
                                style={{ color: 'var(--status-danger)', borderColor: 'var(--status-danger-border)', padding: '4px 6px', height: '28px' }}
                                title="Remove Slot"
                              >
                                <Trash2 size={14} /> Remove Slot
                              </button>
                            </div>

                            {/* Pricing Grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
                              {/* Turf Booking */}
                              <div style={{ background: 'var(--bg-secondary)', padding: '10px', borderRadius: '6px', border: '1px solid var(--surface-glass-border)' }}>
                                <div style={{ fontWeight: 600, fontSize: '11px', marginBottom: '6px', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-primary)' }}></span>
                                  Turf Booking
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: '9px', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>Normal / Hr</label>
                                    <input
                                      type="number"
                                      min="0"
                                      className="form-input"
                                      value={slot.turfNormal === 0 ? '' : slot.turfNormal}
                                      placeholder="0"
                                      onChange={(e) => updateHolidaySlot(groupIndex, slotIndex, { turfNormal: e.target.value === '' ? 0 : Number(e.target.value) })}
                                      style={{ height: '30px', fontSize: '11px' }}
                                    />
                                  </div>
                                  <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: '9px', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>Regular / Hr</label>
                                    <input
                                      type="number"
                                      min="0"
                                      className="form-input"
                                      value={slot.turfRegular === 0 ? '' : slot.turfRegular}
                                      placeholder="0"
                                      onChange={(e) => updateHolidaySlot(groupIndex, slotIndex, { turfRegular: e.target.value === '' ? 0 : Number(e.target.value) })}
                                      style={{ height: '30px', fontSize: '11px' }}
                                    />
                                  </div>
                                </div>
                              </div>

                              {/* Nets With Machine */}
                              <div style={{ background: 'var(--bg-secondary)', padding: '10px', borderRadius: '6px', border: '1px solid var(--surface-glass-border)' }}>
                                <div style={{ fontWeight: 600, fontSize: '11px', marginBottom: '6px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--text-secondary)' }}></span>
                                  Nets (With Machine)
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: '9px', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>Normal / Hr</label>
                                    <input
                                      type="number"
                                      min="0"
                                      className="form-input"
                                      value={slot.netsMachineNormal === 0 ? '' : slot.netsMachineNormal}
                                      placeholder="0"
                                      onChange={(e) => updateHolidaySlot(groupIndex, slotIndex, { netsMachineNormal: e.target.value === '' ? 0 : Number(e.target.value) })}
                                      style={{ height: '30px', fontSize: '11px' }}
                                    />
                                  </div>
                                  <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: '9px', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>Regular / Hr</label>
                                    <input
                                      type="number"
                                      min="0"
                                      className="form-input"
                                      value={slot.netsMachineRegular === 0 ? '' : slot.netsMachineRegular}
                                      placeholder="0"
                                      onChange={(e) => updateHolidaySlot(groupIndex, slotIndex, { netsMachineRegular: e.target.value === '' ? 0 : Number(e.target.value) })}
                                      style={{ height: '30px', fontSize: '11px' }}
                                    />
                                  </div>
                                </div>
                              </div>

                              {/* Nets Without Machine */}
                              <div style={{ background: 'var(--bg-secondary)', padding: '10px', borderRadius: '6px', border: '1px solid var(--surface-glass-border)' }}>
                                <div style={{ fontWeight: 600, fontSize: '11px', marginBottom: '6px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--text-secondary)' }}></span>
                                  Nets (Without Machine)
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: '9px', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>Normal / Hr</label>
                                    <input
                                      type="number"
                                      min="0"
                                      className="form-input"
                                      value={slot.netsNoMachineNormal === 0 ? '' : slot.netsNoMachineNormal}
                                      placeholder="0"
                                      onChange={(e) => updateHolidaySlot(groupIndex, slotIndex, { netsNoMachineNormal: e.target.value === '' ? 0 : Number(e.target.value) })}
                                      style={{ height: '30px', fontSize: '11px' }}
                                    />
                                  </div>
                                  <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: '9px', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>Regular / Hr</label>
                                    <input
                                      type="number"
                                      min="0"
                                      className="form-input"
                                      value={slot.netsNoMachineRegular === 0 ? '' : slot.netsNoMachineRegular}
                                      placeholder="0"
                                      onChange={(e) => updateHolidaySlot(groupIndex, slotIndex, { netsNoMachineRegular: e.target.value === '' ? 0 : Number(e.target.value) })}
                                      style={{ height: '30px', fontSize: '11px' }}
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Add Slot Button */}
                      <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: 'var(--space-2)' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => addHolidaySlot(groupIndex)}
                          style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Plus size={14} /> Add Time Slot
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
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
      )}
    </div>
  );
}
