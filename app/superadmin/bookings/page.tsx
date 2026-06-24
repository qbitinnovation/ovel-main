'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  AlertCircle,
  Calendar,
  Check,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Lock,
  Percent,
  Phone,
  Receipt,
  ShoppingCart,
  Tag,
  Trash2,
  User as UserIcon,
  X,
} from 'lucide-react';
import { CustomDatePicker } from '@/components/ui/CustomDatePicker';
import { CustomSelect } from '@/components/ui/CustomSelect';
import {
  DEFAULT_TURF_PRICING_CONFIG,
  calculateTurfSlotPrice,
  type TurfPriceType,
  type TurfPricingResult,
  type TurfPricingConfig,
} from '@/lib/turf-pricing';
import { usePermissions } from '@/components/providers/PermissionsProvider';

import { SlotGrid } from '@/components/bookings/SlotGrid';
import {
  TIME_SLOTS,
  isSlotBooked,
  hasAnyBookingOnDate,
  mergeSelectedSlots,
  formatDate,
  formatTime,
  type ExistingBooking,
} from '@/lib/booking-utils';

type BookingMode = 'normal' | 'bulk';
type CartItemKind = 'slot' | 'full_day' | 'extra_slot';
type DiscountType = 'percentage' | 'flat';

interface CartItem {
  id: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  label: string;
  kind: CartItemKind;
  amount: number;
  durationHours: number;
  pricingSnapshot: TurfPricingResult;
}

interface AppliedDiscount {
  type: DiscountType;
  value: number;
}

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

const DISCOUNT_OPTIONS = [
  { value: 'percentage', label: 'Percentage (%)', icon: <Percent size={14} /> },
  { value: 'flat', label: 'Flat Rate', icon: <Tag size={14} /> },
];

const RATE_OPTIONS: Array<{ value: TurfPriceType; label: string }> = [
  { value: 'normal', label: 'Normal Rate' },
  { value: 'regular', label: 'Regular Rate' },
];

