'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { CustomDatePicker } from '@/components/ui/CustomDatePicker';
import { CustomSelect } from '@/components/ui/CustomSelect';
import {
  Calendar, Check, CheckCircle, ChevronRight, Clock, FileText, IndianRupee,
  Plus, Receipt, Search, Trash2, X, AlertCircle
} from 'lucide-react';

interface Booking {
  _id: string;
  bookingType: 'standard' | 'bulk';
  bookingDate: string;
  startTime: string;
  endTime: string;
  customerName: string;
  contactNumber: string;
  expectedAmount: number;
  discountAmount: number;
  discountPercentage: number;
  totalPaid: number;
  bookingStatus: 'confirmed' | 'cancelled';
  paymentStatus: 'pending' | 'partial' | 'paid';
  bulkId: string | null;
  createdBy: { name: string };
  allDates?: string[];
  slots?: { bookingDate: string }[];
}

interface PaymentEntry {
  _id: string;
  amountPaid: number;
  paymentMode: string;
  paymentDate: string;
  referenceNumber: string;
  cashReceivedBy: string;
  referenceNote: string;
  discountAmount: number;
  discountPercentage: number;
  createdBy: { name: string };
  splits?: {
    amount: number;
    paymentMode: string;
    referenceNumber: string;
    cashReceivedBy: string;
    referenceNote: string;
  }[];
}

interface PaymentSplit {
  amount: number | '';
  paymentMode: 'bank_transfer' | 'upi' | 'card' | 'cash';
  referenceNumber: string;
  cashReceivedBy: 'turf_staff' | 'turf_owner' | 'arjo' | '';
  referenceNote: string;
}

