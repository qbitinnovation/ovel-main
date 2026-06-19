'use client';
import { useState, useEffect, useCallback } from 'react';
import { Calendar, Clock, User as UserIcon, Phone, FileText, CheckCircle, AlertCircle, X, Check, Search, Filter } from 'lucide-react';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { CustomDatePicker } from '@/components/ui/CustomDatePicker';
import {
  DEFAULT_TURF_PRICING_CONFIG,
  type TurfPricingConfig,
  type TurfPricingResult,
} from '@/lib/turf-pricing';

// ---- Types ----
interface BookingData {
  _id: string;
  bookingDate: string | string[];
  startTime: string;
  endTime: string;
  customerName: string;
  contactNumber: string;
  expectedAmount: number;
  notes: string;
  bookingStatus: 'confirmed' | 'cancelled';
  paymentStatus: 'pending' | 'partial' | 'paid';
  totalPaid: number;
  discountAmount: number;
  discountPercentage: number;
  cancelReason: string;
  cancelledAt: string | null;
  cancelledBy: { name: string } | null;
  createdBy: { name: string } | null;
  createdAt: string;
  bulkId?: string | null;
  priceType?: 'normal' | 'regular';
  pricingSnapshot?: TurfPricingResult | null;
}

interface PaymentData {
  _id: string;
  bookingId: string;
  amountPaid: number;
  paymentMode: 'bank_transfer' | 'upi' | 'cash';
  paymentDate: string;
  referenceNumber: string;
  cashReceivedBy: string;
  referenceNote: string;
  discountAmount?: number;
  discountPercentage?: number;
  splits?: Array<{
    amount: number;
    paymentMode: 'bank_transfer' | 'upi' | 'card' | 'cash';
    referenceNumber?: string;
    cashReceivedBy?: string;
    referenceNote?: string;
  }>;
  createdBy: { name: string } | null;
  createdAt: string;
}

interface DashboardSummary {
  totalExpected: number;
  totalReceived: number;
  pendingAmount: number;
  bankTransferTotal: number;
  cashTotal: number;
  partialPaymentsCount: number;
}

interface CashTransaction {
  paymentId: string;
  bookingDate: string;
  timeSlot: string;
  customerName: string;
  amount: number;
  paymentDate: string;
  referenceNote: string;
}

interface CashHolding {
  total: number;
  transactions: CashTransaction[];
}

interface BookingBreakdown {
  _id: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  customerName: string;
  expectedAmount: number;
  totalPaid: number;
  remainingBalance: number;
  paymentModes: string[];
  paymentStatus: string;
}

// ---- Helpers ----
const fmt = (n: number) => {
  if (n === undefined || n === null || Number.isNaN(n)) return '₹0';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
    .format(n)
    .replace(/\s+/g, '');
};

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const fmtTime = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
};

const today = () => new Date().toISOString().split('T')[0];

const getWeekStart = () => {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().split('T')[0];
};

const getMonthStart = () => {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().split('T')[0];
};

const CASH_HOLDER_LABELS: Record<string, string> = {
  turf_owner: 'Turf Owner',
  arjo: 'Arjo',
  turf_staff: 'Turf Staff',
};

const PAYMENT_MODE_LABELS: Record<string, string> = {
  bank_transfer: 'Bank Transfer',
  upi: 'UPI',
  card: 'Card',
  cash: 'Cash',
};

const toTimeValue = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

const TIME_SLOTS = Array.from({ length: 48 }, (_, idx) => {
  const startMinutes = idx * 30;
  const endMinutes = startMinutes + 30;
  const start = toTimeValue(startMinutes);
  const end = endMinutes >= 24 * 60 ? '23:59' : toTimeValue(endMinutes);
  return { label: fmtTime(start), start, end };
});

const toISODateString = (dateInput: Date | string) => {
  if (typeof dateInput === 'string') {
    if (dateInput.includes('T')) {
      return dateInput.split('T')[0];
    }
    return dateInput;
  }
  const y = dateInput.getFullYear();
  const m = String(dateInput.getMonth() + 1).padStart(2, '0');
  const d = String(dateInput.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const parseISODate = (str: string) => {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const calculateDuration = (start: string, end: string) => {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const endMinutes = end === '23:59' ? 24 * 60 : eh * 60 + em;
  let diffMinutes = endMinutes - (sh * 60 + sm);
  if (diffMinutes < 0) return '';
  const hours = Math.floor(diffMinutes / 60);
  const mins = diffMinutes % 60;
  if (hours > 0 && mins > 0) {
    return `${hours} hr ${mins} mins`;
  } else if (hours > 0) {
    return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  } else {
    return `${mins} mins`;
  }
};

type PricingLine = TurfPricingResult['appliedRules'][number];

const getPricingLineAmount = (line: PricingLine) => {
  if (typeof line.amount === 'number') return line.amount;
  return Math.round((Number(line.rate || 0) * Number(line.minutes || 0)) / 60);
};

const getPricingBreakdownTotal = (pricing?: TurfPricingResult | null) => {
  if (!pricing?.appliedRules?.length) return 0;
  return pricing.appliedRules.reduce((sum, line) => sum + getPricingLineAmount(line), 0);
};

const combinePricingQuotes = (quotes: TurfPricingResult[], bookingDates: string[]): TurfPricingResult | null => {
  if (!quotes.length) return null;

  return {
    ...quotes[0],
    amount: quotes.reduce((sum, quote) => sum + Number(quote.amount || 0), 0),
    durationHours: quotes.reduce((sum, quote) => sum + Number(quote.durationHours || 0), 0),
    isHoliday: quotes.some((quote) => quote.isHoliday),
    isWeekend: quotes.some((quote) => quote.isWeekend),
    appliedRules: quotes.flatMap((quote, quoteIndex) => {
      const dateLabel = bookingDates[quoteIndex] ? fmtDate(bookingDates[quoteIndex]) : '';
      return (quote.appliedRules || []).map((line) => ({
        ...line,
        name: quotes.length > 1 && dateLabel
          ? `${dateLabel} - ${line.name || 'Slot Rule'}`
          : line.name || 'Slot Rule',
      }));
    }),
  };
};

const PricingBreakdown = ({
  pricing,
  totalAmount,
  title = 'Price Breakdown',
}: {
  pricing?: TurfPricingResult | null;
  totalAmount?: number;
  title?: string;
}) => {
  const lines = pricing?.appliedRules || [];
  if (lines.length === 0) return null;

  const total = totalAmount ?? (getPricingBreakdownTotal(pricing) || pricing?.amount || 0);

  return (
    <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--surface-glass-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', display: 'grid', gap: 'var(--space-2)' }}>
      <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{title}</div>
      {lines.map((line, index) => (
        <div key={`${line.startTime}-${line.endTime}-${index}`} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 'var(--space-3)', alignItems: 'center', paddingBottom: index < lines.length - 1 ? 'var(--space-2)' : 0, borderBottom: index < lines.length - 1 ? '1px dashed var(--surface-glass-border)' : 'none' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{fmtTime(line.startTime)} - {fmtTime(line.endTime)}</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 2 }}>
              {fmt(line.rate)}/hr
              {line.minutes ? ` • ${line.minutes} min` : ''}
              {line.name ? ` • ${line.name}` : ''}
            </div>
          </div>
          <div style={{ fontWeight: 700, color: line.rate > 0 ? 'var(--text-primary)' : 'var(--status-danger)', whiteSpace: 'nowrap' }}>{fmt(getPricingLineAmount(line))}</div>
        </div>
      ))}
      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--surface-glass-border)', paddingTop: 'var(--space-2)', marginTop: 'var(--space-1)', fontWeight: 800 }}>
        <span>Total Amount</span>
        <span style={{ color: 'var(--status-success)', whiteSpace: 'nowrap' }}>{fmt(total)}</span>
      </div>
    </div>
  );
};

