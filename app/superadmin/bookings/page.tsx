'use client';
import { useState, useEffect, useCallback } from 'react';

// ---- Types ----
interface BookingData {
  _id: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  customerName: string;
  contactNumber: string;
  expectedAmount: number;
  notes: string;
  bookingStatus: 'confirmed' | 'cancelled';
  paymentStatus: 'pending' | 'partial' | 'paid';
  totalPaid: number;
  cancelReason: string;
  cancelledAt: string | null;
  cancelledBy: { name: string } | null;
  createdBy: { name: string } | null;
  createdAt: string;
}

interface PaymentData {
  _id: string;
  bookingId: string;
  amountPaid: number;
  paymentMode: 'bank_transfer' | 'cash';
  paymentDate: string;
  referenceNumber: string;
  cashReceivedBy: string;
  referenceNote: string;
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
const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

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
  cash: 'Cash',
};

// ---- Component ----
export default function BookingsPage() {
  // --- State ---
  const [activeTab, setActiveTab] = useState<'bookings' | 'payments'>('bookings');
  const [bookings, setBookings] = useState<BookingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: string } | null>(null);

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
  const [pfAmount, setPfAmount] = useState('');
  const [pfMode, setPfMode] = useState<'bank_transfer' | 'cash'>('bank_transfer');
  const [pfDate, setPfDate] = useState(today());
  const [pfRefNumber, setPfRefNumber] = useState('');
  const [pfCashBy, setPfCashBy] = useState('');
  const [pfRefNote, setPfRefNote] = useState('');
  const [pfSaving, setPfSaving] = useState(false);
  const [pfError, setPfError] = useState('');

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

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

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
    if (!bfDate || !bfStartTime || !bfEndTime || !bfAmount) {
      setBfError('Please fill all required fields');
      return;
    }
    if (Number(bfAmount) <= 0) {
      setBfError('Expected amount must be greater than 0');
      return;
    }
    if (bfStartTime >= bfEndTime) {
      setBfError('Start time must be before end time');
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
          expectedAmount: Number(bfAmount),
          notes: bfNotes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Booking confirmed! ✅');
        resetBookingForm();
        fetchBookings();
      } else {
        setBfError(data.message);
      }
    } catch {
      setBfError('Network error');
    } finally {
      setBfSaving(false);
    }
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
        setViewBooking(data.data.booking);
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
    if (Number(efAmount) <= 0) {
      showToast('Expected amount must be > 0', 'error');
      return;
    }
    setEfSaving(true);
    try {
      const res = await fetch(`/api/bookings/${viewBooking._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: efCustomer,
          contactNumber: efContact,
          expectedAmount: Number(efAmount),
          notes: efNotes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Booking updated ✅');
        setEditMode(false);
        openViewBooking(data.data);
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

  const openPaymentForm = (booking: BookingData) => {
    setPaymentBooking(booking);
    setShowPaymentForm(true);
    setPfAmount('');
    setPfMode('bank_transfer');
    setPfDate(today());
    setPfRefNumber('');
    setPfCashBy('');
    setPfRefNote('');
    setPfError('');
  };

  const handleAddPayment = async () => {
    setPfError('');
    if (!paymentBooking) return;
    if (!pfAmount || Number(pfAmount) <= 0) {
      setPfError('Amount must be greater than 0');
      return;
    }
    if (!pfDate) {
      setPfError('Payment date is required');
      return;
    }
    if (pfMode === 'cash' && !pfCashBy) {
      setPfError('Cash Received By is required for cash payments');
      return;
    }
    setPfSaving(true);
    try {
      const res = await fetch(`/api/bookings/${paymentBooking._id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountPaid: Number(pfAmount),
          paymentMode: pfMode,
          paymentDate: pfDate,
          referenceNumber: pfRefNumber,
          cashReceivedBy: pfMode === 'cash' ? pfCashBy : '',
          referenceNote: pfRefNote,
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
        setPfError(data.message);
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
      partial: { cls: 'badge-info', label: 'Partial' },
      paid: { cls: 'badge-success', label: 'Paid' },
      confirmed: { cls: 'badge-success', label: 'Confirmed' },
      cancelled: { cls: 'badge-danger', label: 'Cancelled' },
    };
    const m = map[status] || { cls: 'badge-neutral', label: status };
    return <span className={`badge ${m.cls} badge-dot`}>{m.label}</span>;
  };

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
            <div className="data-table-wrapper">
              <table className="data-table" id="bookings-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Time Slot</th>
                    <th>Customer</th>
                    <th>Contact</th>
                    <th>Expected</th>
                    <th>Payment</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map(b => (
                    <tr key={b._id} style={b.bookingStatus === 'cancelled' ? { opacity: 0.55 } : undefined}>
                      <td style={{ fontWeight: 600 }}>{fmtDate(b.bookingDate)}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)' }}>
                        {fmtTime(b.startTime)} – {fmtTime(b.endTime)}
                      </td>
                      <td>{b.customerName || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Anonymous</span>}</td>
                      <td style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{b.contactNumber || '—'}</td>
                      <td style={{ fontWeight: 600 }}>{fmt(b.expectedAmount)}</td>
                      <td>{statusBadge(b.paymentStatus)}</td>
                      <td>{statusBadge(b.bookingStatus)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => openViewBooking(b)}>View</button>
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
                  <input type="date" className="form-input" value={dashStartDate} onChange={e => setDashStartDate(e.target.value)} style={{ width: 160, height: 36, fontSize: 'var(--text-sm)' }} />
                  <span style={{ color: 'var(--text-tertiary)' }}>to</span>
                  <input type="date" className="form-input" value={dashEndDate} onChange={e => setDashEndDate(e.target.value)} style={{ width: 160, height: 36, fontSize: 'var(--text-sm)' }} />
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
                  <div className="data-table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
                    <table className="data-table" id="payment-breakdown-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Time Slot</th>
                          <th>Customer</th>
                          <th>Expected</th>
                          <th>Paid</th>
                          <th>Balance</th>
                          <th>Mode</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dashBreakdown.map(b => (
                          <tr
                            key={b._id}
                            style={
                              b.paymentStatus === 'pending' ? { background: 'var(--status-warning-soft)' } :
                              b.paymentStatus === 'partial' ? { background: 'var(--status-info-soft)' } :
                              undefined
                            }
                          >
                            <td style={{ fontWeight: 600 }}>{fmtDate(b.bookingDate)}</td>
                            <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)' }}>
                              {fmtTime(b.startTime)} – {fmtTime(b.endTime)}
                            </td>
                            <td>{b.customerName}</td>
                            <td>{fmt(b.expectedAmount)}</td>
                            <td style={{ fontWeight: 600, color: 'var(--status-success)' }}>{fmt(b.totalPaid)}</td>
                            <td style={{ color: b.remainingBalance > 0 ? 'var(--status-danger)' : 'var(--text-muted)' }}>
                              {b.remainingBalance > 0 ? fmt(b.remainingBalance) : '—'}
                            </td>
                            <td>
                              {b.paymentModes.length > 0
                                ? b.paymentModes.map(m => PAYMENT_MODE_LABELS[m] || m).join(', ')
                                : <span style={{ color: 'var(--text-muted)' }}>—</span>
                              }
                            </td>
                            <td>{statusBadge(b.paymentStatus)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                <div className="form-group">
                  <label className="form-label required">Booking Date</label>
                  <input type="date" className="form-input" value={bfDate} onChange={e => setBfDate(e.target.value)} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
                  <div className="form-group">
                    <label className="form-label required">Start Time</label>
                    <input type="time" className="form-input" value={bfStartTime} onChange={e => setBfStartTime(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label required">End Time</label>
                    <input type="time" className="form-input" value={bfEndTime} onChange={e => setBfEndTime(e.target.value)} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Customer Name</label>
                  <input className="form-input" placeholder="Leave blank if unknown" value={bfCustomer} onChange={e => setBfCustomer(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Contact Number</label>
                  <input className="form-input" type="tel" placeholder="Phone number" value={bfContact} onChange={e => setBfContact(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label required">Expected Amount (₹)</label>
                  <input className="form-input" type="number" placeholder="e.g. 4400" value={bfAmount} onChange={e => setBfAmount(e.target.value)} min="1" />
                </div>
              </div>
              <div className="form-group" style={{ marginTop: 'var(--space-4)' }}>
                <label className="form-label">Notes</label>
                <textarea className="form-input form-textarea" placeholder="Any additional information..." value={bfNotes} onChange={e => setBfNotes(e.target.value)} rows={3} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-md" onClick={() => resetBookingForm()}>Cancel</button>
              <button className={`btn btn-primary btn-md ${bfSaving ? 'btn-loading' : ''}`} onClick={handleCreateBooking} disabled={bfSaving}>
                ✅ Confirm Booking
              </button>
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
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                    <div className="form-group">
                      <label className="form-label">Customer Name</label>
                      <input className="form-input" value={efCustomer} onChange={e => setEfCustomer(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Contact Number</label>
                      <input className="form-input" value={efContact} onChange={e => setEfContact(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label required">Expected Amount (₹)</label>
                      <input className="form-input" type="number" value={efAmount} onChange={e => setEfAmount(e.target.value)} min="1" />
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
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                    {[
                      { label: 'Date', value: fmtDate(viewBooking.bookingDate) },
                      { label: 'Time Slot', value: `${fmtTime(viewBooking.startTime)} – ${fmtTime(viewBooking.endTime)}` },
                      { label: 'Customer', value: viewBooking.customerName || 'Anonymous' },
                      { label: 'Contact', value: viewBooking.contactNumber || '—' },
                      { label: 'Expected Amount', value: fmt(viewBooking.expectedAmount) },
                      { label: 'Total Paid', value: fmt(viewBooking.totalPaid) },
                    ].map((item, i) => (
                      <div key={i}>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-1)' }}>{item.label}</div>
                        <div style={{ fontWeight: 600 }}>{item.value}</div>
                      </div>
                    ))}
                  </div>

                  {viewBooking.totalPaid > viewBooking.expectedAmount && (
                    <div style={{ background: 'var(--status-info-soft)', border: '1px solid var(--status-info-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--status-info)' }}>
                      💡 Overpayment of {fmt(viewBooking.totalPaid - viewBooking.expectedAmount)} recorded
                    </div>
                  )}

                  {viewBooking.expectedAmount > viewBooking.totalPaid && viewBooking.totalPaid > 0 && (
                    <div style={{ background: 'var(--status-warning-soft)', border: '1px solid var(--status-warning-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--status-warning)' }}>
                      ⏳ Remaining balance: {fmt(viewBooking.expectedAmount - viewBooking.totalPaid)}
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
                          <div key={p._id} style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3) var(--space-4)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                            <div>
                              <div style={{ fontWeight: 600, color: 'var(--status-success)' }}>{fmt(p.amountPaid)}</div>
                              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                                {fmtDate(p.paymentDate)} · {PAYMENT_MODE_LABELS[p.paymentMode]}
                                {p.cashReceivedBy && ` · ${CASH_HOLDER_LABELS[p.cashReceivedBy] || p.cashReceivedBy}`}
                              </div>
                            </div>
                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textAlign: 'right' }}>
                              {p.referenceNumber && <div>Ref: {p.referenceNumber}</div>}
                              {p.referenceNote && <div>{p.referenceNote}</div>}
                              <div>by {p.createdBy?.name || '—'}</div>
                            </div>
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
            <div className="modal-body">
              {/* Booking Context */}
              <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)', marginBottom: 'var(--space-5)', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 'var(--space-3)' }}>
                {[
                  { label: 'Date', value: fmtDate(paymentBooking.bookingDate) },
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

              {pfError && (
                <div style={{ background: 'var(--status-danger-soft)', border: '1px solid var(--status-danger-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3) var(--space-4)', marginBottom: 'var(--space-4)', color: 'var(--status-danger)', fontSize: 'var(--text-sm)' }}>
                  ⚠️ {pfError}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                <div className="form-group">
                  <label className="form-label required">Amount Paid (₹)</label>
                  <input className="form-input" type="number" placeholder="e.g. 4400" value={pfAmount} onChange={e => setPfAmount(e.target.value)} min="1" />
                  {paymentBooking.totalPaid > 0 && (
                    <span className="form-helper">Already paid: {fmt(paymentBooking.totalPaid)} / {fmt(paymentBooking.expectedAmount)}</span>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label required">Payment Mode</label>
                  <div className="select-wrapper">
                    <select className="form-select" value={pfMode} onChange={e => setPfMode(e.target.value as 'bank_transfer' | 'cash')}>
                      <option value="bank_transfer">🏦 Bank Transfer</option>
                      <option value="cash">💵 Cash</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label required">Payment Date</label>
                  <input type="date" className="form-input" value={pfDate} onChange={e => setPfDate(e.target.value)} />
                </div>

                {pfMode === 'bank_transfer' && (
                  <div className="form-group">
                    <label className="form-label">Reference / UTR Number</label>
                    <input className="form-input" placeholder="Bank reference" value={pfRefNumber} onChange={e => setPfRefNumber(e.target.value)} />
                  </div>
                )}

                {pfMode === 'cash' && (
                  <>
                    <div className="form-group">
                      <label className="form-label required">Cash Received By</label>
                      <div className="select-wrapper">
                        <select className="form-select" value={pfCashBy} onChange={e => setPfCashBy(e.target.value)}>
                          <option value="">— Select —</option>
                          <option value="turf_staff">Turf Staff</option>
                          <option value="turf_owner">Turf Owner</option>
                          <option value="arjo">Arjo</option>
                        </select>
                      </div>
                    </div>
                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                      <label className="form-label">Reference Note</label>
                      <input className="form-input" placeholder="Any note about this cash transaction" value={pfRefNote} onChange={e => setPfRefNote(e.target.value)} />
                    </div>
                  </>
                )}
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
