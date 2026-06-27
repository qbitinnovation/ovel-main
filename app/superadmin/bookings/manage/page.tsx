'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { CustomDatePicker } from '@/components/ui/CustomDatePicker';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { usePermissions } from '@/components/providers/PermissionsProvider';
import {
  Calendar, Check, CheckCircle, ChevronRight, Clock, FileText, IndianRupee,
  Plus, Receipt, Search, Trash2, X, AlertCircle, Edit, Minus
} from 'lucide-react';
import {
  DEFAULT_TURF_PRICING_CONFIG,
  calculateTurfSlotPrice,
  type TurfPricingConfig,
} from '@/lib/turf-pricing';
import { jsPDF } from 'jspdf';
import { generateTaxInvoice } from '@/lib/invoice-generator';

import * as XLSX from 'xlsx';

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
  facility: 'turf' | 'nets_with_machine' | 'nets_without_machine';
  hasLounge: boolean;
  loungeHours: number;
  loungeAmount: number;
  products: Array<{ itemId: string; name: string; quantity: number; price: number }>;
  productAmount: number;
  bulkId?: string | null;
  editHistory?: {
    editedAt: string;
    oldDate: string;
    oldStartTime: string;
    oldEndTime: string;
    oldExpectedAmount: number;
    newDate: string;
    newStartTime: string;
    newEndTime: string;
    newExpectedAmount: number;
  }[];
  createdBy: { name: string };
  allDates?: string[];
  slots?: { bookingDate: string; startTime: string; endTime: string }[];
  notes?: string;
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
  cashReceivedBy: string;
  referenceNote: string;
}

import { SlotGrid } from '@/components/bookings/SlotGrid';
import {
  TIME_SLOTS,
  isSlotBooked,
  hasAnyBookingOnDate,
  mergeSelectedSlots,
  rangesOverlap,
  formatDate,
  formatTime,
  getDateStr,
  getSlotsBetweenTimes,
  isSlotInPast,
  type ExistingBooking,
} from '@/lib/booking-utils';

const getInitialSlotsForBooking = (booking: Booking, date: string): string[] => {
  const selected: string[] = [];
  
  // If standard booking
  if (booking.bookingType !== 'bulk') {
    const mainDateStr = getDateStr(booking.bookingDate);
    if (mainDateStr === date) {
      return getSlotsBetweenTimes(booking.startTime || '', booking.endTime || '');
    }
    return [];
  }
  
  // If bulk booking, gather slots for the selected date
  if (booking.slots && Array.isArray(booking.slots)) {
    for (const slot of booking.slots) {
      const slotDateStr = getDateStr(slot.bookingDate);
      if (slotDateStr === date && slot.startTime && slot.endTime) {
        selected.push(...getSlotsBetweenTimes(slot.startTime, slot.endTime));
      }
    }
  }
  
  return selected;
};

const getUserLabel = (u: any) => {
  let extra = '';
  if (u.positionId?.name) {
    extra = u.positionId.name;
  } else if (u.portalType === 'turf') {
    extra = 'Turf Manager';
  } else if (u.portalType === 'shareholder') {
    extra = 'Shareholder';
  } else if (u.userType) {
    extra = u.userType.charAt(0).toUpperCase() + u.userType.slice(1);
  }
  return extra ? `${u.name} (${extra})` : u.name;
};