const formatBookingDates = (dates: string[]) => {
  if (!dates || dates.length === 0) return '';
  if (dates.length === 1) {
    return new Date(dates[0]).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  // Sort dates
  const sorted = [...dates].sort((a, b) => a.localeCompare(b));
  const dateObjs = sorted.map(d => {
    const [y, m, day] = d.split('T')[0].split('-').map(Number);
    return new Date(y, m - 1, day);
  });
  
  // Check if consecutive
  let isConsecutive = true;
  for (let i = 1; i < dateObjs.length; i++) {
    const diff = dateObjs[i].getTime() - dateObjs[i - 1].getTime();
    if (diff !== 24 * 60 * 60 * 1000) {
      isConsecutive = false;
      break;
    }
  }

  const optDayMonth: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };

  if (isConsecutive) {
    const startStr = dateObjs[0].toLocaleDateString('en-IN', optDayMonth);
    const endStr = dateObjs[dateObjs.length - 1].toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${startStr} – ${endStr}`;
  } else {
    const year = dateObjs[0].getFullYear();
    const formattedDates = dateObjs.map(d => d.toLocaleDateString('en-IN', optDayMonth));
    return `${formattedDates.join(', ')} (${year})`;
  }
};

const formatSingleDate = (d: string | string[]) => {
  const dateStr = Array.isArray(d) ? d[0] : d;
  if (!dateStr) return '';
  const dateObj = new Date(dateStr);
  const day = dateObj.getDate();
  const months = ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May'];
  const monthsCorrect = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = monthsCorrect[dateObj.getMonth()];
  const year = dateObj.getFullYear();
  return `${day} ${month} ${year}`;
};

const bookingDateKey = (date: string | string[]) => Array.isArray(date) ? date[0] : date;

const getGroupedBookings = (bookingsList: BookingData[]) => {
  const groups: Record<string, BookingData[]> = {};
  const ungrouped: BookingData[] = [];

  bookingsList.forEach((b) => {
    if (b.bulkId) {
      if (!groups[b.bulkId]) {
        groups[b.bulkId] = [];
      }
      groups[b.bulkId].push(b);
    } else {
      ungrouped.push(b);
    }
  });

  const groupedList: any[] = [...ungrouped.map((b) => ({ ...b, isGroup: false }))];

  Object.entries(groups).forEach(([bulkId, groupBookings]) => {
    const sorted = [...groupBookings].sort((a, b) => bookingDateKey(a.bookingDate).localeCompare(bookingDateKey(b.bookingDate)));
    
    const totalExpected = sorted.reduce((sum, b) => sum + b.expectedAmount, 0);
    const totalPaid = sorted.reduce((sum, b) => sum + b.totalPaid, 0);
    const totalDiscount = sorted.reduce((sum, b) => sum + (b.discountAmount || 0), 0);
    const finalPayable = totalExpected - totalDiscount;
    
    let paymentStatus: 'pending' | 'partial' | 'paid' = 'pending';
    if (totalPaid === 0) {
      paymentStatus = 'pending';
    } else if (totalPaid >= finalPayable) {
      paymentStatus = 'paid';
    } else {
      paymentStatus = 'partial';
    }

    const isAnyConfirmed = sorted.some((b) => b.bookingStatus === 'confirmed');
    const bookingStatus = isAnyConfirmed ? 'confirmed' : 'cancelled';

    groupedList.push({
      _id: sorted[0]._id,
      bulkId,
      isGroup: true,
      bookings: sorted,
      bookingDate: sorted.map((b) => b.bookingDate),
      startTime: sorted[0].startTime,
      endTime: sorted[0].endTime,
      customerName: sorted[0].customerName,
      contactNumber: sorted[0].contactNumber,
      expectedAmount: totalExpected,
      totalPaid: totalPaid,
      discountAmount: totalDiscount,
      notes: sorted.map(b => b.notes).filter(Boolean).join(' | ') || sorted[0].notes,
      bookingStatus,
      paymentStatus,
      createdBy: sorted[0].createdBy,
      createdAt: sorted[0].createdAt,
    });
  });

  return groupedList.sort((a, b) => {
    const aDate = a.isGroup ? a.bookings[0].bookingDate : a.bookingDate;
    const bDate = b.isGroup ? b.bookings[0].bookingDate : b.bookingDate;
    const dateCompare = bDate.localeCompare(aDate);
    if (dateCompare !== 0) return dateCompare;
    
    return b.startTime.localeCompare(a.startTime);
  });
};

// ---- Component ----
export default function BookingsPage() {
  // --- State ---
  const [activeTab, setActiveTab] = useState<'bookings' | 'payments'>('bookings');
  const [bookings, setBookings] = useState<BookingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: string } | null>(null);

  // Pricing settings from Admin Settings
  const [pricingSettings, setPricingSettings] = useState<TurfPricingConfig>(DEFAULT_TURF_PRICING_CONFIG);

  // Booking form
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [bfDate, setBfDate] = useState(today());
  const [bfStartTime, setBfStartTime] = useState('');
  const [bfEndTime, setBfEndTime] = useState('');
  const [bfCustomer, setBfCustomer] = useState('');
  const [bfContact, setBfContact] = useState('');
  const [bfAmount, setBfAmount] = useState('');
  const [bfNotes, setBfNotes] = useState('');
  const [bfError, setBfError] = useState('');
  const [bfSaving, setBfSaving] = useState(false);
  const [viewStartDate, setViewStartDate] = useState<Date>(new Date());
  const [detectedRule, setDetectedRule] = useState<TurfPricingResult | null>(null);

  // Rate Type Selection
  const [bfPriceType, setBfPriceType] = useState<'normal' | 'regular' | null>(null);
  const [bfDiscountType, setBfDiscountType] = useState<'fixed' | 'percentage'>('fixed');
  const [bfDiscountValue, setBfDiscountValue] = useState<string>('');
  const [normalQuote, setNormalQuote] = useState<any>(null);
  const [regularQuote, setRegularQuote] = useState<any>(null);
  const [normalTotalAmount, setNormalTotalAmount] = useState<number>(0);
  const [regularTotalAmount, setRegularTotalAmount] = useState<number>(0);

  // Booking type: standard or bulk/full-day
  const [bookingType, setBookingType] = useState<'standard' | 'bulk'>('standard');

  // Bulk mode: extra hours on a second day
  const [bulkExtraEnabled, setBulkExtraEnabled] = useState(false);
  const [bulkExtraDate, setBulkExtraDate] = useState('');
  const [bulkExtraMode, setBulkExtraMode] = useState<'am' | 'pm'>('am');
  const [bulkExtraQuote, setBulkExtraQuote] = useState<TurfPricingResult | null>(null);
  const [bulkExtraAmount, setBulkExtraAmount] = useState<number>(0);

  // Summary / review step
  const [showSummary, setShowSummary] = useState(false);


  // View booking
  const [viewBooking, setViewBooking] = useState<BookingData | null>(null);
  const [viewPayments, setViewPayments] = useState<PaymentData[]>([]);
  const [viewLoading, setViewLoading] = useState(false);

  // Edit booking
  const [editMode, setEditMode] = useState(false);
  const [efCustomer, setEfCustomer] = useState('');
  const [efContact, setEfContact] = useState('');
  const [efAmount, setEfAmount] = useState('');
  const [efNotes, setEfNotes] = useState('');
  const [efSaving, setEfSaving] = useState(false);

  // Cancel booking
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  // Payment form
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentBooking, setPaymentBooking] = useState<BookingData | null>(null);
  const [pfDiscountAmount, setPfDiscountAmount] = useState<number>(0);
  const [pfDiscountPercentage, setPfDiscountPercentage] = useState<number>(0);
  const [pfSplits, setPfSplits] = useState<any[]>([
    { amount: 0, paymentMode: 'bank_transfer', referenceNumber: '', cashReceivedBy: '', referenceNote: '' }
  ]);
  const [pfPreviousSplits, setPfPreviousSplits] = useState<any[]>([]);
  const [pfDate, setPfDate] = useState(today());
  const [pfSaving, setPfSaving] = useState(false);
  const [pfError, setPfError] = useState('');

  const addSplit = (finalPayable: number) => {
    const totalPreviousPaid = pfPreviousSplits.reduce((sum, s) => sum + Number(s.amount || 0), 0);
    const totalCurrentNew = pfSplits.reduce((sum, s) => sum + Number(s.amount || 0), 0);
    const remaining = Math.max(0, finalPayable - totalPreviousPaid - totalCurrentNew);
    setPfSplits([...pfSplits, { amount: remaining, paymentMode: 'bank_transfer', referenceNumber: '', cashReceivedBy: '', referenceNote: '' }]);
  };

  const removeSplit = (index: number) => {
    setPfSplits(pfSplits.filter((_, i) => i !== index));
  };

  const updateSplit = (index: number, key: string, val: any) => {
    if (key === 'amount') {
      const finalPayable = paymentBooking ? paymentBooking.expectedAmount - pfDiscountAmount : 0;
      const totalPreviousPaid = pfPreviousSplits.reduce((sum, s) => sum + Number(s.amount || 0), 0);
      const otherNewSplitsSum = pfSplits
        .filter((_, i) => i !== index)
        .reduce((sum, s) => sum + Number(s.amount || 0), 0);
      const maxAllowed = Math.max(0, finalPayable - totalPreviousPaid - otherNewSplitsSum);
      const inputAmt = Number(val) || 0;
      const cappedAmt = Math.min(inputAmt, maxAllowed);
      setPfSplits(pfSplits.map((s, i) => i === index ? { ...s, amount: cappedAmt } : s));
    } else {
      setPfSplits(pfSplits.map((s, i) => i === index ? { ...s, [key]: val } : s));
    }
  };

  // Dashboard state
  const [dashLoading, setDashLoading] = useState(false);
  const [dashSummary, setDashSummary] = useState<DashboardSummary | null>(null);
  const [dashCashHoldings, setDashCashHoldings] = useState<Record<string, CashHolding>>({});
  const [dashBreakdown, setDashBreakdown] = useState<BookingBreakdown[]>([]);
  const [dashFilter, setDashFilter] = useState<'today' | 'week' | 'month' | 'custom' | 'all'>('month');
  const [dashStartDate, setDashStartDate] = useState(getMonthStart());
  const [dashEndDate, setDashEndDate] = useState(today());
  const [expandedHolder, setExpandedHolder] = useState<string | null>(null);

  const showToast = (message: string, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // --- Data Fetching ---
  const fetchBookings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/bookings?limit=100');
      const data = await res.json();
      if (data.success) setBookings(data.data.bookings);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDashboard = useCallback(async () => {
    try {
      setDashLoading(true);
      const params = new URLSearchParams();
      if (dashFilter !== 'all') {
        params.set('startDate', dashStartDate);
        params.set('endDate', dashEndDate);
      }
      const res = await fetch(`/api/bookings/dashboard?${params}`);
      const data = await res.json();
      if (data.success) {
        setDashSummary(data.data.summary);
        setDashCashHoldings(data.data.cashHoldings);
        setDashBreakdown(data.data.bookingBreakdown);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDashLoading(false);
    }
  }, [dashStartDate, dashEndDate, dashFilter]);

  // Fetch pricing settings from Admin Settings
  const fetchPricingSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/pricing');
      const data = await res.json();
      if (data.success) {
        setPricingSettings(data.data.pricing);
      }
    } catch (err) {
      console.error('Error fetching pricing settings:', err);
    }
  }, []);

  useEffect(() => {
    fetchBookings();
    fetchPricingSettings();
  }, [fetchBookings, fetchPricingSettings]);

  useEffect(() => {
    if (showBookingForm) fetchPricingSettings();
  }, [showBookingForm, fetchPricingSettings]);

  useEffect(() => {
    if (activeTab === 'payments') {
      fetchDashboard();
    }
  }, [activeTab, fetchDashboard]);

  // Update date range based on filter preset
  useEffect(() => {
    if (dashFilter === 'today') {
      setDashStartDate(today());
      setDashEndDate(today());
    } else if (dashFilter === 'week') {
      setDashStartDate(getWeekStart());
      setDashEndDate(today());
    } else if (dashFilter === 'month') {
      setDashStartDate(getMonthStart());
      setDashEndDate(today());
    }
  }, [dashFilter]);

  // --- Actions ---

  const handleCreateBooking = async () => {
    setBfError('');

    if (!bfPriceType) {
      setBfError('Please select a Rate Type');
      return;
    }

    if (bookingType === 'standard') {
      if (!bfDate || !bfStartTime || !bfEndTime) {
        setBfError('Please select a date and time slots');
        return;
      }
      if (bfStartTime >= bfEndTime) {
        setBfError('Start time must be before end time');
        return;
      }
      if (!bfAmount || Number(bfAmount) <= 0) {
        setBfError('Expected amount must be greater than 0');
        return;
      }

      setBfSaving(true);
      try {
        const res = await fetch('/api/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bookingDate: bfDate,
            startTime: bfStartTime,
            endTime: bfEndTime,
            customerName: bfCustomer,
            contactNumber: bfContact,
            notes: bfNotes,
            bulkId: null,
            priceType: bfPriceType,
            discountAmount: 0,
            discountPercentage: 0,
          }),
        });
        const data = await res.json();
        if (!data.success) {
          setBfError(`${fmtDate(bfDate)}: ${data.message}`);
          return;
        }
        showToast('Booking confirmed!');
        resetBookingForm();
        fetchBookings();
      } catch {
        setBfError('Network error');
      } finally {
        setBfSaving(false);
      }
    } else {
      // Bulk / Full-Day booking
      if (!bfDate) {
        setBfError('Please select a date');
        return;
      }

      setBfSaving(true);
      const generatedBulkId = `bulk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      try {
        // Day 1: Full day 00:00 – 23:59
        const res1 = await fetch('/api/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bookingDate: bfDate,
            startTime: '00:00',
            endTime: '23:59',
            customerName: bfCustomer,
            contactNumber: bfContact,
            notes: bfNotes,
            bulkId: generatedBulkId,
            priceType: bfPriceType,
            discountAmount: 0,
            discountPercentage: 0,
          }),
        });
        const data1 = await res1.json();
        if (!data1.success) {
          setBfError(`Day 1 (${fmtDate(bfDate)}): ${data1.message}`);
          return;
        }

        // Day 2: Extra hours (if enabled)
        if (bulkExtraEnabled && bulkExtraDate) {
          const extraStart = bulkExtraMode === 'am' ? '06:00' : '14:00';
          const extraEnd = bulkExtraMode === 'am' ? '14:00' : '22:00';
          const res2 = await fetch('/api/bookings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              bookingDate: bulkExtraDate,
              startTime: extraStart,
              endTime: extraEnd,
              customerName: bfCustomer,
              contactNumber: bfContact,
              notes: bfNotes ? `${bfNotes} (Extra hours)` : 'Extra hours',
              bulkId: generatedBulkId,
              priceType: bfPriceType,
              discountAmount: 0,
              discountPercentage: 0,
            }),
          });
          const data2 = await res2.json();
          if (!data2.success) {
            setBfError(`Day 2 (${fmtDate(bulkExtraDate)}): ${data2.message}`);
            return;
          }
        }

        showToast('Bulk booking confirmed!');
        resetBookingForm();
        fetchBookings();
      } catch {
        setBfError('Network error');
      } finally {
        setBfSaving(false);
      }
    }
  };

  // When booking type switches to bulk, auto-set full-day times
  useEffect(() => {
    if (bookingType === 'bulk') {
      setBfStartTime('00:00');
      setBfEndTime('23:59');
    } else {
      setBfStartTime('');
      setBfEndTime('');
    }
  }, [bookingType]);

  // Auto-calculate booking amount from Settings-driven slot rules.
  useEffect(() => {
    let ignore = false;
    if (!bfStartTime || !bfEndTime) {
      setNormalQuote(null);
      setRegularQuote(null);
      setNormalTotalAmount(0);
      setRegularTotalAmount(0);
      return;
    }

    const bookingDates = [bfDate];

    const fetchQuotes = async () => {
      try {
        const quotesNormal = await Promise.all(
          bookingDates.map(async (date) => {
            const params = new URLSearchParams({
              bookingDate: date,
              startTime: bfStartTime,
              endTime: bfEndTime,
              priceType: 'normal',
            });
            const res = await fetch(`/api/settings/pricing?${params}`);
            if (!res.ok) {
              const errData = await res.json().catch(() => ({}));
              throw new Error(errData.message || 'No active pricing rule matches this slot');
            }
            const data = await res.json();
            if (!data.success) {
              throw new Error(data.message || 'Failed to calculate price');
            }
            return data.data.quote;
          })
        );

        const quotesRegular = await Promise.all(
          bookingDates.map(async (date) => {
            const params = new URLSearchParams({
              bookingDate: date,
              startTime: bfStartTime,
              endTime: bfEndTime,
              priceType: 'regular',
            });
            const res = await fetch(`/api/settings/pricing?${params}`);
            if (!res.ok) {
              const errData = await res.json().catch(() => ({}));
              throw new Error(errData.message || 'No active pricing rule matches this slot');
            }
            const data = await res.json();
            if (!data.success) {
              throw new Error(data.message || 'Failed to calculate price');
            }
            return data.data.quote;
          })
        );

        if (ignore) return;

        const normalAmount = quotesNormal.reduce((sum, q) => sum + q.amount, 0);
        const regularAmount = quotesRegular.reduce((sum, q) => sum + q.amount, 0);

        setNormalQuote(combinePricingQuotes(quotesNormal, bookingDates));
        setRegularQuote(combinePricingQuotes(quotesRegular, bookingDates));
        setNormalTotalAmount(normalAmount);
        setRegularTotalAmount(regularAmount);
        setBfError('');
      } catch (error) {
        if (ignore) return;
        setNormalQuote(null);
        setRegularQuote(null);
        setNormalTotalAmount(0);
        setRegularTotalAmount(0);
        setBfError(error instanceof Error ? error.message : 'No active pricing rule matches this slot');
      }
    };

    fetchQuotes();

    return () => {
      ignore = true;
    };
  }, [bfDate, bfStartTime, bfEndTime]);

  // Update selected quote and expected amount
  useEffect(() => {
    let baseAmount = 0;
    let quote = null;

    if (bfPriceType === 'normal') {
      baseAmount = normalTotalAmount;
      quote = normalQuote;
    } else if (bfPriceType === 'regular') {
      baseAmount = regularTotalAmount;
      quote = regularQuote;
    }

    if (!bfPriceType || baseAmount <= 0) {
      setBfAmount('');
      setDetectedRule(null);
      return;
    }

    let finalAmt = baseAmount;

    finalAmt = Math.max(0, Math.round(finalAmt));
    setBfAmount(finalAmt.toString());
    setDetectedRule(quote);
  }, [bfPriceType, normalTotalAmount, regularTotalAmount, normalQuote, regularQuote]);

  // Fetch pricing for bulk extra hours (Day 2)
  useEffect(() => {
    let ignore = false;
    if (!bulkExtraEnabled || !bulkExtraDate || !bfPriceType) {
      setBulkExtraQuote(null);
      setBulkExtraAmount(0);
      return;
    }

    const extraStart = bulkExtraMode === 'am' ? '06:00' : '14:00';
    const extraEnd = bulkExtraMode === 'am' ? '14:00' : '22:00';

    const fetchExtraQuote = async () => {
      try {
        const params = new URLSearchParams({
          bookingDate: bulkExtraDate,
          startTime: extraStart,
          endTime: extraEnd,
          priceType: bfPriceType,
        });
        const res = await fetch(`/api/settings/pricing?${params}`);
        if (!res.ok) throw new Error('Failed to fetch extra hours pricing');
        const data = await res.json();
        if (!data.success) throw new Error(data.message);
        if (ignore) return;
        setBulkExtraQuote(data.data.quote);
        setBulkExtraAmount(data.data.quote.amount || 0);
      } catch {
        if (ignore) return;
        setBulkExtraQuote(null);
        setBulkExtraAmount(0);
      }
    };

    fetchExtraQuote();
    return () => { ignore = true; };
  }, [bulkExtraEnabled, bulkExtraDate, bulkExtraMode, bfPriceType]);


  const getOverlappingBookings = (dateStr: string, start: string, end: string) => {
    return bookings.filter((b) => {
      if (b.bookingStatus !== 'confirmed') return false;
      const bDateStr = toISODateString(new Date(bookingDateKey(b.bookingDate)));
      if (bDateStr !== dateStr) return false;
      return b.startTime < end && start < b.endTime;
    });
  };

  const resetBookingForm = () => {
    setShowBookingForm(false);
    setBfDate(today());
    setBfStartTime('');
    setBfEndTime('');
    setBfCustomer('');
    setBfContact('');
    setBfAmount('');
    setBfNotes('');
    setBfError('');
    setViewStartDate(new Date());
    setDetectedRule(null);
    setBfPriceType(null);
    setBfDiscountType('fixed');
    setBfDiscountValue('');
    setNormalQuote(null);
    setRegularQuote(null);
    setNormalTotalAmount(0);
    setRegularTotalAmount(0);
    setBookingType('standard');
    setBulkExtraEnabled(false);
    setBulkExtraDate('');
    setBulkExtraMode('am');
    setBulkExtraQuote(null);
    setBulkExtraAmount(0);
    setShowSummary(false);
  };

  const getDaysRange = (start: Date) => {
    const arr = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      arr.push(d);
    }
    return arr;
  };

  const handlePrevDay = () => {
    const d = new Date(viewStartDate);
    d.setDate(d.getDate() - 1);
    setViewStartDate(d);
  };

  const handleNextDay = () => {
    const d = new Date(viewStartDate);
    d.setDate(d.getDate() + 1);
    setViewStartDate(d);
  };

  const isSlotBooked = (dateStr: string, slotStart: string, slotEnd: string) => {
    return bookings.some((b) => {
      if (b.bookingStatus !== 'confirmed') return false;
      const bDateStr = toISODateString(new Date(bookingDateKey(b.bookingDate)));
      if (bDateStr !== dateStr) return false;
      return b.startTime < slotEnd && slotStart < b.endTime;
    });
  };

  const handleSlotClick = (slot: { start: string; end: string }) => {
    if (isSlotBooked(bfDate, slot.start, slot.end)) return;
    
    if (!bfStartTime || !bfEndTime) {
      setBfStartTime(slot.start);
      setBfEndTime(slot.end);
      return;
    }
    
    const isCurrentlySelected = slot.start >= bfStartTime && slot.end <= bfEndTime;
    
    if (isCurrentlySelected) {
      setBfStartTime('');
      setBfEndTime('');
      return;
    }
    
    const startIndex = TIME_SLOTS.findIndex(s => s.start === bfStartTime);
    const endIndex = TIME_SLOTS.findIndex(s => s.end === bfEndTime);
    const clickIndex = TIME_SLOTS.findIndex(s => s.start === slot.start);
    
    const isSingleSlot = startIndex === endIndex;
    
    if (isSingleSlot && startIndex !== -1 && clickIndex !== -1) {
      const minIdx = Math.min(startIndex, clickIndex);
      const maxIdx = Math.max(startIndex, clickIndex);
      
      let hasBookedBetween = false;
      for (let i = minIdx; i <= maxIdx; i++) {
        const s = TIME_SLOTS[i];
        if (isSlotBooked(bfDate, s.start, s.end)) {
          hasBookedBetween = true;
          break;
        }
      }
      
      if (!hasBookedBetween) {
        setBfStartTime(TIME_SLOTS[minIdx].start);
        setBfEndTime(TIME_SLOTS[maxIdx].end);
      } else {
        setBfStartTime(slot.start);
        setBfEndTime(slot.end);
      }
    } else {
      setBfStartTime(slot.start);
      setBfEndTime(slot.end);
    }
  };

  const openViewBooking = async (booking: BookingData) => {
    setViewBooking(booking);
    setEditMode(false);
    setShowCancel(false);
    setViewLoading(true);
    try {
      const res = await fetch(`/api/bookings/${booking._id}`);
      const data = await res.json();
      if (data.success) {
        const isGroup = (booking as any).isGroup;
        setViewBooking(isGroup ? {
          ...data.data.booking,
          isGroup: true,
          bookings: (booking as any).bookings,
          bookingDate: (booking as any).bookingDate,
          expectedAmount: (booking as any).expectedAmount,
          totalPaid: (booking as any).totalPaid,
          paymentStatus: (booking as any).paymentStatus,
        } : data.data.booking);
        setViewPayments(data.data.payments);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setViewLoading(false);
    }
  };

  const startEdit = () => {
    if (!viewBooking) return;
    setEfCustomer(viewBooking.customerName);
    setEfContact(viewBooking.contactNumber);
    setEfAmount(viewBooking.expectedAmount.toString());
    setEfNotes(viewBooking.notes);
    setEditMode(true);
  };

  const handleEditBooking = async () => {
    if (!viewBooking) return;
    setEfSaving(true);
    try {
      const isGroup = (viewBooking as any).isGroup;

      const res = await fetch(`/api/bookings/${viewBooking._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: efCustomer,
          contactNumber: efContact,
          notes: efNotes,
          updateGroup: isGroup,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Booking updated ✅');
        setEditMode(false);
        setViewBooking(null);
        fetchBookings();
      } else {
        showToast(data.message, 'error');
      }
    } catch {
      showToast('Network error', 'error');
    } finally {
      setEfSaving(false);
    }
  };

  const handleCancelBooking = async () => {
    if (!viewBooking) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/bookings/${viewBooking._id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cancelReason }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Booking cancelled');
        setViewBooking(null);
        setShowCancel(false);
        setCancelReason('');
        fetchBookings();
      } else {
        showToast(data.message, 'error');
      }
    } catch {
      showToast('Network error', 'error');
    } finally {
      setCancelling(false);
    }
  };

  const openPaymentForm = async (booking: BookingData) => {
    setPaymentBooking(booking);
    setShowPaymentForm(true);
    setPfDate(today());
    setPfError('');
    setPfSaving(false);

    const initialDiscountAmount = booking.discountAmount || 0;
    const initialDiscountPercentage = booking.discountPercentage || 0;
    setPfDiscountAmount(initialDiscountAmount);
    setPfDiscountPercentage(initialDiscountPercentage);

    setPfPreviousSplits([]);
    const finalPayable = booking.expectedAmount - initialDiscountAmount;
    setPfSplits([
      { amount: finalPayable, paymentMode: 'bank_transfer', referenceNumber: '', cashReceivedBy: '', referenceNote: '' }
    ]);

    try {
      const res = await fetch(`/api/bookings/${booking._id}/payments`);
      const data = await res.json();
      if (data.success && data.data.payments && data.data.payments.length > 0) {
        const existingPayment = data.data.payments[0];
        const existingDiscountAmount = existingPayment.discountAmount !== undefined ? existingPayment.discountAmount : initialDiscountAmount;
        const existingDiscountPercentage = existingPayment.discountPercentage !== undefined ? existingPayment.discountPercentage : initialDiscountPercentage;
        
        setPfDiscountAmount(existingDiscountAmount);
        setPfDiscountPercentage(existingDiscountPercentage);

        const currentFinalPayable = booking.expectedAmount - existingDiscountAmount;
        
        let loadedSplits = [];
        if (existingPayment.splits && existingPayment.splits.length > 0) {
          loadedSplits = existingPayment.splits;
        } else if (existingPayment.amountPaid > 0) {
          loadedSplits = [{
            amount: existingPayment.amountPaid,
            paymentMode: existingPayment.paymentMode,
            referenceNumber: existingPayment.referenceNumber || '',
            cashReceivedBy: existingPayment.cashReceivedBy || '',
            referenceNote: existingPayment.referenceNote || '',
          }];
        }

        setPfPreviousSplits(loadedSplits);

        const totalPreviousPaid = loadedSplits.reduce((sum: number, s: any) => sum + Number(s.amount || 0), 0);
        const remaining = Math.max(0, currentFinalPayable - totalPreviousPaid);

        if (remaining > 0) {
          setPfSplits([
            { amount: remaining, paymentMode: 'bank_transfer', referenceNumber: '', cashReceivedBy: '', referenceNote: '' }
          ]);
        } else {
          setPfSplits([]);
        }

        if (existingPayment.paymentDate) {
          setPfDate(existingPayment.paymentDate.split('T')[0]);
        }
      }
    } catch (err) {
      console.error('Error fetching existing payments:', err);
    }
  };

  const handleAddPayment = async () => {
    setPfError('');
    if (!paymentBooking) return;
    if (!pfDate) {
      setPfError('Payment date is required');
      return;
    }

    const finalPayable = paymentBooking.expectedAmount - pfDiscountAmount;
    const totalPreviousPaid = pfPreviousSplits.reduce((sum, s) => sum + Number(s.amount || 0), 0);
    const totalNewSplitsAmount = pfSplits.reduce((sum, s) => sum + Number(s.amount || 0), 0);
    const totalPaidAmount = totalPreviousPaid + totalNewSplitsAmount;

    if (totalNewSplitsAmount <= 0) {
      setPfError('Please enter a payment amount greater than 0');
      return;
    }

    if (totalPaidAmount > finalPayable) {
      setPfError(`Total paid (₹${totalPaidAmount}) cannot exceed the final payable amount (₹${finalPayable})`);
      return;
    }

    for (let i = 0; i < pfSplits.length; i++) {
      const s = pfSplits[i];
      if (s.amount <= 0) {
        setPfError(`Split #${i + 1} amount must be greater than 0`);
        return;
      }
      if (s.paymentMode === 'cash' && !s.cashReceivedBy) {
        setPfError(`Cash Received By is required for Split #${i + 1}`);
        return;
      }
    }

    const mergedSplits = [...pfPreviousSplits, ...pfSplits];

    setPfSaving(true);
    try {
      const res = await fetch(`/api/bookings/${paymentBooking._id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discountAmount: pfDiscountAmount,
          discountPercentage: pfDiscountPercentage,
          splits: mergedSplits,
          paymentDate: pfDate,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Payment recorded! 💰');
        setShowPaymentForm(false);
        fetchBookings();
        if (viewBooking && viewBooking._id === paymentBooking._id) {
          openViewBooking(paymentBooking);
        }
      } else {
        setPfError(data.message || 'Error saving payment');
      }
    } catch {
      setPfError('Network error');
    } finally {
      setPfSaving(false);
    }
  };

  // --- Export ---
  const handleExport = () => {
    if (!dashBreakdown.length) return;
    const headers = ['Date', 'Time Slot', 'Customer', 'Expected', 'Paid', 'Balance', 'Mode', 'Status'];
    const rows = dashBreakdown.map(b => [
      fmtDate(b.bookingDate),
      `${fmtTime(b.startTime)} - ${fmtTime(b.endTime)}`,
      b.customerName,
      b.expectedAmount,
      b.totalPaid,
      b.remainingBalance,
      b.paymentModes.map(m => PAYMENT_MODE_LABELS[m] || m).join(', '),
      b.paymentStatus,
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payment_report_${dashStartDate}_to_${dashEndDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Report exported as CSV');
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { cls: string; label: string }> = {
      pending: { cls: 'badge-warning', label: 'Pending' },
      partial: { cls: 'badge-info', label: 'Partial Payment' },
      paid: { cls: 'badge-success', label: 'Paid' },
      confirmed: { cls: 'badge-success', label: 'Confirmed' },
      cancelled: { cls: 'badge-danger', label: 'Cancelled' },
    };
    const m = map[status] || { cls: 'badge-neutral', label: status };
    return <span className={`badge ${m.cls} badge-dot`}>{m.label}</span>;
  };

  const overlaps = bfDate && bfStartTime && bfEndTime ? getOverlappingBookings(bfDate, bfStartTime, bfEndTime) : [];
  const hasConflict = overlaps.length > 0;

  // ========================
  // RENDER
  // ========================
  return (
    <div className="page-container">
      {/* Toast */}
      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type === 'error' ? 'error' : 'success'}`}>
            <span className="toast-icon">{toast.type === 'error' ? '✕' : '✓'}</span>
            <div className="toast-content"><div className="toast-title">{toast.message}</div></div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Bookings</h1>
          <p className="page-subtitle">Turf booking reservations and payment tracking</p>
        </div>
        {activeTab === 'bookings' && (
          <button className="btn btn-primary btn-md" onClick={() => setShowBookingForm(true)}>+ New Booking</button>
        )}
        {activeTab === 'payments' && (
          <button className="btn btn-secondary btn-md" onClick={handleExport} disabled={!dashBreakdown.length}>📥 Export CSV</button>
        )}
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: 'var(--space-6)' }}>
        <button className={`tab ${activeTab === 'bookings' ? 'active' : ''}`} onClick={() => setActiveTab('bookings')}>
          📅 Bookings
        </button>
        <button className={`tab ${activeTab === 'payments' ? 'active' : ''}`} onClick={() => setActiveTab('payments')}>
          💰 Payments
        </button>
      </div>

      {/* ===================== BOOKINGS TAB ===================== */}
      {activeTab === 'bookings' && (
        <>
          {loading ? (
            <div className="loading-screen"><div className="spinner spinner-lg" /><div className="loading-text">Loading bookings...</div></div>
          ) : bookings.length === 0 ? (
            <div className="card"><div className="empty-state"><div className="empty-state-icon">📅</div><div className="empty-state-title">No bookings yet</div><div className="empty-state-description">Create your first turf booking reservation.</div></div></div>
          ) : (
            <>
              {/* DESKTOP TABLE VIEW */}
              <div className="card desktop-only">
                <div className="data-table-wrapper" style={{ overflowX: 'auto' }}>
                  <table className="data-table" style={{ width: '100%', minWidth: '900px', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--surface-glass-border)', textAlign: 'left', color: 'var(--text-secondary)', fontSize: 'var(--text-xs)', fontWeight: 600, textTransform: 'uppercase' }}>
                        <th style={{ padding: 'var(--space-4)' }}>DATE</th>
                        <th style={{ padding: 'var(--space-4)' }}>TIME SLOT</th>
                        <th style={{ padding: 'var(--space-4)' }}>CUSTOMER</th>
                        <th style={{ padding: 'var(--space-4)' }}>CONTACT</th>
                        <th style={{ padding: 'var(--space-4)' }}>PAYMENT</th>
                        <th style={{ padding: 'var(--space-4)' }}>STATUS</th>
                        <th style={{ padding: 'var(--space-4)' }}>ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getGroupedBookings(bookings).map(b => (
                        <tr key={`desk-${b._id}`} style={{ borderBottom: '1px solid var(--surface-glass-border)', opacity: b.bookingStatus === 'cancelled' ? 0.55 : 1 }}>
                          <td style={{ padding: 'var(--space-4)', whiteSpace: 'nowrap', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {formatBookingDates(b.isGroup ? b.bookingDate : [b.bookingDate])}
                          </td>
                          <td style={{ padding: 'var(--space-4)', whiteSpace: 'nowrap', fontWeight: 500 }}>
                            {fmtTime(b.startTime)} - {fmtTime(b.endTime)}
                          </td>
                          <td style={{ padding: 'var(--space-4)' }}>
                            <span style={{ fontStyle: b.customerName ? 'normal' : 'italic', color: b.customerName ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: 500 }}>
                              {b.customerName || 'Anonymous'}
                              {b.isGroup && (
                                <span style={{ color: 'var(--accent-primary)', fontSize: 'var(--text-xs)', marginLeft: 'var(--space-2)' }}>
                                  ({b.bookings.length} Days Bulk)
                                </span>
                              )}
                            </span>
                          </td>
                          <td style={{ padding: 'var(--space-4)', color: 'var(--text-secondary)' }}>{b.contactNumber || '—'}</td>
                          <td style={{ padding: 'var(--space-4)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              {statusBadge(b.paymentStatus)}
                              {b.paymentStatus !== 'pending' && (
                                <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                                  Paid: {fmt(b.totalPaid)}
                                  {b.paymentStatus === 'partial' && (
                                    <>
                                      <br />
                                      Bal: {fmt((b.expectedAmount - (b.discountAmount || 0)) - b.totalPaid)}
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                           </td>
                          <td style={{ padding: 'var(--space-4)' }}>{statusBadge(b.bookingStatus)}</td>
                          <td style={{ padding: 'var(--space-4)' }}>
                            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                              <button className="btn btn-secondary btn-sm" onClick={() => openViewBooking(b)}>View</button>
                              {b.bookingStatus === 'confirmed' && b.paymentStatus !== 'paid' && (
                                <button className="btn btn-primary btn-sm" onClick={() => openPaymentForm(b)}>+ Pay</button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-4) var(--space-6)', borderTop: '1px solid var(--surface-glass-border)' }}>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Showing {getGroupedBookings(bookings).length} items of {bookings.length} total bookings</div>
                  <div className="select-wrapper" style={{ width: '130px' }}>
                    <CustomSelect
                      options={[
                        { value: '10', label: '10 per page' },
                        { value: '25', label: '25 per page' },
                        { value: '50', label: '50 per page' }
                      ]}
                      value="10"
                      onChange={() => {}}
                    />
                  </div>
                </div>
              </div>

              {/* MOBILE CARDS VIEW */}
              <div className="cards-grid mobile-only">
              {getGroupedBookings(bookings).map(b => (
                <div key={b._id} className="card" style={{ padding: 'var(--space-4)', opacity: b.bookingStatus === 'cancelled' ? 0.55 : 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  {/* Header: Date + Status Badges */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
                      <Calendar size={18} style={{ color: 'var(--accent-primary)', marginTop: '2px' }} />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {b.isGroup ? (
                          b.bookingDate.map((date: string) => (
                            <span key={date} style={{ fontWeight: 700, fontSize: 'var(--text-md)', lineHeight: '1.2' }}>
                              {formatSingleDate(date)}
                            </span>
                          ))
                        ) : (
                          <span style={{ fontWeight: 700, fontSize: 'var(--text-md)', lineHeight: '1.2' }}>
                            {formatSingleDate(b.bookingDate)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-1)', marginTop: '2px' }}>
                      {statusBadge(b.paymentStatus)}
                      {statusBadge(b.bookingStatus)}
                    </div>
                  </div>

                  {/* Info Details */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '4px', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Clock size={12} style={{ color: 'var(--accent-primary)' }} />
                      <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{fmtTime(b.startTime)} - {fmtTime(b.endTime)}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <UserIcon size={12} style={{ color: 'var(--accent-primary)' }} />
                      <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                        {b.customerName || 'Anonymous'}
                      </span>
                      {b.contactNumber && (
                        <>
                          <span style={{ color: 'var(--text-muted)' }}>•</span>
                          <span>{b.contactNumber}</span>
                        </>
                      )}
                    </div>
                    {b.paymentStatus !== 'pending' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '10px' }}>💰</span>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                          Paid: {fmt(b.totalPaid)}
                          {b.paymentStatus === 'partial' && ` • Bal: ${fmt((b.expectedAmount - (b.discountAmount || 0)) - b.totalPaid)}`}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: '2px' }}>
                    <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => openViewBooking(b)}>View</button>
                    {b.bookingStatus === 'confirmed' && b.paymentStatus !== 'paid' && (
                      <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => openPaymentForm(b)}>+ Pay</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            </>
          )}
        </>
      )}

      {/* ===================== PAYMENTS TAB ===================== */}
      {activeTab === 'payments' && (
        <>
          {/* Date Filter */}
          <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
            <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap', padding: 'var(--space-4) var(--space-6)' }}>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', fontWeight: 500 }}>Period:</span>
              {(['today', 'week', 'month', 'all', 'custom'] as const).map(f => (
                <button
                  key={f}
                  className={`btn btn-sm ${dashFilter === f ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setDashFilter(f)}
                >
                  {f === 'today' ? 'Today' : f === 'week' ? 'This Week' : f === 'month' ? 'This Month' : f === 'all' ? 'All Time' : 'Custom'}
                </button>
              ))}
              {dashFilter === 'custom' && (
                <>
                  <div style={{ width: 160 }}>
                    <CustomDatePicker value={dashStartDate} onChange={setDashStartDate} />
                  </div>
                  <span style={{ color: 'var(--text-tertiary)' }}>to</span>
                  <div style={{ width: 160 }}>
                    <CustomDatePicker value={dashEndDate} onChange={setDashEndDate} />
                  </div>
                </>
              )}
            </div>
          </div>

          {dashLoading ? (
            <div className="loading-screen" style={{ minHeight: '40vh' }}><div className="spinner spinner-lg" /><div className="loading-text">Loading payment data...</div></div>
          ) : dashSummary ? (
            <>
              {/* Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
                {[
                  { icon: '💰', label: 'Total Expected', value: fmt(dashSummary.totalExpected), color: 'var(--accent-primary)' },
                  { icon: '✅', label: 'Total Received', value: fmt(dashSummary.totalReceived), color: 'var(--status-success)' },
                  { icon: '⏳', label: 'Pending Amount', value: fmt(dashSummary.pendingAmount), color: 'var(--status-warning)' },
                  { icon: '🏦', label: 'Bank Transfer', value: fmt(dashSummary.bankTransferTotal), color: 'var(--accent-secondary)' },
                  { icon: '💵', label: 'Cash Total', value: fmt(dashSummary.cashTotal), color: 'var(--accent-tertiary)' },
                  { icon: '📊', label: 'Partial Payments', value: dashSummary.partialPaymentsCount.toString(), color: 'var(--status-info)' },
                ].map((card, i) => (
                  <div key={i} className="card stat-card" style={{ animation: `slideUp 0.3s ease ${i * 0.05}s both` }}>
                    <div className="stat-icon" style={{ background: `color-mix(in srgb, ${card.color} 15%, transparent)`, color: card.color }}>
                      {card.icon}
                    </div>
                    <div className="stat-value" style={{ color: card.color, fontSize: 'var(--text-2xl)' }}>{card.value}</div>
                    <div className="stat-label">{card.label}</div>
                  </div>
                ))}
              </div>

              {/* Cash Holdings Breakdown */}
              <div className="card" style={{ marginBottom: 'var(--space-8)' }}>
                <div className="card-header">
                  <h3 style={{ fontSize: 'var(--text-md)' }}>💵 Cash Currently Held By</h3>
                </div>
                <div className="card-body" style={{ padding: 0 }}>
                  {Object.entries(dashCashHoldings).map(([key, holding]) => (
                    <div key={key}>
                      <div
                        onClick={() => setExpandedHolder(expandedHolder === key ? null : key)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: 'var(--space-4) var(--space-6)',
                          cursor: 'pointer', borderBottom: '1px solid var(--surface-glass-border)',
                          transition: 'background var(--transition-fast)',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                          <span style={{ fontSize: 'var(--text-lg)' }}>{key === 'turf_owner' ? '👤' : key === 'arjo' ? '🏢' : '👷'}</span>
                          <div>
                            <div style={{ fontWeight: 600 }}>{CASH_HOLDER_LABELS[key]}</div>
                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                              {holding.transactions.length} transaction{holding.transactions.length !== 1 ? 's' : ''}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                          <span style={{ fontWeight: 700, fontSize: 'var(--text-lg)', color: holding.total > 0 ? 'var(--status-success)' : 'var(--text-muted)' }}>
                            {fmt(holding.total)}
                          </span>
                          <span style={{ color: 'var(--text-tertiary)', transform: expandedHolder === key ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform var(--transition-fast)' }}>▾</span>
                        </div>
                      </div>
                      {expandedHolder === key && holding.transactions.length > 0 && (
                        <div style={{ background: 'var(--bg-tertiary)', padding: 'var(--space-2) var(--space-6)', borderBottom: '1px solid var(--surface-glass-border)' }}>
                          <table className="data-table" style={{ fontSize: 'var(--text-xs)' }}>
                            <thead>
                              <tr>
                                <th style={{ background: 'transparent', fontSize: 'var(--text-xs)' }}>Date</th>
                                <th style={{ background: 'transparent', fontSize: 'var(--text-xs)' }}>Slot</th>
                                <th style={{ background: 'transparent', fontSize: 'var(--text-xs)' }}>Customer</th>
                                <th style={{ background: 'transparent', fontSize: 'var(--text-xs)' }}>Amount</th>
                                <th style={{ background: 'transparent', fontSize: 'var(--text-xs)' }}>Paid On</th>
                              </tr>
                            </thead>
                            <tbody>
                              {holding.transactions.map((t, i) => (
                                <tr key={i}>
                                  <td>{fmtDate(t.bookingDate)}</td>
                                  <td>{t.timeSlot}</td>
                                  <td>{t.customerName}</td>
                                  <td style={{ fontWeight: 600, color: 'var(--status-success)' }}>{fmt(t.amount)}</td>
                                  <td>{fmtDate(t.paymentDate)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Booking-Level Payment Breakdown */}
              <div className="card">
                <div className="card-header">
                  <h3 style={{ fontSize: 'var(--text-md)' }}>📋 Booking Payment Breakdown</h3>
                  <span className="badge badge-neutral">{dashBreakdown.length} bookings</span>
                </div>
                {dashBreakdown.length === 0 ? (
                  <div className="card-body" style={{ textAlign: 'center', padding: 'var(--space-10)', color: 'var(--text-muted)' }}>
                    No bookings in this period
                  </div>
                ) : (
                  <div className="cards-grid" style={{ padding: '0 var(--space-6) var(--space-6) var(--space-6)' }}>
                    {dashBreakdown.map(b => (
                      <div key={b._id} className="card" style={{ padding: 'var(--space-6)', background: b.paymentStatus === 'pending' ? 'var(--status-warning-soft)' : b.paymentStatus === 'partial' ? 'var(--status-info-soft)' : 'var(--surface-glass)' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 48, height: 48, borderRadius: '12px', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', marginBottom: 'var(--space-5)' }}>
                          <FileText size={24} />
                        </div>

                        <div style={{ marginBottom: 'var(--space-6)' }}>
                          <div style={{ fontSize: '32px', fontWeight: 700, lineHeight: 1.2 }}>{new Date(b.bookingDate).getDate()}</div>
                          <div style={{ fontSize: 'var(--text-md)', color: 'var(--text-secondary)' }}>{new Date(b.bookingDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</div>
                        </div>

                        <div style={{ display: 'grid', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
                          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                            <Clock size={16} style={{ color: 'var(--text-secondary)', marginTop: '2px' }} />
                            <div>
                              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '2px' }}>Time Slot</div>
                              <div style={{ fontWeight: 500 }}>{fmtTime(b.startTime)} - {fmtTime(b.endTime)}</div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                            <UserIcon size={16} style={{ color: 'var(--text-secondary)', marginTop: '2px' }} />
                            <div>
                              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '2px' }}>Customer</div>
                              <div style={{ fontWeight: 500 }}>{b.customerName}</div>
                            </div>
                          </div>
                        </div>

                        <hr style={{ border: 'none', borderTop: '1px solid var(--surface-glass-border)', margin: 'var(--space-5) 0' }} />

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
                          <div>
                            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '2px' }}>Expected</div>
                            <div style={{ fontWeight: 600 }}>{fmt(b.expectedAmount)}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '2px' }}>Paid</div>
                            <div style={{ fontWeight: 600, color: 'var(--status-success)' }}>{fmt(b.totalPaid)}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '2px' }}>Balance</div>
                            <div style={{ color: b.remainingBalance > 0 ? 'var(--status-danger)' : 'var(--text-muted)' }}>{b.remainingBalance > 0 ? fmt(b.remainingBalance) : '—'}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '2px' }}>Mode</div>
                            <div style={{ fontSize: 'var(--text-sm)' }}>{b.paymentModes.length > 0 ? b.paymentModes.map(m => PAYMENT_MODE_LABELS[m] || m).join(', ') : <span style={{ color: 'var(--text-muted)' }}>—</span>}</div>
                          </div>
                        </div>
                        
                        <hr style={{ border: 'none', borderTop: '1px solid var(--surface-glass-border)', margin: 'var(--space-5) 0' }} />

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', fontWeight: 500 }}>Status</div>
                          <div>{statusBadge(b.paymentStatus)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="card"><div className="empty-state"><div className="empty-state-icon">💰</div><div className="empty-state-title">No payment data</div><div className="empty-state-description">Payments will appear here once bookings and payments are recorded.</div></div></div>
          )}
        </>
      )}

      {/* ===================== MODALS ===================== */}

      {/* New Booking Modal */}
      {showBookingForm && (
        <div className="modal-backdrop" onClick={() => resetBookingForm()}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">📅 New Booking</h2>
              <button className="modal-close" onClick={() => resetBookingForm()}>×</button>
            </div>
            <div className="modal-body">
              {bfError && (
                <div style={{ background: 'var(--status-danger-soft)', border: '1px solid var(--status-danger-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3) var(--space-4)', marginBottom: 'var(--space-4)', color: 'var(--status-danger)', fontSize: 'var(--text-sm)' }}>
                  ⚠️ {bfError}
                </div>
              )}
              {!showSummary ? (
                <div className="booking-modal-grid form-grid-responsive" style={{ gap: 'var(--space-6)' }}>
                  {/* Left Side: Scheduling UI */}
                <div>
                  {/* Calendar Date Selector */}
                  <div style={{ marginBottom: 'var(--space-5)' }}>
                    <div style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
                      Select Date
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                      <CustomDatePicker
                        value={bfDate}
                        onChange={(val) => {
                          if (val) {
                            setBfDate(val);
                            try {
                              setViewStartDate(new Date(val));
                            } catch (err) {}
                          }
                        }}
                      />
                    </div>
                  </div>

                  {/* Quick Time Presets */}
                  <div style={{ marginBottom: 'var(--space-5)' }}>
                    <div style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
                      Quick Select
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setBfStartTime('00:00');
                          setBfEndTime('23:59');
                        }}
                        style={{
                          flex: 1, padding: 'var(--space-2)', borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--surface-glass-border)', background: 'var(--bg-tertiary)',
                          color: 'var(--text-primary)', fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                      >
                        📅 Full Day
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setBfStartTime('06:00');
                          setBfEndTime('14:00');
                        }}
                        style={{
                          flex: 1, padding: 'var(--space-2)', borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--surface-glass-border)', background: 'var(--bg-tertiary)',
                          color: 'var(--text-primary)', fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                      >
                        ⏱️ Half Day (Morning)
                      </button>
                    </div>
                  </div>
                  
                  {/* Available Slots Title */}
                  <div style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
                    Available Slots
                  </div>

                  {/* Slots Grid */}
                  {bookingType === 'standard' ? (
                    <>
                      <div id="mobile_slot_four_column_grid" className="mobile-slot-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 'var(--space-3)' }}>
                        {TIME_SLOTS.map((slot) => {
                          const isBooked = isSlotBooked(bfDate, slot.start, slot.end);
                          const isSelected = bfStartTime && bfEndTime && slot.start >= bfStartTime && slot.end <= bfEndTime;
                          return (
                            <button
                              key={slot.start}
                              type="button"
                              className={`slot-pill ${isBooked ? 'booked' : isSelected ? 'selected' : 'available'}`}
                              onClick={() => handleSlotClick(slot)}
                              disabled={isBooked}
                            >
                              {isBooked ? 'Booked' : slot.label}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                        {/* Day 1 - Full Day Locked */}
                        <div className="full-day-bar">
                          <span className="full-day-icon">🔒</span>
                          Full Day — 24 Hours (00:00 – 23:59)
                        </div>
                        
                        {/* Day 2 - Extra Hours Expander */}
                        <div className="extra-hours-expander">
                          <button 
                            type="button" 
                            className="extra-hours-toggle"
                            onClick={() => setBulkExtraEnabled(!bulkExtraEnabled)}
                          >
                            {bulkExtraEnabled ? '▼ Remove Extra Hours (Day 2)' : '▶ + Add Extra Hours (Day 2)'}
                          </button>
                          
                          {bulkExtraEnabled && (
                            <div className="extra-hours-content">
                              <div className="form-group">
                                <label className="form-label required">Day 2 Date</label>
                                <input 
                                  type="date" 
                                  className="form-input" 
                                  value={bulkExtraDate} 
                                  onChange={(e) => setBulkExtraDate(e.target.value)}
                                  min={bfDate ? new Date(new Date(bfDate).getTime() + 86400000).toISOString().split('T')[0] : today()}
                                />
                              </div>
                              <div className="form-group">
                                <label className="form-label required">Time Block</label>
                                <div className="pill-toggle-group">
                                  <button 
                                    type="button"
                                    className={`pill-toggle ${bulkExtraMode === 'am' ? 'active' : ''}`}
                                    onClick={() => setBulkExtraMode('am')}
                                  >
                                    🌅 Morning (06:00 – 14:00)
                                  </button>
                                  <button 
                                    type="button"
                                    className={`pill-toggle ${bulkExtraMode === 'pm' ? 'active' : ''}`}
                                    onClick={() => setBulkExtraMode('pm')}
                                  >
                                    🌇 Evening (14:00 – 22:00)
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* MODULE 5: Live Pricing Panel */}
                  <div className="pricing-panel">
                    <div className="pricing-panel-header">
                      <div className="pricing-panel-title">Pricing Breakdown</div>
                    </div>
                    
                    {(!bfPriceType || !bfStartTime || !bfEndTime || !bfAmount) ? (
                      <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: 'var(--text-sm)', textAlign: 'center', padding: 'var(--space-2) 0' }}>
                        Select a rate type and time slots to see pricing.
                      </div>
                    ) : (
                      <div className="pricing-table">
                        {/* Day 1 Items */}
                        {(bookingType === 'bulk' && bulkExtraEnabled) && (
                          <div className="pricing-day-label">Day 1 ({fmtDate(bfDate)})</div>
                        )}
                        {detectedRule?.appliedRules?.map((rule, idx) => (
                          <div key={idx} className="pricing-row">
                            <div className="pricing-row-slot">
                              {fmtTime(rule.start)} – {fmtTime(rule.end)}
                            </div>
                            <div className="pricing-row-rate">
                              {rule.rate ? `${fmt(rule.rate)}/hr` : '—'}
                            </div>
                            <div className="pricing-row-subtotal">
                              {fmt(getPricingLineAmount(rule))}
                            </div>
                          </div>
                        ))}

                        {/* Day 2 Items (if Bulk Extra) */}
                        {(bookingType === 'bulk' && bulkExtraEnabled && bulkExtraQuote) && (
                          <>
                            <div className="pricing-day-label" style={{ marginTop: 'var(--space-4)' }}>
                              Day 2 ({bulkExtraDate ? fmtDate(bulkExtraDate) : 'Select Date'})
                            </div>
                            {bulkExtraQuote.appliedRules?.map((rule, idx) => (
                              <div key={`d2-${idx}`} className="pricing-row">
                                <div className="pricing-row-slot">
                                  {fmtTime(rule.start)} – {fmtTime(rule.end)}
                                </div>
                                <div className="pricing-row-rate">
                                  {rule.rate ? `${fmt(rule.rate)}/hr` : '—'}
                                </div>
                                <div className="pricing-row-subtotal">
                                  {fmt(getPricingLineAmount(rule))}
                                </div>
                              </div>
                            ))}
                          </>
                        )}
                        
                        {/* Grand Total Row */}
                        <div className="pricing-total-row">
                          <div className="pricing-total-hours">
                            {bookingType === 'bulk' 
                              ? `Total: ${bulkExtraEnabled ? '32 hours' : '24 hours'}`
                              : `Total: ${calculateDuration(bfStartTime, bfEndTime)}`}
                          </div>
                          <div className="pricing-grand-total">
                            {fmt(Number(bfAmount) + (bulkExtraEnabled ? Number(bulkExtraAmount) : 0))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* MODULE 6: Customer Details */}
                  <div className="booking-section">
                    <div className="booking-section-label">5. Customer Details</div>
                    <div className="form-grid-2">
                      <div className="form-group">
                        <label className="form-label">Customer Name</label>
                        <input className="form-input" placeholder="Leave blank if unknown" value={bfCustomer} onChange={e => setBfCustomer(e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Contact Number</label>
                        <input className="form-input" type="tel" placeholder="Phone number" value={bfContact} onChange={e => setBfContact(e.target.value)} />
                      </div>
                      <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                        <label className="form-label">Notes</label>
                        <input className="form-input" placeholder="Any additional information..." value={bfNotes} onChange={e => setBfNotes(e.target.value)} />
                      </div>
                    </div>
                  </div>

                </div>
              ) : (
                /* -------------------------------------------------------------
                   STEP 2: SUMMARY / REVIEW
                   ------------------------------------------------------------- */
                <div className="summary-card">
                  <div style={{ textAlign: 'center', marginBottom: 'var(--space-2)' }}>
                    <div style={{ fontSize: '3rem', marginBottom: 'var(--space-2)' }}>📝</div>
                    <h3 style={{ fontSize: 'var(--text-xl)', fontWeight: 800 }}>Review Booking</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>Please verify the details below before saving.</p>
                  </div>

                  <div className="summary-customer-info">
                    <div className="summary-customer-field">
                      <span className="label">Customer</span>
                      <span className="value">{bfCustomer || 'Walk-in / Anonymous'}</span>
                    </div>
                    <div className="summary-customer-field">
                      <span className="label">Contact</span>
                      <span className="value">{bfContact || '—'}</span>
                    </div>
                    <div className="summary-customer-field">
                      <span className="label">Rate Type</span>
                      <span className="value">{bfPriceType === 'regular' ? '⭐ Regular Rate' : '🏷️ Normal Rate'}</span>
                    </div>
                    <div className="summary-customer-field">
                      <span className="label">Booking Type</span>
                      <span className="value">{bookingType === 'bulk' ? '📦 Bulk / Full-Day' : '🎯 Standard'}</span>
                    </div>
                  </div>

                  <hr style={{ border: 'none', borderTop: '1px dashed var(--surface-glass-border)' }} />

                  {/* Day 1 Summary */}
                  <div className="summary-day-block">
                    <div className="summary-day-title">
                      📅 {fmtDate(bfDate)}
                    </div>
                    <div className="summary-detail-row">
                      <span className="label">Time</span>
                      <span className="value">{bookingType === 'bulk' ? 'Full Day (24 hrs)' : `${fmtTime(bfStartTime)} – ${fmtTime(bfEndTime)}`}</span>
                    </div>
                    <div className="summary-detail-row">
                      <span className="label">Subtotal</span>
                      <span className="value">{fmt(Number(bfAmount))}</span>
                    </div>
                  </div>

                  {/* Day 2 Summary (if bulk extra) */}
                  {(bookingType === 'bulk' && bulkExtraEnabled && bulkExtraDate) && (
                    <div className="summary-day-block">
                      <div className="summary-day-title">
                        📅 {fmtDate(bulkExtraDate)} <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 'normal' }}>(Extra Hours)</span>
                      </div>
                      <div className="summary-detail-row">
                        <span className="label">Time</span>
                        <span className="value">{bulkExtraMode === 'am' ? '06:00 AM – 02:00 PM (8 hrs)' : '02:00 PM – 10:00 PM (8 hrs)'}</span>
                      </div>
                      <div className="summary-detail-row">
                        <span className="label">Subtotal</span>
                        <span className="value">{fmt(Number(bulkExtraAmount))}</span>
                      </div>
                    </div>
                  )}

                  <div className="summary-grand-total">
                    <span className="label">Grand Total</span>
                    <span className="value">{fmt(Number(bfAmount) + (bulkExtraEnabled ? Number(bulkExtraAmount) : 0))}</span>
                  </div>
                  
                  {bfNotes && (
                    <div style={{ padding: 'var(--space-3)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                      <strong>Notes:</strong> {bfNotes}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ borderTop: '1px solid var(--surface-glass-border)', background: 'var(--bg-secondary)', borderRadius: '0 0 var(--radius-xl) var(--radius-xl)' }}>
              {!showSummary ? (
                <>
                  <button className="btn btn-secondary btn-md" onClick={() => resetBookingForm()}>Cancel</button>
                  <button 
                    className="btn btn-primary btn-md" 
                    onClick={() => {
                      if (!bfPriceType) return setBfError('Please select a Rate Type');
                      if (bookingType === 'standard' && (!bfStartTime || !bfEndTime)) return setBfError('Please select time slots');
                      if (bookingType === 'bulk' && bulkExtraEnabled && !bulkExtraDate) return setBfError('Please select Day 2 date for extra hours');
                      setBfError('');
                      setShowSummary(true);
                    }}
                    disabled={(bookingType === 'standard' && hasConflict) || !bfPriceType || (bookingType === 'standard' && (!bfStartTime || !bfEndTime))}
                  >
                    Review & Continue →
                  </button>
                </>
              ) : (
                <>
                  <button className="btn btn-secondary btn-md" onClick={() => setShowSummary(false)}>← Back to Edit</button>
                  <button
                    className={`btn btn-primary btn-md ${bfSaving ? 'btn-loading' : ''}`}
                    onClick={handleCreateBooking}
                    disabled={bfSaving}
                  >
                    ✓ Confirm & Save Booking
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* View Booking Modal */}
      {viewBooking && (
        <div className="modal-backdrop" onClick={() => { setViewBooking(null); setEditMode(false); setShowCancel(false); }}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <h2 className="modal-title">Booking Details</h2>
                {statusBadge(viewBooking.bookingStatus)}
                {statusBadge(viewBooking.paymentStatus)}
              </div>
              <button className="modal-close" onClick={() => { setViewBooking(null); setEditMode(false); setShowCancel(false); }}>×</button>
            </div>
            <div className="modal-body">
              {viewLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-8)' }}>
                  <div className="spinner spinner-md" />
                </div>
              ) : editMode ? (
                /* Edit Form */
                <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
                  <div className="form-grid-2" style={{ gap: 'var(--space-4)' }}>
                    <div className="form-group">
                      <label className="form-label">Customer Name</label>
                      <input className="form-input" value={efCustomer} onChange={e => setEfCustomer(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Contact Number</label>
                      <input className="form-input" value={efContact} onChange={e => setEfContact(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Expected Amount (₹)</label>
                      <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3) var(--space-4)', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {fmt(Number(efAmount) || 0)}
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 400, marginTop: '2px' }}>Price calculated from Settings</div>
                      </div>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Notes</label>
                    <textarea className="form-input form-textarea" value={efNotes} onChange={e => setEfNotes(e.target.value)} rows={3} />
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
                    <button className="btn btn-secondary btn-md" onClick={() => setEditMode(false)}>Cancel</button>
                    <button className={`btn btn-primary btn-md ${efSaving ? 'btn-loading' : ''}`} onClick={handleEditBooking} disabled={efSaving}>
                      Save Changes
                    </button>
                  </div>
                </div>
              ) : (
                /* View Details */
                <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
                  {/* Booking Info Grid */}
                  <div className="form-grid-2" style={{ gap: 'var(--space-4)' }}>
                    {[
                      { label: 'Date', value: Array.isArray(viewBooking.bookingDate) ? formatBookingDates(viewBooking.bookingDate) : fmtDate(viewBooking.bookingDate) },
                      { label: 'Time Slot', value: `${fmtTime(viewBooking.startTime)} – ${fmtTime(viewBooking.endTime)}` },
                      { label: 'Customer', value: viewBooking.customerName || 'Anonymous' },
                      { label: 'Contact', value: viewBooking.contactNumber || '—' },
                      { label: 'Rate Type', value: viewBooking.priceType === 'regular' ? 'Regular Rate' : 'Normal Rate' },
                      { label: 'Original Amount', value: fmt(viewBooking.expectedAmount) },
                      { label: 'Discount', value: viewBooking.discountAmount > 0 ? `${fmt(viewBooking.discountAmount)} (${viewBooking.discountPercentage}%)` : '—' },
                      { label: 'Final Payable', value: fmt(viewBooking.expectedAmount - (viewBooking.discountAmount || 0)) },
                      { label: 'Total Paid', value: fmt(viewBooking.totalPaid) },
                    ].map((item, i) => (
                      <div key={i}>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-1)' }}>{item.label}</div>
                        <div style={{ fontWeight: 600 }}>{item.value}</div>
                      </div>
                    ))}
                  </div>

                  {viewBooking.pricingSnapshot?.appliedRules && viewBooking.pricingSnapshot.appliedRules.length > 0 && (
                    <PricingBreakdown
                      pricing={viewBooking.pricingSnapshot}
                      totalAmount={viewBooking.expectedAmount}
                      title="Invoice Price Breakdown"
                    />
                  )}

                  {viewBooking.totalPaid > viewBooking.expectedAmount - (viewBooking.discountAmount || 0) && (
                    <div style={{ background: 'var(--status-info-soft)', border: '1px solid var(--status-info-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--status-info)' }}>
                      💡 Overpayment of {fmt(viewBooking.totalPaid - (viewBooking.expectedAmount - (viewBooking.discountAmount || 0)))} recorded
                    </div>
                  )}

                  {viewBooking.expectedAmount - (viewBooking.discountAmount || 0) > viewBooking.totalPaid && viewBooking.totalPaid > 0 && (
                    <div style={{ background: 'var(--status-warning-soft)', border: '1px solid var(--status-warning-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--status-warning)' }}>
                      ⏳ Remaining balance: {fmt((viewBooking.expectedAmount - (viewBooking.discountAmount || 0)) - viewBooking.totalPaid)}
                    </div>
                  )}

                  {viewBooking.notes && (
                    <div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-1)' }}>Notes</div>
                      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{viewBooking.notes}</div>
                    </div>
                  )}

                  {viewBooking.bookingStatus === 'cancelled' && (
                    <div style={{ background: 'var(--status-danger-soft)', border: '1px solid var(--status-danger-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--text-sm)' }}>
                      <strong style={{ color: 'var(--status-danger)' }}>Cancelled</strong>
                      {viewBooking.cancelReason && <span style={{ color: 'var(--text-secondary)' }}> — {viewBooking.cancelReason}</span>}
                    </div>
                  )}

                  {/* Payment History */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
                      <h4 style={{ fontSize: 'var(--text-md)' }}>💳 Payment History</h4>
                      <span className="badge badge-neutral">{viewPayments.length} payment{viewPayments.length !== 1 ? 's' : ''}</span>
                    </div>
                    {viewPayments.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                        No payments recorded yet
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
                        {viewPayments.map(p => (
                          <div key={p._id} style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: p.splits && p.splits.length > 0 ? '1px dashed var(--surface-glass-border)' : 'none', paddingBottom: p.splits && p.splits.length > 0 ? 'var(--space-2)' : '0' }}>
                              <div>
                                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>Total Paid</div>
                                <div style={{ fontWeight: 700, color: 'var(--status-success)', fontSize: 'var(--text-md)' }}>{fmt(p.amountPaid)}</div>
                              </div>
                              <div style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: 10, color: 'var(--text-tertiary)', textAlign: 'right' }}>
                                <div>{fmtDate(p.paymentDate)}</div>
                                <div>by {p.createdBy?.name || '—'}</div>
                              </div>
                            </div>
                            {p.splits && p.splits.length > 0 ? (
                              <div style={{ display: 'grid', gap: 'var(--space-2)', marginTop: 'var(--space-1)' }}>
                                {p.splits.map((s: any, idx: number) => (
                                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', borderBottom: idx < p.splits!.length - 1 ? '1px solid var(--surface-glass-border)' : 'none', paddingBottom: idx < p.splits!.length - 1 ? '4px' : '0' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>
                                      {idx + 1}. {PAYMENT_MODE_LABELS[s.paymentMode] || s.paymentMode}
                                      {s.cashReceivedBy && ` (Rec: ${CASH_HOLDER_LABELS[s.cashReceivedBy] || s.cashReceivedBy})`}
                                    </span>
                                    <span style={{ fontWeight: 600, textAlign: 'right' }}>
                                      {fmt(s.amount)}
                                      {s.referenceNumber && ` (Ref: ${s.referenceNumber})`}
                                      {s.referenceNote && ` [Note: ${s.referenceNote}]`}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 'var(--space-1)' }}>
                                <span>
                                  {PAYMENT_MODE_LABELS[p.paymentMode] || p.paymentMode}
                                  {p.cashReceivedBy && ` (Rec: ${CASH_HOLDER_LABELS[p.cashReceivedBy] || p.cashReceivedBy})`}
                                </span>
                                <span>
                                  {p.referenceNumber && `Ref: ${p.referenceNumber}`}
                                  {p.referenceNote && ` — ${p.referenceNote}`}
                                </span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Cancel Form */}
                  {showCancel && viewBooking.bookingStatus === 'confirmed' && (
                    <div style={{ background: 'var(--status-danger-soft)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)', border: '1px solid var(--status-danger-border)' }}>
                      <div style={{ fontWeight: 600, color: 'var(--status-danger)', marginBottom: 'var(--space-2)' }}>Cancel this booking?</div>
                      <div className="form-group" style={{ marginBottom: 'var(--space-3)' }}>
                        <label className="form-label">Reason (optional)</label>
                        <input className="form-input" placeholder="Why is this booking being cancelled?" value={cancelReason} onChange={e => setCancelReason(e.target.value)} />
                      </div>
                      <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setShowCancel(false)}>Back</button>
                        <button className={`btn btn-danger btn-sm ${cancelling ? 'btn-loading' : ''}`} onClick={handleCancelBooking} disabled={cancelling}>
                          Confirm Cancellation
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            {!editMode && !viewLoading && viewBooking.bookingStatus === 'confirmed' && (
              <div className="modal-footer">
                {!showCancel && (
                  <>
                    <button className="btn btn-danger btn-sm" onClick={() => setShowCancel(true)}>Cancel Booking</button>
                    <button className="btn btn-secondary btn-md" onClick={startEdit}>✏️ Edit</button>
                    {viewBooking.paymentStatus !== 'paid' && (
                      <button className="btn btn-primary btn-md" onClick={() => { setViewBooking(null); openPaymentForm(viewBooking); }}>+ Add Payment</button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Payment Modal */}
      {showPaymentForm && paymentBooking && (
        <div className="modal-backdrop" onClick={() => setShowPaymentForm(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">💰 Add Payment</h2>
              <button className="modal-close" onClick={() => setShowPaymentForm(false)}>×</button>
            </div>
            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              {/* Booking Context */}
              <div className="grid-4" style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)', marginBottom: 'var(--space-5)', gap: 'var(--space-3)' }}>
                {[
                  { label: 'Date', value: Array.isArray(paymentBooking.bookingDate) ? formatBookingDates(paymentBooking.bookingDate) : fmtDate(paymentBooking.bookingDate) },
                  { label: 'Time', value: `${fmtTime(paymentBooking.startTime)} – ${fmtTime(paymentBooking.endTime)}` },
                  { label: 'Customer', value: paymentBooking.customerName || 'Anonymous' },
                  { label: 'Expected', value: fmt(paymentBooking.expectedAmount) },
                ].map((item, i) => (
                  <div key={i}>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>{item.label}</div>
                    <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{item.value}</div>
                  </div>
                ))}
              </div>

              {paymentBooking.pricingSnapshot?.appliedRules && paymentBooking.pricingSnapshot.appliedRules.length > 0 && (
                <div style={{ marginBottom: 'var(--space-5)' }}>
                  <PricingBreakdown
                    pricing={paymentBooking.pricingSnapshot}
                    totalAmount={paymentBooking.expectedAmount}
                    title="Payment Price Breakdown"
                  />
                </div>
              )}

              {pfError && (
                <div style={{ background: 'var(--status-danger-soft)', border: '1px solid var(--status-danger-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3) var(--space-4)', marginBottom: 'var(--space-4)', color: 'var(--status-danger)', fontSize: 'var(--text-sm)' }}>
                  ⚠️ {pfError}
                </div>
              )}

              {/* Discounts & Final Payable */}
              <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--surface-glass-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
                <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: 'var(--space-3)', color: 'var(--text-secondary)' }}>Discount & Final Payable</div>
                {pfPreviousSplits.length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', fontSize: 'var(--text-sm)', paddingBottom: 'var(--space-3)' }}>
                    <div>
                      <span style={{ color: 'var(--text-tertiary)' }}>Original Amount:</span>
                      <div style={{ fontWeight: 600 }}>{fmt(paymentBooking.expectedAmount)}</div>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-tertiary)' }}>Discount Applied:</span>
                      <div style={{ fontWeight: 600 }}>
                        {pfDiscountAmount > 0 ? `${fmt(pfDiscountAmount)} (${pfDiscountPercentage}%)` : 'None'}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="form-grid-2" style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                    <div className="form-group">
                      <label className="form-label">Discount Amount (₹)</label>
                      <input
                        className="form-input"
                        type="number"
                        placeholder="e.g. 200"
                        value={pfDiscountAmount || ''}
                        onChange={(e) => {
                          const amt = Math.min(paymentBooking.expectedAmount, Math.max(0, Number(e.target.value) || 0));
                          setPfDiscountAmount(amt);
                          const pct = paymentBooking.expectedAmount > 0 ? Math.round((amt / paymentBooking.expectedAmount) * 100) : 0;
                          setPfDiscountPercentage(pct);
                          
                          const currentFinalPayable = paymentBooking.expectedAmount - amt;
                          const totalPreviousPaid = pfPreviousSplits.reduce((sum: number, s: any) => sum + Number(s.amount || 0), 0);
                          const remaining = Math.max(0, currentFinalPayable - totalPreviousPaid);

                          if (pfSplits.length <= 1) {
                            if (remaining > 0) {
                              setPfSplits([{ ...(pfSplits[0] || { paymentMode: 'bank_transfer', referenceNumber: '', cashReceivedBy: '', referenceNote: '' }), amount: remaining }]);
                            } else {
                              setPfSplits([]);
                            }
                          }
                        }}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Discount Percentage (%)</label>
                      <input
                        className="form-input"
                        type="number"
                        placeholder="e.g. 10"
                        value={pfDiscountPercentage || ''}
                        onChange={(e) => {
                          const pct = Math.min(100, Math.max(0, Number(e.target.value) || 0));
                          setPfDiscountPercentage(pct);
                          const amt = Math.round(paymentBooking.expectedAmount * (pct / 100));
                          setPfDiscountAmount(amt);
                          
                          const currentFinalPayable = paymentBooking.expectedAmount - amt;
                          const totalPreviousPaid = pfPreviousSplits.reduce((sum: number, s: any) => sum + Number(s.amount || 0), 0);
                          const remaining = Math.max(0, currentFinalPayable - totalPreviousPaid);

                          if (pfSplits.length <= 1) {
                            if (remaining > 0) {
                              setPfSplits([{ ...(pfSplits[0] || { paymentMode: 'bank_transfer', referenceNumber: '', cashReceivedBy: '', referenceNote: '' }), amount: remaining }]);
                            } else {
                              setPfSplits([]);
                            }
                          }
                        }}
                      />
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed var(--surface-glass-border)', paddingTop: 'var(--space-3)' }}>
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Final Payable Amount:</span>
                  <span style={{ fontWeight: 700, fontSize: 'var(--text-lg)', color: 'var(--accent-primary)' }}>
                    {fmt(paymentBooking.expectedAmount - pfDiscountAmount)}
                  </span>
                </div>
              </div>

              {/* Previous Payments */}
              {pfPreviousSplits.length > 0 && (
                <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--surface-glass-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
                  <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: 'var(--space-3)', color: 'var(--text-secondary)' }}>Previous Payments</div>
                  <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
                    {pfPreviousSplits.map((split, index) => (
                      <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-2) var(--space-3)', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-sm)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                          <span style={{ color: 'var(--status-success)', fontWeight: 'bold' }}>✓</span>
                          <span style={{ fontWeight: 500 }}>
                            {PAYMENT_MODE_LABELS[split.paymentMode] || split.paymentMode}
                            {split.cashReceivedBy && ` (Rec: ${CASH_HOLDER_LABELS[split.cashReceivedBy] || split.cashReceivedBy})`}
                          </span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontWeight: 700 }}>{fmt(split.amount)}</span>
                          {split.referenceNumber && <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>Ref: {split.referenceNumber}</div>}
                          {split.referenceNote && <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>{split.referenceNote}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                  {(() => {
                    const finalPayable = paymentBooking.expectedAmount - pfDiscountAmount;
                    const totalPreviousPaid = pfPreviousSplits.reduce((sum, s) => sum + Number(s.amount || 0), 0);
                    const remaining = Math.max(0, finalPayable - totalPreviousPaid);
                    return (
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--surface-glass-border)', marginTop: 'var(--space-3)', paddingTop: 'var(--space-2)', fontSize: 'var(--text-xs)', fontWeight: 600 }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Paid: {fmt(totalPreviousPaid)}</span>
                        <span style={{ color: remaining > 0 ? 'var(--status-warning)' : 'var(--text-muted)' }}>Remaining: {fmt(remaining)}</span>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Payment Date */}
              <div className="form-group" style={{ marginBottom: 'var(--space-5)' }}>
                <label className="form-label required">Payment Date</label>
                <CustomDatePicker
                  value={pfDate}
                  onChange={(val) => setPfDate(val)}
                />
              </div>

              {/* Splits */}
              <div style={{ marginBottom: 'var(--space-5)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                  <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                    {pfPreviousSplits.length > 0 ? 'New Payment Splits' : 'Payment Splits'}
                  </div>
                  <button
                    className="btn btn-secondary btn-sm"
                    type="button"
                    onClick={() => addSplit(paymentBooking.expectedAmount - pfDiscountAmount)}
                  >
                    ➕ Add Split Mode
                  </button>
                </div>

                {pfSplits.map((split, index) => (
                  <div key={index} style={{ border: '1px solid var(--surface-glass-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)', background: 'var(--bg-tertiary)', marginBottom: 'var(--space-3)', position: 'relative' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                      <span style={{ fontWeight: 600, fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Split Mode #{index + 1}</span>
                      {pfSplits.length > 1 && (
                        <button className="btn btn-ghost btn-sm" type="button" onClick={() => removeSplit(index)} style={{ padding: '2px 6px', color: 'var(--status-danger)', fontSize: 'var(--text-xs)' }}>
                          ✕ Remove
                        </button>
                      )}
                    </div>
                    <div className="form-grid-2" style={{ gap: 'var(--space-3)' }}>
                      <div className="form-group">
                        <label className="form-label required">Amount (₹)</label>
                        <input
                          className="form-input"
                          type="number"
                          value={split.amount || ''}
                          onChange={(e) => updateSplit(index, 'amount', Number(e.target.value))}
                          placeholder="e.g. 500"
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label required">Payment Mode</label>
                        <CustomSelect
                          options={[
                            { value: 'bank_transfer', label: 'Bank Transfer', icon: <span>🏦</span> },
                            { value: 'upi', label: 'UPI', icon: <span>📱</span> },
                            { value: 'card', label: 'Card', icon: <span>💳</span> },
                            { value: 'cash', label: 'Cash', icon: <span>💵</span> }
                          ]}
                          value={split.paymentMode}
                          onChange={(val) => updateSplit(index, 'paymentMode', val)}
                        />
                      </div>

                      {split.paymentMode === 'cash' && (
                        <>
                          <div className="form-group">
                            <label className="form-label required">Cash Received By</label>
                            <CustomSelect
                              options={[
                                { value: '', label: '— Select —' },
                                { value: 'turf_staff', label: 'Turf Staff' },
                                { value: 'turf_owner', label: 'Turf Owner' },
                                { value: 'arjo', label: 'Arjo' }
                              ]}
                              value={split.cashReceivedBy}
                              onChange={(val) => updateSplit(index, 'cashReceivedBy', val)}
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Reference Note</label>
                            <input
                              className="form-input"
                              value={split.referenceNote || ''}
                              onChange={(e) => updateSplit(index, 'referenceNote', e.target.value)}
                              placeholder="e.g. Received in envelope"
                            />
                          </div>
                        </>
                      )}

                      {split.paymentMode !== 'cash' && (
                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                          <label className="form-label">Reference / UTR Number</label>
                          <input
                            className="form-input"
                            value={split.referenceNumber || ''}
                            onChange={(e) => updateSplit(index, 'referenceNumber', e.target.value)}
                            placeholder={split.paymentMode === 'upi' ? 'UPI Transaction ID / UTR' : split.paymentMode === 'card' ? 'Card Transaction ID' : 'Bank Reference ID'}
                          />
                        </div>
                      )}
                    </div>
                    {(() => {
                      const finalPayable = paymentBooking.expectedAmount - pfDiscountAmount;
                      const totalPreviousPaid = pfPreviousSplits.reduce((sum, s) => sum + Number(s.amount || 0), 0);
                      const sumUpToThis = totalPreviousPaid + pfSplits.slice(0, index + 1).reduce((sum, s) => sum + Number(s.amount || 0), 0);
                      const remainingAfterThis = Math.max(0, finalPayable - sumUpToThis);
                      return (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-3)', borderTop: '1px dashed var(--surface-glass-border)', paddingTop: 'var(--space-2)' }}>
                          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)' }}>
                            Remaining Balance: {fmt(remainingAfterThis)}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                ))}

                {/* Validation Status Indicator */}
                {(() => {
                  const finalPayable = paymentBooking.expectedAmount - pfDiscountAmount;
                  const totalPreviousPaid = pfPreviousSplits.reduce((sum, s) => sum + Number(s.amount || 0), 0);
                  const totalNewSplitsAmount = pfSplits.reduce((sum, s) => sum + Number(s.amount || 0), 0);
                  const totalPaidAmount = totalPreviousPaid + totalNewSplitsAmount;
                  
                  const isExceeded = totalPaidAmount > finalPayable;
                  const isMatched = totalPaidAmount === finalPayable;
                  let bg = 'var(--status-warning-soft)';
                  let border = 'var(--status-warning-border)';
                  let color = 'var(--status-warning)';
                  let msg = `ℹ️ Total paid (₹${totalPaidAmount}) is less than Final Payable (₹${finalPayable}). This will be saved as a Partial Payment.`;

                  if (isMatched) {
                    bg = 'var(--status-success-soft)';
                    border = 'var(--status-success-border)';
                    color = 'var(--status-success)';
                    msg = '✓ Total paid matches Final Payable perfectly';
                  } else if (isExceeded) {
                    bg = 'var(--status-danger-soft)';
                    border = 'var(--status-danger-border)';
                    color = 'var(--status-danger)';
                    msg = `✕ Total paid (₹${totalPaidAmount}) exceeds Final Payable (₹${finalPayable})!`;
                  }

                  return (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-md)', background: bg, border: `1px solid ${border}`, color: color, fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                      <span>
                        {msg}
                      </span>
                      <span>
                        ₹{totalPaidAmount} / ₹{finalPayable}
                      </span>
                    </div>
                  );
                })()}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-md" onClick={() => setShowPaymentForm(false)}>Cancel</button>
              <button className={`btn btn-primary btn-md ${pfSaving ? 'btn-loading' : ''}`} onClick={handleAddPayment} disabled={pfSaving}>
                💰 Save Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