export default function BookingsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const portalBase = pathname?.split('/')[1] || 'superadmin';
  const manageUrl = `/${portalBase}/bookings/manage`;
  const [pricing, setPricing] = useState<TurfPricingConfig>(DEFAULT_TURF_PRICING_CONFIG);
  const [pricingLoading, setPricingLoading] = useState(true);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [bookingMode, setBookingMode] = useState<BookingMode>('normal');
  const [priceType, setPriceType] = useState<TurfPriceType>('normal');
  const [selectedNormalSlots, setSelectedNormalSlots] = useState<string[]>([]);
  const [bulkSelections, setBulkSelections] = useState<Array<{ date: string; isFullDay: boolean; slots: string[] }>>([
    { date: todayKey(), isFullDay: true, slots: [] }
  ]);
  const [newBulkDate, setNewBulkDate] = useState('');
  const [bookedByDate, setBookedByDate] = useState<Record<string, ExistingBooking[]>>({});
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [discountType, setDiscountType] = useState<DiscountType>('percentage');
  const [discountInput, setDiscountInput] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<AppliedDiscount | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  const { checkPermission } = usePermissions();
  const canCreateBooking = checkPermission('bookings', 'create_booking');
  const canViewPaymentDashboard = checkPermission('bookings', 'view_payment_dashboard');

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3500);
  }, []);

  const fetchPricing = useCallback(async () => {
    setPricingLoading(true);
    try {
      const res = await fetch(`/api/settings/pricing?sync=${Date.now()}`, { cache: 'no-store' });
      const data = await res.json() as ApiResponse<{ pricing: TurfPricingConfig }>;
      if (!data.success) throw new Error(data.message || 'Failed to load pricing');
      setPricing(data.data.pricing || DEFAULT_TURF_PRICING_CONFIG);
      setLastSyncedAt(new Date());
    } catch (error) {
      console.error(error);
      showToast('Failed to sync pricing', 'error');
    } finally {
      setPricingLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchPricing();
  }, [fetchPricing]);

  useEffect(() => {
    setSelectedNormalSlots([]);
    setAppliedDiscount(null);
    setBulkSelections((prev) => {
      if (prev.length === 0) return [{ date: selectedDate, isFullDay: true, slots: [] }];
      if (prev[0].date === selectedDate) return prev;
      
      const newSelections = [...prev];
      newSelections[0] = { ...newSelections[0], date: selectedDate };
      return newSelections.filter((sel, idx) => idx === 0 || sel.date !== selectedDate);
    });
  }, [selectedDate]);

  const visibleDates = useMemo(() => {
    const dates = bookingMode === 'bulk' ? bulkSelections.map(s => s.date) : [selectedDate];
    return Array.from(new Set(dates.filter(Boolean)));
  }, [bookingMode, selectedDate, bulkSelections]);

  const fetchBookedSlots = useCallback(async () => {
    setBookingsLoading(true);
    try {
      const results = await Promise.all(visibleDates.map(async (date) => {
        const params = new URLSearchParams({
          startDate: date,
          endDate: date,
          bookingStatus: 'confirmed',
          limit: '100',
        });
        const res = await fetch(`/api/bookings?${params.toString()}`, { cache: 'no-store' });
        const data = await res.json() as ApiResponse<{ bookings: ExistingBooking[] }>;
        return [date, data.success ? data.data.bookings || [] : []] as const;
      }));

      setBookedByDate((previous) => ({
        ...previous,
        ...Object.fromEntries(results),
      }));
    } catch (error) {
      console.error(error);
      showToast('Failed to load booked slots', 'error');
    } finally {
      setBookingsLoading(false);
    }
  }, [showToast, visibleDates]);

  useEffect(() => {
    fetchBookedSlots();
  }, [fetchBookedSlots]);

  const selectedNormalSet = useMemo(() => new Set(selectedNormalSlots), [selectedNormalSlots]);

  const cartItems = useMemo(() => {
    const items: CartItem[] = [];

    if (bookingMode === 'normal') {
      items.push(...buildSlotCartItems({
        date: selectedDate,
        slotStarts: selectedNormalSlots,
        kind: 'slot',
        priceType,
        pricing,
      }));
    } else {
      for (const sel of bulkSelections) {
        if (sel.isFullDay) {
          const fullDay = quoteCartItem({
            date: sel.date,
            startTime: '00:00',
            endTime: '23:59',
            kind: 'full_day',
            label: 'Full 24-hour day',
            priceType,
            pricing,
          });
          if (fullDay) items.push(fullDay);
        } else if (sel.slots.length > 0) {
          items.push(...buildSlotCartItems({
            date: sel.date,
            slotStarts: sel.slots,
            kind: 'extra_slot',
            priceType,
            pricing,
          }));
        }
      }
    }

    return items;
  }, [
    bookingMode,
    bulkSelections,
    priceType,
    pricing,
    selectedDate,
    selectedNormalSlots,
  ]);

  const summary = useMemo(() => {
    const baseAmount = cartItems.reduce((sum, item) => sum + item.amount, 0);
    const discountAmount = getDiscountAmount(baseAmount, appliedDiscount);
    const finalAmount = Math.max(0, baseAmount - discountAmount);
    const totalHours = cartItems.reduce((sum, item) => sum + item.durationHours, 0);
    const hasZeroPriceItem = cartItems.some((item) => item.amount <= 0);
    const discountPercentage = baseAmount > 0 ? (discountAmount / baseAmount) * 100 : 0;

    return { baseAmount, discountAmount, discountPercentage, finalAmount, totalHours, hasZeroPriceItem };
  }, [appliedDiscount, cartItems]);

  const discountPercentageStr = useMemo(() => {
    if (summary.discountAmount <= 0) return '';
    if (appliedDiscount?.type === 'percentage') {
      return ` (${appliedDiscount.value}%)`;
    }
    const pct = summary.discountPercentage;
    return pct > 0 ? ` (${pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(1)}%)` : '';
  }, [appliedDiscount, summary.discountAmount, summary.discountPercentage]);

  const fullDayUnavailable = hasAnyBookingOnDate(selectedDate, bookedByDate);
  const canConfirm = cartItems.length > 0 && summary.baseAmount > 0 && !summary.hasZeroPriceItem && !saving;

  const switchMode = (mode: BookingMode) => {
    setBookingMode(mode);
    setSelectedNormalSlots([]);
    setBulkSelections([{ date: selectedDate, isFullDay: true, slots: [] }]);
    setAppliedDiscount(null);
  };

  const toggleNormalSlot = (slotStart: string, slotEnd: string, date: string) => {
    if (isSlotBooked(date, slotStart, slotEnd, bookedByDate)) return;
    setSelectedNormalSlots((prev) =>
      prev.includes(slotStart) ? prev.filter((s) => s !== slotStart) : [...prev, slotStart].sort()
    );
  };

  const toggleBulkSlot = (date: string, slotStart: string, slotEnd: string) => {
    if (isSlotBooked(date, slotStart, slotEnd, bookedByDate)) return;
    setBulkSelections((prev) =>
      prev.map((sel) => {
        if (sel.date !== date) return sel;
        const newSlots = sel.slots.includes(slotStart)
          ? sel.slots.filter((s) => s !== slotStart)
          : [...sel.slots, slotStart].sort();
        return { ...sel, slots: newSlots };
      })
    );
  };

  const addBulkDate = (date: string) => {
    if (!date) return;
    if (bulkSelections.some((s) => s.date === date)) {
      showToast('Date already added', 'error');
      return;
    }
    setBulkSelections((prev) => [...prev, { date, isFullDay: true, slots: [] }]);
    setNewBulkDate('');
  };

  const removeBulkDate = (date: string) => {
    setBulkSelections((prev) => prev.filter((s) => s.date !== date));
  };

  const applyDiscount = () => {
    const value = Number(discountInput);
    if (!Number.isFinite(value) || value <= 0) {
      setAppliedDiscount(null);
      showToast('Enter a discount value', 'error');
      return;
    }

    setAppliedDiscount({ type: discountType, value });
    showToast('Discount applied');
  };

  const clearDiscount = () => {
    setDiscountInput('');
    setAppliedDiscount(null);
  };

  const resetCheckout = () => {
    setSelectedNormalSlots([]);
    setBulkSelections([{ date: todayKey(), isFullDay: true, slots: [] }]);
    setNewBulkDate('');
    setCustomerName('');
    setContactNumber('');
    setNotes('');
    setDiscountInput('');
    setAppliedDiscount(null);
    setCurrentStep(1);
  };

  const confirmBooking = async () => {
    if (!canConfirm) return;

    setSaving(true);
    try {
      const res = await fetch('/api/bookings/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName,
          contactNumber,
          notes,
          priceType,
          discount: appliedDiscount || { type: 'flat', value: 0 },
          items: cartItems.map((item) => ({
            bookingDate: item.bookingDate,
            startTime: item.startTime,
            endTime: item.endTime,
            kind: item.kind,
            label: item.label,
          })),
        }),
      });

      const data = await res.json() as ApiResponse<unknown>;
      if (!data.success) {
        showToast(data.message || 'Failed to confirm booking', 'error');
        return;
      }

      showToast('Booking confirmed!');
      resetCheckout();
      await Promise.all([fetchPricing(), fetchBookedSlots()]);
      
      if (canViewPaymentDashboard) {
        showToast('Booking confirmed! Redirecting...');
        router.push(manageUrl);
      }
    } catch (error) {
      console.error('Network or parsing error:', error);
      showToast('Failed to connect to the server', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-container booking-page-with-fixed-summary">
      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type === 'error' ? 'error' : 'success'}`}>
            <span className="toast-icon">{toast.type === 'error' ? <X size={16} /> : <Check size={16} />}</span>
            <div className="toast-content"><div className="toast-title">{toast.message}</div></div>
          </div>
        </div>
      )}

      <div className="page-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 'var(--space-4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
          <div>
            <h1>Bookings</h1>
            <p className="page-subtitle">Create turf bookings and grouped invoices</p>
          </div>
          <div className="pill-toggle-group" style={{ background: 'var(--surface-secondary)', padding: '4px', borderRadius: '30px' }}>
            {canCreateBooking && (
              <button className="pill-toggle active" style={{ padding: '8px 24px', borderRadius: '24px', fontSize: 'var(--text-sm)', fontWeight: 500 }}>
                New Booking
              </button>
            )}
            {canViewPaymentDashboard && (
              <button className="pill-toggle" onClick={() => router.push(manageUrl)} style={{ padding: '8px 24px', borderRadius: '24px', fontSize: 'var(--text-sm)', fontWeight: 500 }}>
                Manage Bookings
              </button>
            )}
          </div>
        </div>
        
        {/* Wizard Progress Indicator */}
        <div style={{ display: 'flex', gap: 'var(--space-2)', width: '100%', maxWidth: '600px', margin: '0 auto', padding: 'var(--space-4) 0' }}>
          {[1, 2, 3].map(step => (
            <div key={step} style={{ flex: 1, height: '4px', borderRadius: '2px', background: currentStep >= step ? 'var(--primary)' : 'var(--border-primary)', transition: 'background 0.3s ease' }} />
          ))}
        </div>
      </div>

      <div className="booking-wizard-container" style={{ maxWidth: '800px', margin: '0 auto', paddingBottom: 'var(--space-8)' }}>
        {currentStep === 1 && (
          <div className="wizard-step" style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <section className="card">
            <div className="card-body" style={{ display: 'grid', gap: 'var(--space-5)' }}>
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label required">Booking Date</label>
                  <CustomDatePicker value={selectedDate} onChange={setSelectedDate} minDate={new Date().toISOString().split('T')[0]} />
                </div>
                <div className="form-group">
                  <label className="form-label">Mode</label>
                  <div className="pill-toggle-group" role="tablist" aria-label="Booking mode">
                    <button
                      type="button"
                      className={`pill-toggle ${bookingMode === 'normal' ? 'active' : ''}`}
                      onClick={() => switchMode('normal')}
                    >
                      <Clock size={16} /> Normal Booking
                    </button>
                    <button
                      type="button"
                      className={`pill-toggle ${bookingMode === 'bulk' ? 'active' : ''}`}
                      onClick={() => switchMode('bulk')}
                    >
                      <ShoppingCart size={16} /> Bulk Order
                    </button>
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label required">Pricing Tier</label>
                <div className="booking-rate-options">
                  {RATE_OPTIONS.map((option) => (
                    <label key={option.value} className={`booking-rate-option ${priceType === option.value ? 'active' : ''}`}>
                      <input
                        type="radio"
                        name="priceType"
                        value={option.value}
                        checked={priceType === option.value}
                        onChange={() => setPriceType(option.value)}
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {bookingMode === 'normal' ? (
            <section className="card">
              <div className="card-header">
                <h3 style={{ fontSize: 'var(--text-sm)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', margin: 0 }}>
                  <Calendar size={16} /> {formatDate(selectedDate)}
                </h3>
                <span className="badge badge-neutral">{selectedNormalSlots.length} selected</span>
              </div>
              <div className="card-body">
                {bookingsLoading ? (
                  <div className="loading-screen" style={{ minHeight: 180 }}><div className="spinner spinner-md" /></div>
                ) : (
                  <SlotGrid
                    date={selectedDate}
                    selectedSet={selectedNormalSet}
                    bookedByDate={bookedByDate}
                    disabled={false}
                    onToggle={(slot) => toggleNormalSlot(slot.start, slot.end, selectedDate)}
                  />
                )}
              </div>
            </section>
          ) : (
            <section className="card">
              <div className="card-header">
                <h3 style={{ fontSize: 'var(--text-sm)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', margin: 0 }}>
                  <ShoppingCart size={16} /> Bulk Order
                </h3>
                <span className="badge badge-neutral">{cartItems.length} cart item{cartItems.length === 1 ? '' : 's'}</span>
              </div>
              <div className="card-body" style={{ display: 'grid', gap: 'var(--space-5)' }}>
                {bulkSelections.map((sel) => {
                  const unavailable = hasAnyBookingOnDate(sel.date, bookedByDate);
                  return (
                    <div key={sel.date} style={{ border: '1px solid var(--border-primary)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                        <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                          <Clock size={16} /> {formatDate(sel.date)}
                        </div>
                        <button type="button" onClick={() => removeBulkDate(sel.date)} className="btn btn-secondary btn-sm" disabled={bulkSelections.length === 1}>
                          <Trash2 size={14} /> Remove
                        </button>
                      </div>

                      <div className="pill-toggle-group" style={{ marginBottom: 'var(--space-3)' }}>
                        <button type="button" className={`pill-toggle ${sel.isFullDay ? 'active' : ''}`} onClick={() => setBulkSelections((prev) => prev.map((s) => s.date === sel.date ? { ...s, isFullDay: true } : s))} disabled={unavailable}>
                          Full Day (24 Hrs)
                        </button>
                        <button type="button" className={`pill-toggle ${!sel.isFullDay ? 'active' : ''}`} onClick={() => setBulkSelections((prev) => prev.map((s) => s.date === sel.date ? { ...s, isFullDay: false } : s))}>
                          Custom Hours
                        </button>
                      </div>
                      
                      {sel.isFullDay ? (
                        unavailable ? (
                          <div className="booking-warning"><AlertCircle size={16} /> <span>Full day unavailable (has existing bookings)</span></div>
                        ) : (
                          <div className="booking-cart-meta">
                            <span className="booking-full-day-main">
                              <Lock size={16} /> Book Full 24-Hour Day
                            </span>
                          </div>
                        )
                      ) : (
                        <SlotGrid
                          date={sel.date}
                          selectedSet={new Set(sel.slots)}
                          bookedByDate={bookedByDate}
                          disabled={false}
                          onToggle={(slot) => toggleBulkSlot(sel.date, slot.start, slot.end)}
                        />
                      )}
                    </div>
                  );
                })}

                <div className="form-group" style={{ marginTop: 'var(--space-2)' }}>
                  <label className="form-label">Add Another Date</label>
                  <CustomDatePicker value={newBulkDate} onChange={(date) => { if (date) addBulkDate(date); }} placeholder="Select Date" />
                </div>
              </div>
            </section>
          )}
          
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
              <button 
                className="btn btn-primary btn-lg" 
                disabled={cartItems.length === 0} 
                onClick={() => setCurrentStep(2)}
              >
                Next: Customer Details <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="wizard-step" style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <section className="card">
            <div className="card-header">
              <h3 style={{ fontSize: 'var(--text-sm)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', margin: 0 }}>
                <UserIcon size={16} /> Customer
              </h3>
            </div>
            <div className="card-body">
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Customer Name</label>
                  <div className="booking-input-with-icon">
                    <UserIcon size={16} />
                    <input className="form-input" value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Name" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Contact Number</label>
                  <div className="booking-input-with-icon">
                    <Phone size={16} />
                    <input className="form-input" value={contactNumber} onChange={(event) => setContactNumber(event.target.value)} placeholder="Phone" />
                  </div>
                </div>
              </div>
              <div className="form-group" style={{ marginTop: 'var(--space-4)' }}>
                <label className="form-label">Notes</label>
                <div className="booking-input-with-icon booking-input-with-icon-top">
                  <FileText size={16} />
                  <textarea
                    className="form-input form-textarea"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Optional notes"
                    rows={3}
                  />
                </div>
              </div>
            </div>
          </section>
          
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-4)' }}>
              <button className="btn btn-secondary btn-lg" onClick={() => setCurrentStep(1)}>
                <ChevronLeft size={18} /> Back
              </button>
              <button 
                className="btn btn-primary btn-lg" 
                onClick={() => setCurrentStep(3)}
              >
                Next: Review & Checkout <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="wizard-step" style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <section className="card" style={{ marginBottom: 'var(--space-6)' }}>
            <div className="card-header">
              <h3 style={{ fontSize: 'var(--text-sm)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', margin: 0 }}>
                <Tag size={16} /> Discount
              </h3>
              {appliedDiscount && (
                <span className="badge badge-success">
                  {appliedDiscount.type === 'percentage' ? `${appliedDiscount.value}%` : fmtMoney(appliedDiscount.value)}
                </span>
              )}
            </div>
            <div className="card-body">
              <div className="booking-discount-row">
                <CustomSelect
                  options={DISCOUNT_OPTIONS}
                  value={discountType}
                  onChange={(value) => setDiscountType(value as DiscountType)}
                />
                <input
                  className="form-input"
                  type="number"
                  min={0}
                  value={discountInput}
                  onChange={(event) => setDiscountInput(event.target.value)}
                  placeholder="10"
                />
                <button type="button" className="btn btn-primary btn-md" onClick={applyDiscount} disabled={summary.baseAmount <= 0}>
                  <Check size={16} /> Apply
                </button>
                <button type="button" className="btn btn-secondary btn-md" onClick={clearDiscount} disabled={!appliedDiscount && !discountInput}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </section>
            <div className="card booking-cart-panel" style={{ width: '100%', position: 'static' }}>
          <div className="card-header">
            <h3 style={{ fontSize: 'var(--text-sm)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', margin: 0 }}>
              <Receipt size={16} /> Cart
            </h3>
            <span className="badge badge-neutral">{summary.totalHours.toFixed(summary.totalHours % 1 === 0 ? 0 : 1)} hrs</span>
          </div>
          <div className="card-body" style={{ display: 'grid', gap: 'var(--space-3)' }}>
            {cartItems.length === 0 ? (
              <div className="booking-empty-cart">
                <ShoppingCart size={28} />
                <span>No slots selected</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {Object.entries(
                  cartItems.reduce((acc, item) => {
                    if (!acc[item.bookingDate]) acc[item.bookingDate] = [];
                    acc[item.bookingDate].push(item);
                    return acc;
                  }, {} as Record<string, CartItem[]>)
                ).map(([date, items]) => (
                  <div key={date}>
                    <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: 'var(--space-2)', color: 'var(--text-secondary)' }}>
                      {formatDate(date)}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                      {items.flatMap((item) => item.pricingSnapshot.appliedRules).map((rule, idx) => (
                        <div key={`${date}-${idx}`} className="booking-cart-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 'var(--space-1)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div className="booking-cart-title" style={{ fontSize: 'var(--text-sm)' }}>
                              {formatTime(rule.startTime)} - {formatTime(rule.endTime)}
                            </div>
                            <strong style={{ fontSize: 'var(--text-sm)' }}>Amount: {fmtMoney(rule.amount)}</strong>
                          </div>
                          <div className="booking-cart-meta" style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>{rule.minutes / 60} hour{rule.minutes / 60 === 1 ? '' : 's'}</span>
                            <span>{fmtMoney(rule.rate)}/hour</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {summary.hasZeroPriceItem && (
              <div className="booking-warning">
                <AlertCircle size={16} />
                <span>One or more selected slots has no active price rule.</span>
              </div>
            )}

            <div className="booking-cart-total">
              <span>Subtotal</span>
              <strong>{fmtMoney(summary.baseAmount)}</strong>
            </div>
            <div className="booking-cart-total muted">
              <span>Discount{discountPercentageStr}</span>
              <strong>-{fmtMoney(summary.discountAmount)}</strong>
            </div>
            <div className="booking-cart-total final">
              <span>Final Total</span>
              <strong>{fmtMoney(summary.finalAmount)}</strong>
            </div>
          </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-6)', alignItems: 'center' }}>
              <button className="btn btn-secondary btn-lg" onClick={() => setCurrentStep(2)}>
                <ChevronLeft size={18} /> Back
              </button>
              {canCreateBooking && (
                <button
                  type="button"
                  className={`btn btn-primary btn-lg ${saving ? 'btn-loading' : ''}`}
                  disabled={!canConfirm}
                  onClick={confirmBooking}
                >
                  <CheckCircle size={18} /> Confirm Booking
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function getDiscountAmount(baseAmount: number, discount: AppliedDiscount | null) {
  if (!discount || baseAmount <= 0) return 0;
  if (discount.type === 'percentage') {
    return Math.min(baseAmount, Math.round((baseAmount * Math.min(100, Math.max(0, discount.value))) / 100));
  }

  return Math.min(baseAmount, Math.round(Math.max(0, discount.value)));
}

function todayKey() {
  return formatDateKey(new Date());
}

function addDays(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return formatDateKey(date);
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function fmtMoney(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0).replace(/\s+/g, '');
}

function buildSlotCartItems({
  date,
  slotStarts,
  kind,
  priceType,
  pricing,
}: {
  date: string;
  slotStarts: string[];
  kind: CartItemKind;
  priceType: TurfPriceType;
  pricing: TurfPricingConfig;
}) {
  const ranges = mergeSelectedSlots(slotStarts);
  return ranges.flatMap((range) => {
    const item = quoteCartItem({
      date,
      startTime: range.startTime,
      endTime: range.endTime,
      kind,
      label: kind === 'extra_slot' ? 'Extra slots' : 'Selected slots',
      priceType,
      pricing,
    });
    return item ? [item] : [];
  });
}

function quoteCartItem({
  date,
  startTime,
  endTime,
  kind,
  label,
  priceType,
  pricing,
}: {
  date: string;
  startTime: string;
  endTime: string;
  kind: CartItemKind;
  label: string;
  priceType: TurfPriceType;
  pricing: TurfPricingConfig;
}): CartItem | null {
  try {
    const quote = calculateTurfSlotPrice({
      bookingDate: date,
      startTime,
      endTime,
      priceType,
      weekdayRules: pricing.weekdayRules,
      weekendRules: pricing.weekendRules,
      holidays: pricing.holidays,
      weekendDays: pricing.weekendDays,
    });

    return {
      id: `${kind}-${date}-${startTime}-${endTime}`,
      bookingDate: date,
      startTime,
      endTime,
      label,
      kind,
      amount: quote.amount,
      durationHours: quote.durationHours,
      pricingSnapshot: quote,
    };
  } catch {
    return null;
  }
}