export default function ManageBookingsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const portalBase = pathname?.split('/')[1] || 'superadmin';
  const newBookingUrl = `/${portalBase}/bookings`;
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [pricing, setPricing] = useState<TurfPricingConfig>(DEFAULT_TURF_PRICING_CONFIG);
  const [pricingLoading, setPricingLoading] = useState(true);
  
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('all'); // all, pending, partial, paid
  const [facilityFilter, setFacilityFilter] = useState('all'); // all, turf, nets_with_machine, nets_without_machine
  
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
  const [users, setUsers] = useState<any[]>([]);

  // Edit Booking Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editCustomerName, setEditCustomerName] = useState('');
  const [editContactNumber, setEditContactNumber] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editBookingDate, setEditBookingDate] = useState('');
  const [editSelectedSlots, setEditSelectedSlots] = useState<string[]>([]);
  const [editBookedByDate, setEditBookedByDate] = useState<Record<string, ExistingBooking[]>>({});
  const [editBookedLoading, setEditBookedLoading] = useState(false);
  const [editUpdateGroup, setEditUpdateGroup] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  // Cancel Booking Modal State
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancellingBooking, setCancellingBooking] = useState(false);

  // Addons Modal State
  const [showAddonsModal, setShowAddonsModal] = useState(false);
  const [addonLoungeHours, setAddonLoungeHours] = useState<number | ''>('');
  const [addonProducts, setAddonProducts] = useState<Record<string, number>>({});
  const [savingAddons, setSavingAddons] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [loungeAddonUnavailable, setLoungeAddonUnavailable] = useState(false);
  const [checkingLoungeAddon, setCheckingLoungeAddon] = useState(false);

  const { checkPermission } = usePermissions();
  const canCreateBooking = checkPermission('bookings', 'create_booking');
  const canManageBookings = checkPermission('bookings', 'add_payment');
  const canViewPaymentDashboard = checkPermission('bookings', 'view_payment_dashboard');
  const canEditBooking = checkPermission('bookings', 'edit_booking');
  const canCancelBooking = checkPermission('bookings', 'cancel_booking');
  const canExportBill = checkPermission('bookings', 'export_bill');
  const canExportHistory = checkPermission('bookings', 'export_payment');

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

  const fetchPricing = useCallback(async () => {
    setPricingLoading(true);
    try {
      const res = await fetch(`/api/settings/pricing?sync=${Date.now()}`, { cache: 'no-store' });
      const data = await res.json();
      if (data.success) {
        setPricing(data.data.pricing || DEFAULT_TURF_PRICING_CONFIG);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setPricingLoading(false);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/users?status=active&limit=100');
      const data = await res.json();
      if (data.success) {
        setUsers(data.data.users || []);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  }, []);

  useEffect(() => {
    fetchPricing();
    fetchUsers();
  }, [fetchPricing, fetchUsers]);

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
      if (facilityFilter !== 'all') params.append('facility', facilityFilter);

      const res = await fetch(`/api/bookings?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        const rawBookings = data.data.bookings || [];
        const flattened: Booking[] = rawBookings.map((b: any) => ({
          ...b,
          bookingType: b.bulkId ? 'bulk' : (b.bookingType || 'standard')
        }));
        
        flattened.sort((a, b) => new Date(b.bookingDate).getTime() - new Date(a.bookingDate).getTime());
        setBookings(flattened);
      }
    } catch (error) {
      console.error(error);
      showToast('Failed to load bookings', 'error');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, paymentStatus, facilityFilter, showToast]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const fetchEditBookedSlots = useCallback(async (dateStr: string) => {
    if (!dateStr) return;
    setEditBookedLoading(true);
    try {
      const params = new URLSearchParams({
        startDate: dateStr,
        endDate: dateStr,
        bookingStatus: 'confirmed',
        limit: '100',
      });
      const res = await fetch(`/api/bookings?${params.toString()}`, { cache: 'no-store' });
      const data = await res.json();
      if (data.success) {
        setEditBookedByDate((prev) => ({
          ...prev,
          [dateStr]: data.data.bookings || [],
        }));
      }
    } catch (error) {
      console.error(error);
    } finally {
      setEditBookedLoading(false);
    }
  }, []);

  useEffect(() => {
    if (showEditModal && editBookingDate) {
      fetchEditBookedSlots(editBookingDate);
    }
  }, [showEditModal, editBookingDate, fetchEditBookedSlots]);

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
        if (data.data.booking) {
          setSelectedBooking(data.data.booking);
        }
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
  const openAddonsModal = async () => {
    if (!selectedBooking) return;
    setAddonLoungeHours(selectedBooking.loungeHours || '');
    setAddonProducts({});
    setShowAddonsModal(true);
    setLoungeAddonUnavailable(false);

    if (inventoryItems.length === 0) {
      fetch('/api/inventory')
        .then(res => res.json())
        .then(data => {
          if (data.success && data.data.items) {
            setInventoryItems(data.data.items);
          }
        })
        .catch(err => console.error('Failed to fetch inventory:', err));
    }

    if (!selectedBooking.loungeHours || selectedBooking.loungeHours === 0) {
      setCheckingLoungeAddon(true);
      try {
        const dateStr = new Date(selectedBooking.bookingDate).toISOString().split('T')[0];
        const params = new URLSearchParams({
          startDate: dateStr,
          endDate: dateStr,
          bookingStatus: 'confirmed',
          limit: '100',
        });
        const res = await fetch(`/api/bookings?${params.toString()}`, { cache: 'no-store' });
        const data = await res.json();
        if (data.success && data.data.bookings) {
          const hasOtherLounge = data.data.bookings.some((b: any) => 
            b._id !== selectedBooking._id && b.loungeHours > 0
          );
          setLoungeAddonUnavailable(hasOtherLounge);
        }
      } catch (e) {
        console.error('Failed to check lounge availability:', e);
      } finally {
        setCheckingLoungeAddon(false);
      }
    }
  };

  const handleSaveAddons = async () => {
    if (!selectedBooking) return;
    setSavingAddons(true);
    try {
      const payload = {
        loungeHours: addonLoungeHours ? Number(addonLoungeHours) : 0,
        products: Object.entries(addonProducts).map(([itemId, quantity]) => ({ itemId, quantity }))
      };

      const res = await fetch(`/api/bookings/${selectedBooking._id}/addons`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        showToast('Addons updated successfully');
        setShowAddonsModal(false);
        fetchBookings();
        if (selectedBooking) handleRowClick(selectedBooking);
      } else {
        throw new Error(data.message || 'Failed to update addons');
      }
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setSavingAddons(false);
    }
  };
  const exportToExcel = () => {
    if (!bookings.length) return showToast('No bookings to export', 'error');
    
    const exportData = bookings.map(b => {
      const dateStr = getDateStr(String(b.bookingDate));
      return {
        'Booking ID': b._id.substring(b._id.length - 6).toUpperCase(),
        'Date': formatDate(dateStr),
        'Type': b.bookingType === 'bulk' ? 'Bulk Order' : 'Standard',
        'Customer': b.customerName || 'Walk-in',
        'Contact': b.contactNumber || 'N/A',
        'Total Amount': b.expectedAmount,
        'Amount Paid': b.totalPaid || 0,
        'Pending': Math.max(0, b.expectedAmount - (b.totalPaid || 0)),
        'Payment Status': (b.paymentStatus || 'pending').toUpperCase(),
        'Booking Status': (b.bookingStatus || 'confirmed').toUpperCase(),
        'Created By': b.createdBy?.name || 'Unknown',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Bookings');
    XLSX.writeFile(workbook, `Bookings_Export_${new Date().getTime()}.xlsx`);
  };

  const exportToPDF = async () => {
    if (!bookings.length) return showToast('No bookings to export', 'error');
    
    let logoBase64 = '';
    try {
      const img = new window.Image();
      img.src = '/logo.png';
      await new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
      });
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        logoBase64 = canvas.toDataURL('image/png');
      }
    } catch (e) {
      console.warn('Could not load logo for PDF', e);
    }

    const { generateStandardReport } = await import('@/lib/report-generator');

    const formatCurrency = (n: number) => 'Rs.' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n || 0);

    const totalBookings = bookings.length;
    const totalAmount = bookings.reduce((sum, b) => sum + b.expectedAmount, 0);
    const totalPaid = bookings.reduce((sum, b) => sum + (b.totalPaid || 0), 0);

    let reportPeriodStr = 'All Time';
    if (startDate || endDate) {
       reportPeriodStr = `${startDate || 'Start'} to ${endDate || 'End'}`;
    }

    generateStandardReport({
      title: 'Bookings History Export',
      reportPeriod: reportPeriodStr,
      summary: [
        { label: 'Total Bookings', value: totalBookings.toString() },
        { label: 'Total Amount', value: formatCurrency(totalAmount) },
        { label: 'Total Paid', value: formatCurrency(totalPaid) }
      ],
      columns: [
        { header: 'ID', dataKey: 'id', width: 60 },
        { header: 'Date', dataKey: 'date' },
        { header: 'Type', dataKey: 'type' },
        { header: 'Customer', dataKey: 'customer' },
        { header: 'Total', dataKey: 'total', align: 'right' },
        { header: 'Paid', dataKey: 'paid', align: 'right' },
        { header: 'Pending', dataKey: 'pending', align: 'right' },
        { header: 'Status', dataKey: 'status' }
      ],
      data: bookings.map(b => {
        const dateStr = getDateStr(String(b.bookingDate));
        const pending = Math.max(0, b.expectedAmount - (b.totalPaid || 0));
        return {
          id: String(b._id).substring(String(b._id).length - 6).toUpperCase(),
          date: formatDate(dateStr),
          type: b.bookingType === 'bulk' ? 'Bulk' : 'Standard',
          customer: (b.customerName || 'Walk-in').substring(0, 20),
          total: formatCurrency(b.expectedAmount),
          paid: formatCurrency(b.totalPaid || 0),
          pending: formatCurrency(pending),
          status: (b.paymentStatus || 'pending').toUpperCase()
        };
      }),
      filename: `Bookings_Export_${new Date().getTime()}.pdf`,
      logoBase64
    });
  };

  const handleDownloadReceipt = async () => {
    if (!selectedBooking) return;
    try {
      let logoBase64 = '';
      try {
        const img = new window.Image();
        img.src = '/logo.png';
        await new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
        });
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          logoBase64 = canvas.toDataURL('image/png');
        }
      } catch (e) {
        console.warn('Could not load logo for PDF', e);
      }
      generateTaxInvoice(selectedBooking, logoBase64);
    } catch (error) {
      console.error('Failed to generate PDF', error);
      showToast('Failed to download receipt', 'error');
    }
  };

  useEffect(() => {
    if (showEditModal && selectedBooking && editBookingDate) {
      const initialSlots = getInitialSlotsForBooking(selectedBooking, editBookingDate);
      setEditSelectedSlots(initialSlots);
    }
  }, [showEditModal, editBookingDate, selectedBooking]);

  const openEditModal = (booking: Booking) => {
    setEditCustomerName(booking.customerName || '');
    setEditContactNumber(booking.contactNumber || '');
    setEditNotes(booking.notes || '');
    const dateStr = getDateStr(booking.bookingDate);
    setEditBookingDate(dateStr);
    
    // Parse slots
    const initialSlots = getInitialSlotsForBooking(booking, dateStr);
    setEditSelectedSlots(initialSlots);
    setEditUpdateGroup(false);
    setShowEditModal(true);
  };

  const editNewExpectedAmount = useMemo(() => {
    if (!selectedBooking) return 0;
    const initialSlots = getInitialSlotsForBooking(selectedBooking, editBookingDate);
    const initialRanges = mergeSelectedSlots(initialSlots);
    const currentRanges = mergeSelectedSlots(editSelectedSlots);
    const isSameDate = editBookingDate === getDateStr(selectedBooking.bookingDate);
    const slotsChanged = !isSameDate || initialRanges.length !== currentRanges.length || initialRanges.some((r: any, i: number) => r.startTime !== currentRanges[i].startTime || r.endTime !== currentRanges[i].endTime);
    
    if (!slotsChanged) return selectedBooking.expectedAmount;
    
    if (currentRanges.length === 1) {
      const pricingRes = calculateTurfSlotPrice({
        bookingDate: editBookingDate,
        startTime: currentRanges[0].startTime,
        endTime: currentRanges[0].endTime,
        priceType: (selectedBooking as any).priceType || 'normal',
        weekdayRules: pricing.weekdayRules,
        weekendRules: pricing.weekendRules,
        holidays: pricing.holidays,
        weekendDays: pricing.weekendDays,
      });
      return pricingRes.amount;
    }
    return selectedBooking.expectedAmount;
  }, [selectedBooking, editBookingDate, editSelectedSlots, pricing]);

  const handleEditSubmit = async () => {
    if (!selectedBooking) return;

    setSavingEdit(true);
    try {
      const body: any = {
        customerName: editCustomerName,
        contactNumber: editContactNumber,
        notes: editNotes,
        updateGroup: editUpdateGroup,
      };

      const initialSlots = getInitialSlotsForBooking(selectedBooking, editBookingDate);
      const initialRanges = mergeSelectedSlots(initialSlots);
      const currentRanges = mergeSelectedSlots(editSelectedSlots);
      const isSameDate = editBookingDate === getDateStr(selectedBooking.bookingDate);
      const slotsChanged = !isSameDate || initialRanges.length !== currentRanges.length || initialRanges.some((r: any, i: number) => r.startTime !== currentRanges[i].startTime || r.endTime !== currentRanges[i].endTime);

      if (slotsChanged) {
        if (currentRanges.length === 0) {
          throw new Error('Please select at least one time slot');
        }
        if (currentRanges.length > 1) {
          throw new Error('Please select contiguous time slots');
        }
        body.bookingDate = editBookingDate;
        body.startTime = currentRanges[0].startTime;
        body.endTime = currentRanges[0].endTime;
        body.expectedAmount = editNewExpectedAmount;
      }

      const res = await fetch(`/api/bookings/${selectedBooking._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (data.success) {
        showToast('Booking updated successfully');
        setShowEditModal(false);
        fetchBookings(); // Refresh list
        // Update local state details
        if (data.data) {
          setSelectedBooking(data.data);
        } else {
          handleRowClick(selectedBooking);
        }
      } else {
        throw new Error(data.message || 'Failed to update booking');
      }
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  const toggleEditSlot = (slotStart: string) => {
    // Note: We use isSlotBooked logic within the UI component now, but we double-check here
    // we don't strictly need to do manual bounds check if SlotGrid sets 'disabled',
    // but as an extra measure:
    const slotObj = TIME_SLOTS.find(s => s.start === slotStart);
    if (!slotObj) return;
    const isCurrent = getInitialSlotsForBooking(selectedBooking!, editBookingDate).includes(slotStart);
    if (!isCurrent && isSlotBooked(editBookingDate, slotObj.start, slotObj.end, editBookedByDate)) {
      return;
    }
    
    setEditSelectedSlots((prev) =>
      prev.includes(slotStart) ? prev.filter((s) => s !== slotStart) : [...prev, slotStart].sort()
    );
  };

  const isEditSlotBooked = (slotStart: string, slotEnd: string) => {
    return bookings.some((b: any) => {
      const isSameBooking = String(b._id) === String(selectedBooking?._id);
      const isSameBulkGroup = selectedBooking?.bulkId && b.bulkId && String(b.bulkId) === String(selectedBooking.bulkId);
      
      if (isSameBooking || isSameBulkGroup) {
        return false;
      }
      
      if (b.bookingStatus !== 'confirmed') return false;

      if (b.bookingType === 'bulk' && b.slots) {
         return b.slots.some((s: any) => getDateStr(s.bookingDate) === editBookingDate && rangesOverlap(slotStart, slotEnd, s.startTime, s.endTime));
      }

      return (
        getDateStr(b.bookingDate) === editBookingDate &&
        rangesOverlap(slotStart, slotEnd, b.startTime, b.endTime)
      );
    });
  };

  const handleCancelSubmit = async () => {
    if (!selectedBooking) return;

    setCancellingBooking(true);
    try {
      const res = await fetch(`/api/bookings/${selectedBooking._id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cancelReason }),
      });

      const data = await res.json();
      if (data.success) {
        showToast('Booking cancelled successfully');
        setShowCancelModal(false);
        setSelectedBooking(null); // Close details modal
        fetchBookings(); // Refresh list
      } else {
        throw new Error(data.message || 'Failed to cancel booking');
      }
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setCancellingBooking(false);
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
            {canCreateBooking && (
              <button className="pill-toggle" onClick={() => router.push(`/${portalBase}/bookings`)} style={{ padding: '8px 24px', borderRadius: '24px', fontSize: 'var(--text-sm)', fontWeight: 500 }}>
                New Booking
              </button>
            )}
            {canViewPaymentDashboard && (
              <button className="pill-toggle active" style={{ padding: '8px 24px', borderRadius: '24px', fontSize: 'var(--text-sm)', fontWeight: 500 }}>
                Manage Bookings
              </button>
            )}
          </div>
        </div>

        {canExportHistory && (
          <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-4)', flexWrap: 'wrap' }}>
            <button className="btn btn-secondary btn-sm" onClick={exportToPDF} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <FileText size={14} /> Export to PDF
            </button>
            <button className="btn btn-secondary btn-sm" onClick={exportToExcel} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Receipt size={14} /> Export to Excel
            </button>
          </div>
        )}
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
                        <span className="badge badge-neutral" style={{ marginTop: 'var(--space-1)', fontSize: '10px' }}>
                          {b.facility === 'nets_with_machine' ? 'Nets (Machine)' : b.facility === 'nets_without_machine' ? 'Nets (No Machine)' : 'Turf'}
                        </span>
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
                        {canManageBookings && (
                          <button 
                            className="btn btn-primary btn-sm" 
                            onClick={(e) => openPaymentModal(b, e)}
                            disabled={isPaid}
                          >
                            <IndianRupee size={14} /> Pay
                          </button>
                        )}
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

              <h4 style={{ margin: 'var(--space-4) 0 var(--space-2) 0' }}>Bill Breakdown</h4>
              <div className="card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Slot Base Fee</span>
                  <span>{fmt(selectedBooking.expectedAmount - (selectedBooking.loungeAmount || 0) - (selectedBooking.productAmount || 0))}</span>
                </div>
                {(selectedBooking.loungeAmount || 0) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Lounge Area Fee</span>
                    <span>{fmt(selectedBooking.loungeAmount || 0)}</span>
                  </div>
                )}
                {selectedBooking.products && selectedBooking.products.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                      <span>Products ({selectedBooking.products.length})</span>
                      <span>{fmt(selectedBooking.productAmount || 0)}</span>
                    </div>
                    {selectedBooking.products.map((p: any, idx: number) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', paddingLeft: 'var(--space-4)' }}>
                        <span>{p.quantity}x {p.name}</span>
                        <span>{fmt(p.price)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ borderTop: '1px solid var(--border-primary)', marginTop: 'var(--space-2)', paddingTop: 'var(--space-2)', display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                  <span>Total Expected Amount</span>
                  <span>{fmt(selectedBooking.expectedAmount)}</span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', borderBottom: '1px solid var(--border-primary)', paddingBottom: 'var(--space-2)' }}>
                <h4 style={{ margin: 0 }}>Payment Summary</h4>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  {selectedBooking.paymentStatus !== 'paid' && canManageBookings && (
                    <button className="btn btn-secondary btn-sm" onClick={openAddonsModal}>
                      <Plus size={14} /> Add Add-Ons
                    </button>
                  )}
                  {selectedBooking.paymentStatus !== 'paid' && canManageBookings && (
                    <button className="btn btn-primary btn-sm" onClick={(e) => openPaymentModal(selectedBooking, e)}>
                      Record Payment
                    </button>
                  )}
                </div>
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

              {selectedBooking.editHistory && selectedBooking.editHistory.length > 0 && (
                <>
                  <h4 style={{ margin: 'var(--space-6) 0 var(--space-4) 0' }}>Edit History</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                    {selectedBooking.editHistory.map((edit, idx) => {
                      const diff = edit.newExpectedAmount - edit.oldExpectedAmount;
                      return (
                        <div key={idx} className="card" style={{ padding: 'var(--space-3)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                              Edited on {new Date(edit.editedAt).toLocaleString('en-IN')}
                            </span>
                            {diff !== 0 && (
                              <div style={{ textAlign: 'right' }}>
                                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: diff > 0 ? 'var(--status-danger)' : 'var(--status-success)' }}>
                                  Price Adjustment: {diff > 0 ? '+' : ''}{fmt(diff)}
                                </span>
                                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                  Calculation: {fmt(edit.newExpectedAmount)} - {fmt(edit.oldExpectedAmount)}
                                </div>
                              </div>
                            )}
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
                            <div style={{ padding: 'var(--space-2)', background: 'var(--surface-secondary)', borderRadius: 'var(--radius-sm)' }}>
                              <strong style={{ fontSize: 'var(--text-xs)' }}>Old Booking</strong>
                              <div style={{ fontSize: 'var(--text-xs)' }}>{formatDate(getDateStr(edit.oldDate as unknown as string))}</div>
                              <div style={{ fontSize: 'var(--text-xs)' }}>{formatTime(edit.oldStartTime)} - {formatTime(edit.oldEndTime)}</div>
                              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, marginTop: '2px' }}>{fmt(edit.oldExpectedAmount)}</div>
                              {(() => {
                                const b = calculateTurfSlotPrice({
                                  bookingDate: getDateStr(edit.oldDate as unknown as string),
                                  startTime: edit.oldStartTime,
                                  endTime: edit.oldEndTime,
                                  priceType: (selectedBooking as any).priceType || 'normal',
                                  weekdayRules: pricing.weekdayRules,
                                  weekendRules: pricing.weekendRules,
                                  holidays: pricing.holidays,
                                  weekendDays: pricing.weekendDays,
                                });
                                return b.appliedRules.length > 0 ? (
                                  <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '8px' }}>
                                    {b.appliedRules.map((r, i) => (
                                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', background: 'rgba(255,255,255,0.4)', padding: '4px 6px', borderRadius: '4px' }}>
                                        <div style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                                          {formatTime(r.startTime)} - {formatTime(r.endTime)}
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{fmt(r.amount)}</div>
                                          <div style={{ color: 'var(--text-muted)', fontSize: '9px' }}>
                                            {r.minutes / 60} hrs @ {fmt(r.rate)}/hr
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : null;
                              })()}
                            </div>
                            <div style={{ padding: 'var(--space-2)', background: 'var(--accent-primary-soft)', border: '1px solid var(--accent-primary)', borderRadius: 'var(--radius-sm)' }}>
                              <strong style={{ fontSize: 'var(--text-xs)', color: 'var(--accent-primary)' }}>Changed To</strong>
                              <div style={{ fontSize: 'var(--text-xs)' }}>{formatDate(getDateStr(edit.newDate as unknown as string))}</div>
                              <div style={{ fontSize: 'var(--text-xs)' }}>{formatTime(edit.newStartTime)} - {formatTime(edit.newEndTime)}</div>
                              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, marginTop: '2px' }}>{fmt(edit.newExpectedAmount)}</div>
                              {(() => {
                                const b = calculateTurfSlotPrice({
                                  bookingDate: getDateStr(edit.newDate as unknown as string),
                                  startTime: edit.newStartTime,
                                  endTime: edit.newEndTime,
                                  priceType: (selectedBooking as any).priceType || 'normal',
                                  weekdayRules: pricing.weekdayRules,
                                  weekendRules: pricing.weekendRules,
                                  holidays: pricing.holidays,
                                  weekendDays: pricing.weekendDays,
                                });
                                return b.appliedRules.length > 0 ? (
                                  <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '8px' }}>
                                    {b.appliedRules.map((r, i) => (
                                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', background: 'rgba(255,255,255,0.4)', padding: '4px 6px', borderRadius: '4px' }}>
                                        <div style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                                          {formatTime(r.startTime)} - {formatTime(r.endTime)}
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{fmt(r.amount)}</div>
                                          <div style={{ color: 'var(--text-muted)', fontSize: '9px' }}>
                                            {r.minutes / 60} hrs @ {fmt(r.rate)}/hr
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : null;
                              })()}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-start', gap: 'var(--space-3)', width: '100%', marginTop: 'auto', flexWrap: 'wrap' }}>
              {selectedBooking.bookingStatus !== 'cancelled' && canEditBooking && !isSlotInPast(getDateStr(String(selectedBooking.bookingDate)), selectedBooking.endTime) && (
                  <button className="btn btn-primary btn-md" style={{ display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => openEditModal(selectedBooking)}>
                    <Edit size={16} /> Edit Booking
                  </button>
                )}
                {selectedBooking.bookingStatus !== 'cancelled' && canCancelBooking && !isSlotInPast(getDateStr(String(selectedBooking.bookingDate)), selectedBooking.endTime) && (
                  <button className="btn btn-danger btn-md" style={{ display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => { setCancelReason(''); setShowCancelModal(true); }}>
                    <Trash2 size={16} /> Cancel Booking
                  </button>
                )}
                {canExportBill && (
                  <button className="btn btn-secondary btn-md" onClick={handleDownloadReceipt} style={{ marginLeft: 'auto' }}>
                    <FileText size={18} /> Download Bill
                  </button>
                )}
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
              
              <div className="card" style={{ padding: 'var(--space-4)', background: 'var(--surface-secondary)', marginBottom: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                  <span>Slot Base Fee:</span>
                  <span>{fmt(selectedBooking.expectedAmount - (selectedBooking.loungeAmount || 0) - (selectedBooking.productAmount || 0))}</span>
                </div>
                {(selectedBooking.loungeAmount || 0) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                    <span>Lounge Area Fee:</span>
                    <span>{fmt(selectedBooking.loungeAmount || 0)}</span>
                  </div>
                )}
                {selectedBooking.products && selectedBooking.products.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Products ({selectedBooking.products.length}):</span>
                      <span>{fmt(selectedBooking.productAmount || 0)}</span>
                    </div>
                    {selectedBooking.products.map((p: any, idx: number) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', opacity: 0.8, paddingLeft: 'var(--space-4)' }}>
                        <span>{p.quantity}x {p.name}</span>
                        <span>{fmt(p.price)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid var(--border-primary)' }}>
                  <span style={{ color: 'var(--text-primary)' }}>Total Booking Value:</span>
                  <strong style={{ fontSize: '1.1em' }}>{fmt(selectedBooking.expectedAmount)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--status-success)' }}>
                  <span>Discount:</span>
                  <span>-{fmt(discountAmt)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
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

                    <div className="form-grid-2" style={{ gap: 'var(--space-3)' }}>
                      <div className="form-group">
                        <label className={`form-label ${split.paymentMode === 'cash' ? 'required' : ''}`} style={{ fontSize: 'var(--text-xs)' }}>
                          Received By {split.paymentMode !== 'cash' && '(Optional)'}
                        </label>
                        <CustomSelect
                          options={users.map((u: any) => ({ value: u._id, label: getUserLabel(u) }))}
                          value={split.cashReceivedBy}
                          onChange={(v) => updateSplit(index, 'cashReceivedBy', v)}
                        />
                      </div>
                      {split.paymentMode === 'cash' ? (
                        <div className="form-group">
                          <label className="form-label" style={{ fontSize: 'var(--text-xs)' }}>Note (Optional)</label>
                          <input
                            className="form-input form-input-sm"
                            value={split.referenceNote}
                            onChange={(e) => updateSplit(index, 'referenceNote', e.target.value)}
                            placeholder="Details..."
                          />
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

      {/* Edit Booking Modal */}
      {showEditModal && selectedBooking && (
        <div className="modal-backdrop" onClick={() => setShowEditModal(false)}>
          <div className="modal" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Edit Booking</h3>
              <button className="modal-close" onClick={() => setShowEditModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              
              {bookingPayments.length > 0 && (
                <div style={{ display: 'flex', gap: 'var(--space-2)', background: 'var(--surface-secondary)', borderLeft: '4px solid var(--status-info)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)' }}>
                  <AlertCircle size={20} style={{ color: 'var(--status-info)', flexShrink: 0 }} />
                  <span style={{ fontSize: 'var(--text-sm)' }}>
                    <strong>Payments exist:</strong> Total Paid so far is {fmt(selectedBooking.totalPaid)}. Changing slots will adjust the total expected amount.
                  </span>
                </div>
              )}

              <div className="form-grid-2" style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                <div className="form-group">
                  <label className="form-label">Customer Name (Optional)</label>
                  <input
                    className="form-input"
                    value={editCustomerName}
                    onChange={(e) => setEditCustomerName(e.target.value)}
                    placeholder="Walk-in"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Contact Number (Optional)</label>
                  <input
                    className="form-input"
                    value={editContactNumber}
                    onChange={(e) => setEditContactNumber(e.target.value)}
                    placeholder="Contact Number"
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                <label className="form-label">Booking Date</label>
                <CustomDatePicker
                  value={editBookingDate}
                  onChange={setEditBookingDate}
                  minDate={new Date().toISOString().split('T')[0]}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Select Time Slots</span>
                  <span className="badge badge-neutral">{editSelectedSlots.length} selected</span>
                </label>
                
                {editBookedLoading ? (
                  <div className="loading-screen" style={{ minHeight: '120px' }}><div className="spinner spinner-sm" /></div>
                ) : (
                  <div style={{ maxHeight: '240px', overflowY: 'auto', padding: '4px', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)' }}>
                    <SlotGrid
                      date={editBookingDate}
                      selectedSet={new Set(editSelectedSlots)}
                      bookedByDate={editBookedByDate}
                      disabled={false}
                      onToggle={(slot) => toggleEditSlot(slot.start)}
                      currentBookingSlots={new Set(getInitialSlotsForBooking(selectedBooking, editBookingDate))}
                    />
                  </div>
                )}
                
                {editNewExpectedAmount !== selectedBooking.expectedAmount || editBookingDate !== getDateStr(selectedBooking.bookingDate) ? (
                  <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-3)', background: 'var(--surface-secondary)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div style={{ padding: '8px', background: 'var(--surface-primary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-primary)' }}>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 600 }}>Old Booking</div>
                        <div style={{ fontSize: 'var(--text-sm)' }}><strong>Date:</strong> {formatDate(getDateStr(selectedBooking.bookingDate))}</div>
                        <div style={{ fontSize: 'var(--text-sm)' }}><strong>Time:</strong> {getInitialSlotsForBooking(selectedBooking, getDateStr(selectedBooking.bookingDate)).length > 0 ? `${formatTime(getInitialSlotsForBooking(selectedBooking, getDateStr(selectedBooking.bookingDate))[0])} onwards` : 'N/A'}</div>
                        <div style={{ fontSize: 'var(--text-sm)' }}><strong>Amount:</strong> {fmt(selectedBooking.expectedAmount)}</div>
                      </div>
                      <div style={{ padding: '8px', background: 'var(--surface-primary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--primary-light)', position: 'relative' }}>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--primary)', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 600 }}>New Booking</div>
                        <div style={{ fontSize: 'var(--text-sm)' }}><strong>Date:</strong> {formatDate(editBookingDate)}</div>
                        <div style={{ fontSize: 'var(--text-sm)' }}><strong>Time:</strong> {editSelectedSlots.length > 0 ? `${formatTime(editSelectedSlots[0])} onwards` : 'N/A'}</div>
                        <div style={{ fontSize: 'var(--text-sm)' }}><strong>Amount:</strong> {fmt(editNewExpectedAmount)}</div>
                      </div>
                    </div>
                    
                    {bookingPayments.length > 0 && (
                      <div style={{ paddingTop: '12px', borderTop: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Total Paid</div>
                          <strong style={{ color: 'var(--status-success)' }}>{fmt(selectedBooking.totalPaid)}</strong>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          {editNewExpectedAmount > selectedBooking.totalPaid ? (
                            <>
                              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Additional Payment Required</div>
                              <strong style={{ color: 'var(--status-danger)', fontSize: '1.2em' }}>{fmt(editNewExpectedAmount - selectedBooking.totalPaid)}</strong>
                            </>
                          ) : editNewExpectedAmount < selectedBooking.totalPaid ? (
                            <>
                              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Refund / Difference</div>
                              <strong style={{ color: 'var(--status-warning)', fontSize: '1.2em' }}>{fmt(selectedBooking.totalPaid - editNewExpectedAmount)}</strong>
                            </>
                          ) : (
                            <>
                              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Balance Settled</div>
                              <strong style={{ color: 'var(--status-success)', fontSize: '1.2em' }}>{fmt(0)}</strong>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>

              <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                <label className="form-label">Notes</label>
                <textarea
                  className="form-input form-textarea"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Optional notes"
                  rows={3}
                />
              </div>

              {selectedBooking.bulkId && (
                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: 'var(--space-4)' }}>
                  <input
                    type="checkbox"
                    id="editUpdateGroup"
                    checked={editUpdateGroup}
                    onChange={(e) => setEditUpdateGroup(e.target.checked)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <label htmlFor="editUpdateGroup" style={{ fontSize: 'var(--text-sm)', cursor: 'pointer', fontWeight: 500 }}>
                    Apply name, contact number, and notes updates to all bookings in this bulk group
                  </label>
                </div>
              )}

            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
              <button className="btn btn-secondary btn-md" onClick={() => setShowEditModal(false)}>Cancel</button>
              <button 
                className={`btn btn-primary btn-md ${savingEdit ? 'btn-loading' : ''}`} 
                onClick={handleEditSubmit}
                disabled={savingEdit}
              >
                <CheckCircle size={18} /> Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Booking Modal */}
      {showCancelModal && selectedBooking && (
        <div className="modal-backdrop" onClick={() => setShowCancelModal(false)}>
          <div className="modal" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ borderBottomColor: 'var(--status-danger)' }}>
              <h3 className="modal-title" style={{ color: 'var(--status-danger)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={20} /> Cancel Booking
              </h3>
              <button className="modal-close" onClick={() => setShowCancelModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: 'var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                Are you sure you want to cancel the booking for <strong>{selectedBooking.customerName || 'Walk-in'}</strong>? This action will set the booking status to cancelled.
              </p>

              {selectedBooking.bulkId && (
                <div style={{ display: 'flex', gap: 'var(--space-2)', background: 'var(--surface-secondary)', borderLeft: '4px solid var(--status-danger)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)' }}>
                  <AlertCircle size={20} style={{ color: 'var(--status-danger)', flexShrink: 0 }} />
                  <span style={{ fontSize: 'var(--text-sm)' }}>
                    <strong>Warning:</strong> This is a bulk booking. Cancelling will cancel <strong>all bookings</strong> associated with this bulk group.
                  </span>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Reason for Cancellation (Optional)</label>
                <textarea
                  className="form-input form-textarea"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g., Customer requested change, duplicate booking, etc."
                  rows={3}
                />
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
              <button className="btn btn-secondary btn-md" onClick={() => setShowCancelModal(false)}>Go Back</button>
              <button 
                className={`btn btn-danger btn-md ${cancellingBooking ? 'btn-loading' : ''}`} 
                onClick={handleCancelSubmit}
                disabled={cancellingBooking}
              >
                <Trash2 size={18} /> Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Addons Modal */}
      {showAddonsModal && selectedBooking && (
        <div className="modal-backdrop" onClick={() => setShowAddonsModal(false)}>
          <div className="modal" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Add Additional Items</h3>
              <button className="modal-close" onClick={() => setShowAddonsModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              <div className="form-group" style={{ marginBottom: 'var(--space-6)' }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: (checkingLoungeAddon || loungeAddonUnavailable) ? 'not-allowed' : 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={Number(addonLoungeHours) > 0}
                    disabled={checkingLoungeAddon || loungeAddonUnavailable}
                    onChange={(e) => setAddonLoungeHours(e.target.checked ? 1 : '')}
                    style={{ width: '18px', height: '18px', cursor: (checkingLoungeAddon || loungeAddonUnavailable) ? 'not-allowed' : 'pointer' }}
                  />
                  <span>
                    <strong>Include Lounge Area</strong>
                    <span style={{ display: 'block', fontSize: 'var(--text-xs)', color: loungeAddonUnavailable ? 'var(--status-danger)' : 'var(--text-secondary)', fontWeight: 'normal' }}>
                      {checkingLoungeAddon 
                        ? 'Checking lounge availability...'
                        : loungeAddonUnavailable
                          ? 'Lounge is already reserved by another team on this day'
                          : 'Daily Flat Rate Add-On'
                      }
                    </span>
                  </span>
                </label>
              </div>

              {inventoryItems.length > 0 && (
                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Plus size={16} /> Add Inventory Items (Sales)
                  </label>
                  <div style={{ display: 'grid', gap: 'var(--space-3)', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
                    {inventoryItems.map(item => (
                      <div key={item._id} style={{ padding: 'var(--space-3)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                          <strong style={{ fontSize: 'var(--text-sm)' }}>{item.name}</strong>
                          <span style={{ fontSize: 'var(--text-sm)' }}>₹{item.unitPrice}</span>
                        </div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginBottom: 'var(--space-3)' }}>
                          Stock: {item.currentStock} {item.unit}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            disabled={!addonProducts[item._id]}
                            onClick={() => setAddonProducts(prev => ({ ...prev, [item._id]: (prev[item._id] || 0) - 1 }))}
                            style={{ padding: '4px' }}
                          >
                            <Minus size={14} />
                          </button>
                          <span style={{ flex: 1, textAlign: 'center', fontWeight: 600 }}>{addonProducts[item._id] || 0}</span>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            disabled={(addonProducts[item._id] || 0) >= item.currentStock}
                            onClick={() => setAddonProducts(prev => ({ ...prev, [item._id]: (prev[item._id] || 0) + 1 }))}
                            style={{ padding: '4px' }}
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
              <button className="btn btn-secondary btn-md" onClick={() => setShowAddonsModal(false)}>Cancel</button>
              <button 
                className={`btn btn-primary btn-md ${savingAddons ? 'btn-loading' : ''}`} 
                onClick={handleSaveAddons}
                disabled={savingAddons || (addonLoungeHours === (selectedBooking.loungeHours || '') && !Object.values(addonProducts).some(qty => qty > 0))}
              >
                <CheckCircle size={18} /> Apply Addons
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