export default function ManageBookingsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const portalBase = pathname?.split('/')[1] || 'superadmin';
  const newBookingUrl = `/${portalBase}/bookings`;
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('all'); // all, pending, partial, paid
  
  // Modals
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [bookingPayments, setBookingPayments] = useState<PaymentEntry[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  
  // Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [discountType, setDiscountType] = useState<'percentage' | 'flat'>('percentage');
  const [discountInput, setDiscountInput] = useState<number | ''>('');
  const [paymentSplits, setPaymentSplits] = useState<PaymentSplit[]>([
    { amount: '', paymentMode: 'cash', referenceNumber: '', cashReceivedBy: '', referenceNote: '' }
  ]);
  const [savingPayment, setSavingPayment] = useState(false);
  
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Derived calculations for payment modal
  const baseAmount = selectedBooking?.expectedAmount || 0;
  const dInput = Number(discountInput) || 0;
  const discountAmt = discountType === 'percentage' ? Math.round((baseAmount * dInput) / 100) : dInput;
  const finalPayable = Math.max(0, baseAmount - discountAmt);
  const pendingAmount = Math.max(0, finalPayable - (selectedBooking?.totalPaid || 0));
  const totalEntered = paymentSplits.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        bookingStatus: 'confirmed',
        limit: '100',
      });
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (paymentStatus !== 'all') params.append('status', paymentStatus);

      const res = await fetch(`/api/bookings?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        const rawBookings = data.data.bookings || [];
        const grouped: Booking[] = [];
        const bulkMap = new Map<string, Booking>();
        
        for (const b of rawBookings) {
          if (!b.bulkId) {
            grouped.push({ ...b, bookingType: b.bookingType || 'standard' });
          } else {
            if (bulkMap.has(b.bulkId)) {
              const existing = bulkMap.get(b.bulkId)!;
              existing.expectedAmount += b.expectedAmount;
              existing.totalPaid += b.totalPaid;
              existing.discountAmount = (existing.discountAmount || 0) + (b.discountAmount || 0);
              if (b.bookingDate && existing.allDates && !existing.allDates.includes(b.bookingDate)) {
                existing.allDates.push(b.bookingDate);
              }
            } else {
              const dates = new Set<string>();
              if (b.bookingDate) dates.add(b.bookingDate);
              if (b.slots && Array.isArray(b.slots)) {
                b.slots.forEach((s: any) => { if (s.bookingDate) dates.add(s.bookingDate); });
              }
              const clone = { ...b, bookingType: b.bookingType || 'bulk', allDates: Array.from(dates) };
              bulkMap.set(b.bulkId, clone);
              grouped.push(clone);
            }
          }
        }
        
        grouped.sort((a, b) => new Date(b.bookingDate).getTime() - new Date(a.bookingDate).getTime());
        setBookings(grouped);
      }
    } catch (error) {
      console.error(error);
      showToast('Failed to load bookings', 'error');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, paymentStatus, showToast]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  useEffect(() => {
    if (paymentSplits.length === 0) return;
    setPaymentSplits(prev => {
      if (prev.length === 0) return prev;
      if (prev.length === 1) {
        if (prev[0].amount !== (pendingAmount > 0 ? pendingAmount : '')) {
          return [{ ...prev[0], amount: pendingAmount > 0 ? pendingAmount : '' }];
        }
        return prev;
      }
      
      // When pendingAmount changes, adjust the main split (Split 0) to balance the total
      const sumExceptFirst = prev.reduce((sum, split, i) => {
        if (i === 0) return sum;
        return sum + (Number(split.amount) || 0);
      }, 0);
      
      const newFirstAmount = Math.max(0, pendingAmount - sumExceptFirst);
      const formattedFirstAmount = newFirstAmount > 0 ? newFirstAmount : '';
      if (prev[0].amount !== formattedFirstAmount) {
        const newSplits = [...prev];
        newSplits[0] = {
          ...prev[0],
          amount: formattedFirstAmount
        };
        return newSplits;
      }
      
      return prev;
    });
  }, [pendingAmount]);

  const handleRowClick = async (booking: Booking) => {
    setSelectedBooking(booking);
    setPaymentsLoading(true);
    try {
      const res = await fetch(`/api/bookings/${booking._id}`);
      const data = await res.json();
      if (data.success) {
        setBookingPayments(data.data.payments || []);
      }
    } catch (error) {
      showToast('Failed to load payments', 'error');
    } finally {
      setPaymentsLoading(false);
    }
  };

  const openPaymentModal = (booking: Booking, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedBooking(booking);
    setPaymentSplits([{ 
      amount: Math.max(0, booking.expectedAmount - (booking.discountAmount || 0) - booking.totalPaid), 
      paymentMode: 'cash', 
      referenceNumber: '', 
      cashReceivedBy: '', 
      referenceNote: '' 
    }]);
    setDiscountInput(booking.discountPercentage > 0 ? booking.discountPercentage : booking.discountAmount > 0 ? booking.discountAmount : '');
    setDiscountType(booking.discountPercentage > 0 ? 'percentage' : 'flat');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setShowPaymentModal(true);
  };

  const addSplit = () => {
    setPaymentSplits(prev => {
      const currentTotal = prev.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
      const remaining = Math.max(0, pendingAmount - currentTotal);
      return [...prev, { amount: remaining > 0 ? remaining : '', paymentMode: 'cash', referenceNumber: '', cashReceivedBy: '', referenceNote: '' }];
    });
  };

  const removeSplit = (index: number) => {
    if (paymentSplits.length === 1) return;
    setPaymentSplits(prev => {
      if (prev.length <= 1) return prev;
      const removedAmount = Number(prev[index].amount) || 0;
      
      // If we delete the first split, the new first split (was index 1) absorbs the amount.
      // Otherwise, the main first split (index 0) absorbs the amount.
      const targetIndex = index === 0 ? 1 : 0;
      
      return (prev
        .map((split, i) => {
          if (i === targetIndex) {
            const currentAmount = Number(split.amount) || 0;
            const updatedAmount = currentAmount + removedAmount;
            return {
              ...split,
              amount: updatedAmount > 0 ? updatedAmount : ''
            };
          }
          return split;
        })
        .filter((_, i) => i !== index)) as PaymentSplit[];
    });
  };

  const updateSplit = (index: number, field: keyof PaymentSplit, value: any) => {
    setPaymentSplits(prev => {
      const newSplits = [...prev];
      newSplits[index] = { ...newSplits[index], [field]: value };

      if (field === 'amount' && prev.length > 1) {
        // If editing any split other than the first one (index 0), the first split absorbs the change.
        // If editing the first split, the last split absorbs the change.
        const targetIndex = index !== 0 ? 0 : prev.length - 1;
        
        const sumExceptTarget = newSplits.reduce((sum, split, i) => {
          if (i === targetIndex) return sum;
          return sum + (Number(split.amount) || 0);
        }, 0);
        const remainingForTarget = Math.max(0, pendingAmount - sumExceptTarget);
        newSplits[targetIndex] = {
          ...newSplits[targetIndex],
          amount: remainingForTarget > 0 ? remainingForTarget : ''
        };
      }

      return newSplits;
    });
  };

  const handlePaymentSubmit = async () => {
    if (!selectedBooking) return;

    // Validation
    let totalSplitAmount = 0;
    for (const split of paymentSplits) {
      const amt = Number(split.amount) || 0;
      if (amt < 0) return showToast('Amount cannot be negative', 'error');
      if (split.paymentMode === 'cash' && !split.cashReceivedBy) {
        return showToast('Cash Received By is required for cash payments', 'error');
      }
      totalSplitAmount += amt;
    }

    setSavingPayment(true);
    try {
      let finalDiscountAmount = 0;
      let finalDiscountPct = 0;
      const dInput = Number(discountInput) || 0;
      
      if (dInput > 0) {
        if (discountType === 'percentage') {
          finalDiscountPct = dInput;
          finalDiscountAmount = Math.round((selectedBooking.expectedAmount * dInput) / 100);
        } else {
          finalDiscountAmount = dInput;
        }
      }

      const payload = {
        amountPaid: totalSplitAmount, // Not strictly used when splits are sent, but kept for backward compat
        paymentMode: paymentSplits.length === 1 ? paymentSplits[0].paymentMode : 'split',
        paymentDate,
        discountAmount: finalDiscountAmount,
        discountPercentage: finalDiscountPct,
        splits: paymentSplits.map(s => ({
          ...s,
          amount: Number(s.amount) || 0
        }))
      };

      const res = await fetch(`/api/bookings/${selectedBooking._id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        showToast('Payment recorded successfully');
        setShowPaymentModal(false);
        fetchBookings(); // Refresh list
        if (selectedBooking) handleRowClick(selectedBooking); // Refresh detail
      } else {
        throw new Error(data.message || 'Failed to record payment');
      }
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setSavingPayment(false);
    }
  };

  const fmt = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

  return (
    <div className="page-container">
      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type === 'error' ? 'error' : 'success'}`}>
            <span className="toast-icon">{toast.type === 'error' ? '✕' : '✓'}</span>
            <div className="toast-content"><div className="toast-title">{toast.message}</div></div>
          </div>
        </div>
      )}

      <div className="page-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 'var(--space-4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
          <div>
            <h1>Manage Bookings</h1>
            <p className="page-subtitle">View existing bookings and record payments</p>
          </div>
          <div className="pill-toggle-group" style={{ background: 'var(--surface-secondary)', padding: '4px', borderRadius: '30px' }}>
            <button className="pill-toggle" onClick={() => router.push(newBookingUrl)} style={{ padding: '8px 24px', borderRadius: '24px', fontSize: 'var(--text-sm)', fontWeight: 500 }}>
              New Booking
            </button>
            <button className="pill-toggle active" style={{ padding: '8px 24px', borderRadius: '24px', fontSize: 'var(--text-sm)', fontWeight: 500 }}>
              Manage Bookings
            </button>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="card-body" style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ flex: '1 1 200px' }}>
            <label className="form-label">From Date</label>
            <CustomDatePicker value={startDate} onChange={setStartDate} placeholder="Any date" />
          </div>
          <div className="form-group" style={{ flex: '1 1 200px' }}>
            <label className="form-label">To Date</label>
            <CustomDatePicker value={endDate} onChange={setEndDate} placeholder="Any date" />
          </div>
          <div className="form-group" style={{ flex: '1 1 200px' }}>
            <label className="form-label">Payment Status</label>
            <CustomSelect
              options={[
                { value: 'all', label: 'All Statuses' },
                { value: 'pending', label: 'Pending' },
                { value: 'partial', label: 'Partial' },
                { value: 'paid', label: 'Paid' },
              ]}
              value={paymentStatus}
              onChange={setPaymentStatus}
            />
          </div>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="loading-screen"><div className="spinner spinner-lg" /></div>
        ) : bookings.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><Calendar size={48} /></div>
            <div className="empty-state-title">No bookings found</div>
            <div className="empty-state-description">Adjust your filters to see more results.</div>
          </div>
        ) : (
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Booking Details</th>
                  <th>Customer</th>
                  <th>Total Amount</th>
                  <th>Paid Amount</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => {
                  const isPaid = b.paymentStatus === 'paid';
                  return (
                    <tr key={b._id} onClick={() => handleRowClick(b)} style={{ cursor: 'pointer' }} className="hover-row">
                      <td>
                        <div style={{ fontWeight: 600 }}>
                          {b.bookingType === 'bulk' && b.allDates && b.allDates.length > 1
                            ? b.allDates.map(d => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })).join(', ')
                            : b.bookingDate ? new Date(b.bookingDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Bulk Booking'}
                        </div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                          {b.bookingType === 'bulk' ? `Bulk Order (${b.allDates?.length || 1} dates)` : `${b.startTime} - ${b.endTime}`}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{b.customerName || 'Walk-in'}</div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{b.contactNumber || 'No contact'}</div>
                      </td>
                      <td style={{ fontWeight: 600 }}>{fmt(b.expectedAmount - (b.discountAmount || 0))}</td>
                      <td style={{ color: isPaid ? 'var(--status-success)' : 'inherit' }}>{fmt(b.totalPaid)}</td>
                      <td>
                        <span className={`badge badge-${isPaid ? 'success' : b.paymentStatus === 'partial' ? 'warning' : 'danger'}`}>
                          {b.paymentStatus.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <button 
                          className="btn btn-primary btn-sm" 
                          onClick={(e) => openPaymentModal(b, e)}
                          disabled={isPaid}
                        >
                          <IndianRupee size={14} /> Pay
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Booking Details Modal */}
      {selectedBooking && !showPaymentModal && (
        <div className="modal-backdrop" onClick={() => setSelectedBooking(null)}>
          <div className="modal" style={{ maxWidth: '800px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Booking Details</h3>
              <button className="modal-close" onClick={() => setSelectedBooking(null)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="form-grid-2" style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
                <div className="card" style={{ padding: 'var(--space-4)', background: 'var(--surface-secondary)' }}>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Customer</div>
                  <div style={{ fontWeight: 600, fontSize: 'var(--text-lg)' }}>{selectedBooking.customerName || 'Walk-in'}</div>
                  <div style={{ color: 'var(--text-secondary)' }}>{selectedBooking.contactNumber || 'No contact provided'}</div>
                </div>
                <div className="card" style={{ padding: 'var(--space-4)', background: 'var(--surface-secondary)' }}>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Date & Time</div>
                  <div style={{ fontWeight: 600, fontSize: 'var(--text-lg)' }}>
                    {selectedBooking.bookingType === 'bulk' && selectedBooking.allDates && selectedBooking.allDates.length > 1
                      ? selectedBooking.allDates.map(d => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })).join(', ')
                      : selectedBooking.bookingDate ? new Date(selectedBooking.bookingDate).toLocaleDateString('en-IN') : 'Bulk Booking'}
                  </div>
                  <div style={{ color: 'var(--text-secondary)' }}>{selectedBooking.bookingType === 'bulk' ? `Bulk Order (${selectedBooking.allDates?.length || 1} dates)` : `${selectedBooking.startTime} - ${selectedBooking.endTime}`}</div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', borderBottom: '1px solid var(--border-primary)', paddingBottom: 'var(--space-2)' }}>
                <h4 style={{ margin: 0 }}>Payment Summary</h4>
                {selectedBooking.paymentStatus !== 'paid' && (
                  <button className="btn btn-primary btn-sm" onClick={(e) => openPaymentModal(selectedBooking, e)}>
                    Record Payment
                  </button>
                )}
              </div>

              <div className="form-grid-3" style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
                <div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Total Amount</div>
                  <div style={{ fontWeight: 600 }}>{fmt(selectedBooking.expectedAmount - (selectedBooking.discountAmount || 0))}</div>
                  {selectedBooking.discountAmount > 0 && (
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--status-success)' }}>
                      Includes {fmt(selectedBooking.discountAmount)} discount
                    </div>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Paid So Far</div>
                  <div style={{ fontWeight: 600, color: 'var(--status-success)' }}>{fmt(selectedBooking.totalPaid)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Pending Balance</div>
                  <div style={{ fontWeight: 600, color: selectedBooking.paymentStatus === 'paid' ? 'var(--text-primary)' : 'var(--status-danger)' }}>
                    {fmt(Math.max(0, selectedBooking.expectedAmount - (selectedBooking.discountAmount || 0) - selectedBooking.totalPaid))}
                  </div>
                </div>
              </div>

              <h4 style={{ margin: '0 0 var(--space-4) 0' }}>Payment History</h4>
              {paymentsLoading ? (
                <div className="loading-screen" style={{ minHeight: '100px' }}><div className="spinner spinner-md" /></div>
              ) : bookingPayments.length === 0 ? (
                <div className="empty-state" style={{ padding: 'var(--space-6)' }}>
                  <Receipt size={32} style={{ opacity: 0.5, marginBottom: 'var(--space-2)' }} />
                  <div style={{ color: 'var(--text-secondary)' }}>No payments recorded yet</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {bookingPayments.map(p => (
                    <div key={p._id} className="card" style={{ padding: 'var(--space-3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{fmt(p.amountPaid)}</div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                          {new Date(p.paymentDate).toLocaleDateString('en-IN')} • {p.paymentMode.replace('_', ' ')}
                        </div>
                        {p.paymentMode === 'split' && p.splits && (
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '4px' }}>
                            Splits: {p.splits.map(s => `${fmt(s.amount)} (${s.paymentMode})`).join(', ')}
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign: 'right', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                        <div>By {p.createdBy?.name || 'System'}</div>
                        {p.referenceNumber && <div>Ref: {p.referenceNumber}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-md" onClick={() => setSelectedBooking(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Complete Payment Modal */}
      {showPaymentModal && selectedBooking && (
        <div className="modal-backdrop" onClick={() => setShowPaymentModal(false)}>
          <div className="modal" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Complete Payment</h3>
              <button className="modal-close" onClick={() => setShowPaymentModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              
              <div className="card" style={{ padding: 'var(--space-4)', background: 'var(--surface-secondary)', marginBottom: 'var(--space-6)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Total Booking Value:</span>
                  <strong style={{ fontSize: '1.1em' }}>{fmt(selectedBooking.expectedAmount)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: 'var(--status-success)' }}>
                  <span>Discount:</span>
                  <span>-{fmt(discountAmt)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span>Already Paid:</span>
                  <span>{fmt(selectedBooking.totalPaid)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid var(--border-primary)' }}>
                  <span style={{ fontWeight: 600 }}>Pending Balance:</span>
                  <strong style={{ color: 'var(--status-danger)', fontSize: '1.2em' }}>{fmt(pendingAmount)}</strong>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                <label className="form-label">Discount</label>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <CustomSelect
                    options={[
                      { value: 'percentage', label: 'Percentage (%)' },
                      { value: 'flat', label: 'Flat Amount (₹)' }
                    ]}
                    value={discountType}
                    onChange={(v) => setDiscountType(v as 'percentage' | 'flat')}
                  />
                  <input
                    className="form-input"
                    type="number"
                    min="0"
                    placeholder="Discount value"
                    value={discountInput}
                    onChange={(e) => setDiscountInput(e.target.value ? Number(e.target.value) : '')}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 'var(--space-6)' }}>
                <label className="form-label">Payment Date</label>
                <CustomDatePicker value={paymentDate} onChange={setPaymentDate} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                <label className="form-label" style={{ margin: 0 }}>Payment Splits</label>
                <button type="button" className="btn btn-ghost btn-sm" onClick={addSplit}>
                  <Plus size={14} /> Add Mode
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
                {paymentSplits.map((split, index) => (
                  <div key={index} className="card" style={{ padding: 'var(--space-3)', position: 'relative' }}>
                    {paymentSplits.length > 1 && (
                      <button 
                        className="btn btn-icon btn-ghost btn-sm" 
                        style={{ position: 'absolute', top: '8px', right: '8px', color: 'var(--status-danger)' }}
                        onClick={() => removeSplit(index)}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                    
                    <div className="form-grid-2" style={{ gap: 'var(--space-3)', marginBottom: 'var(--space-3)', paddingRight: paymentSplits.length > 1 ? '30px' : '0' }}>
                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: 'var(--text-xs)' }}>Amount (₹)</label>
                        <input
                          className="form-input form-input-sm"
                          type="number"
                          min="0"
                          value={split.amount}
                          onChange={(e) => updateSplit(index, 'amount', e.target.value ? Number(e.target.value) : '')}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: 'var(--text-xs)' }}>Mode</label>
                        <CustomSelect
                          options={[
                            { value: 'cash', label: 'Cash' },
                            { value: 'upi', label: 'UPI' },
                            { value: 'card', label: 'Card' },
                            { value: 'bank_transfer', label: 'Bank Transfer' },
                          ]}
                          value={split.paymentMode}
                          onChange={(v) => updateSplit(index, 'paymentMode', v)}
                        />
                      </div>
                    </div>

                    {split.paymentMode === 'cash' ? (
                      <div className="form-grid-2" style={{ gap: 'var(--space-3)' }}>
                        <div className="form-group">
                          <label className="form-label required" style={{ fontSize: 'var(--text-xs)' }}>Received By</label>
                          <CustomSelect
                            options={[
                              { value: 'turf_staff', label: 'Turf Staff' },
                              { value: 'turf_owner', label: 'Turf Owner' },
                              { value: 'arjo', label: 'Arjo' },
                            ]}
                            value={split.cashReceivedBy}
                            onChange={(v) => updateSplit(index, 'cashReceivedBy', v)}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label" style={{ fontSize: 'var(--text-xs)' }}>Note (Optional)</label>
                          <input
                            className="form-input form-input-sm"
                            value={split.referenceNote}
                            onChange={(e) => updateSplit(index, 'referenceNote', e.target.value)}
                            placeholder="Details..."
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: 'var(--text-xs)' }}>Reference / UTR (Optional)</label>
                        <input
                          className="form-input form-input-sm"
                          value={split.referenceNumber}
                          onChange={(e) => updateSplit(index, 'referenceNumber', e.target.value)}
                          placeholder="Transaction ID"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>

            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 600, color: totalEntered > pendingAmount ? 'var(--status-danger)' : 'var(--text-primary)' }}>
                Total Entered: {fmt(totalEntered)}
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                <button className="btn btn-secondary btn-md" onClick={() => setShowPaymentModal(false)}>Cancel</button>
                <button 
                  className={`btn btn-primary btn-md ${savingPayment ? 'btn-loading' : ''}`} 
                  onClick={handlePaymentSubmit}
                  disabled={savingPayment || totalEntered <= 0 || totalEntered > pendingAmount}
                >
                  <CheckCircle size={18} /> Submit Payment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
