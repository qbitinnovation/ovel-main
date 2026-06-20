import { type NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import dbConnect from '@/lib/db';
import Booking from '@/models/Booking';
import PaymentEntry from '@/models/PaymentEntry';
import { successResponse, errorResponse } from '@/lib/utils';
import { getDevStore, isDevFallbackEnabled } from '@/lib/dev-store';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('Unauthorized', 401);

    const sp = request.nextUrl.searchParams;
    const startDate = sp.get('startDate');
    const endDate = sp.get('endDate');

    try {
      await dbConnect();
    } catch (error) {
      if (!isDevFallbackEnabled()) throw error;
      return successResponse(getDevBookingDashboard(startDate, endDate));
    }

    // Build booking filter — always exclude cancelled bookings
    const bookingFilter: Record<string, unknown> = {
      bookingStatus: 'confirmed',
    };

    if (startDate || endDate) {
      bookingFilter.bookingDate = {};
      if (startDate) (bookingFilter.bookingDate as Record<string, Date>).$gte = new Date(startDate);
      if (endDate) (bookingFilter.bookingDate as Record<string, Date>).$lte = new Date(endDate);
    }

    // Fetch confirmed bookings for the period
    const bookings = await Booking.find(bookingFilter)
      .populate('createdBy', 'name')
      .sort({ bookingDate: -1, startTime: -1 });

    const bookingIds = bookings.map(b => b._id);

    // Fetch all payments for these bookings
    const allPayments = await PaymentEntry.find({ bookingId: { $in: bookingIds } })
      .populate('createdBy', 'name')
      .sort({ paymentDate: -1 });

    // Summary calculations
    const totalExpected = bookings.reduce((sum, b) => sum + b.expectedAmount, 0);
    const totalReceived = allPayments.reduce((sum, p) => sum + p.amountPaid, 0);
    const pendingAmount = totalExpected - totalReceived;
    const partialPaymentsCount = bookings.filter((booking) => booking.paymentStatus === 'partial').length;

    let bankTransferTotal = 0;
    let cashTotal = 0;
    const cashHoldings: Record<string, { total: number; transactions: unknown[] }> = {
      turf_owner: { total: 0, transactions: [] },
      arjo: { total: 0, transactions: [] },
      turf_staff: { total: 0, transactions: [] },
    };

    for (const payment of allPayments) {
      if (payment.splits && payment.splits.length > 0) {
        for (const s of payment.splits) {
          if (s.paymentMode === 'bank_transfer' || s.paymentMode === 'upi' || s.paymentMode === 'card') {
            bankTransferTotal += s.amount;
          } else if (s.paymentMode === 'cash') {
            cashTotal += s.amount;
            const holder = s.cashReceivedBy;
            if (holder && cashHoldings[holder]) {
              cashHoldings[holder].total += s.amount;
              const parentBooking = bookings.find(b => b._id.toString() === payment.bookingId.toString());
              cashHoldings[holder].transactions.push({
                paymentId: payment._id,
                bookingDate: parentBooking?.bookingDate,
                timeSlot: parentBooking ? (parentBooking.bookingType === 'bulk' ? 'Bulk Booking' : `${parentBooking.startTime} - ${parentBooking.endTime}`) : '',
                customerName: parentBooking?.customerName || 'Anonymous',
                amount: s.amount,
                paymentDate: payment.paymentDate,
                referenceNote: s.referenceNote || payment.referenceNote || '',
              });
            }
          }
        }
      } else {
        // Fallback for older single-mode payment entries
        if (payment.paymentMode === 'bank_transfer' || payment.paymentMode === 'upi' || payment.paymentMode === 'card') {
          bankTransferTotal += payment.amountPaid;
        } else if (payment.paymentMode === 'cash') {
          cashTotal += payment.amountPaid;
          const holder = payment.cashReceivedBy;
          if (holder && cashHoldings[holder]) {
            cashHoldings[holder].total += payment.amountPaid;
            const parentBooking = bookings.find(b => b._id.toString() === payment.bookingId.toString());
            cashHoldings[holder].transactions.push({
              paymentId: payment._id,
              bookingDate: parentBooking?.bookingDate,
              timeSlot: parentBooking ? (parentBooking.bookingType === 'bulk' ? 'Bulk Booking' : `${parentBooking.startTime} - ${parentBooking.endTime}`) : '',
              customerName: parentBooking?.customerName || 'Anonymous',
              amount: payment.amountPaid,
              paymentDate: payment.paymentDate,
              referenceNote: payment.referenceNote || '',
            });
          }
        }
      }
    }

    // Booking-level payment breakdown
    const bookingBreakdown = bookings.map(booking => {
      const bookingPayments = allPayments.filter(
        p => p.bookingId.toString() === booking._id.toString()
      );
      const totalPaidForBooking = bookingPayments.reduce((sum, p) => sum + p.amountPaid, 0);
      const paymentModes = [...new Set(bookingPayments.flatMap(p => p.splits && p.splits.length > 0 ? p.splits.map(s => s.paymentMode) : [p.paymentMode]))];

      return {
        _id: booking._id,
        bookingType: booking.bookingType,
        bookingDate: booking.bookingDate,
        startTime: booking.startTime,
        endTime: booking.endTime,
        slotsCount: booking.slots?.length || 0,
        customerName: booking.customerName || 'Anonymous',
        expectedAmount: booking.expectedAmount,
        totalPaid: totalPaidForBooking,
        remainingBalance: Math.max(0, booking.expectedAmount - totalPaidForBooking),
        paymentModes,
        paymentStatus: booking.paymentStatus,
        payments: bookingPayments,
      };
    });

    return successResponse({
      summary: {
        totalExpected,
        totalReceived,
        pendingAmount: Math.max(0, pendingAmount),
        bankTransferTotal,
        cashTotal,
        partialPaymentsCount,
      },
      cashHoldings,
      bookingBreakdown,
    });
  } catch (error) {
    console.error('GET /api/bookings/dashboard error:', error);
    return errorResponse('Failed to fetch dashboard data', 500);
  }
}

function getDevBookingDashboard(startDate: string | null, endDate: string | null) {
  const store = getDevStore();
  let bookings = store.bookings.filter((booking) => booking.bookingStatus === 'confirmed');

  if (startDate) bookings = bookings.filter((booking) => new Date(booking.bookingDate) >= new Date(startDate));
  if (endDate) bookings = bookings.filter((booking) => new Date(booking.bookingDate) <= new Date(endDate));

  bookings = bookings
    .slice()
    .sort((a, b) => new Date(b.bookingDate).getTime() - new Date(a.bookingDate).getTime() || b.startTime.localeCompare(a.startTime));

  const bookingIds = new Set(bookings.map((booking) => booking._id));
  const allPayments = store.payments
    .filter((payment) => bookingIds.has(payment.bookingId))
    .slice()
    .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime());

  const totalExpected = bookings.reduce((sum, booking) => sum + booking.expectedAmount, 0);
  const totalReceived = allPayments.reduce((sum, payment) => sum + payment.amountPaid, 0);
  const pendingAmount = totalExpected - totalReceived;
  const partialPaymentsCount = bookings.filter((booking) => booking.paymentStatus === 'partial').length;
  let bankTransferTotal = 0;
  let cashTotal = 0;
  const cashHoldings: Record<string, { total: number; transactions: unknown[] }> = {
    turf_owner: { total: 0, transactions: [] },
    arjo: { total: 0, transactions: [] },
    turf_staff: { total: 0, transactions: [] },
  };

  for (const payment of allPayments) {
    if (payment.splits && payment.splits.length > 0) {
      for (const s of payment.splits) {
        if (s.paymentMode === 'bank_transfer' || s.paymentMode === 'upi' || s.paymentMode === 'card') {
          bankTransferTotal += s.amount;
        } else if (s.paymentMode === 'cash') {
          cashTotal += s.amount;
          const holder = s.cashReceivedBy;
          if (holder && cashHoldings[holder]) {
            cashHoldings[holder].total += s.amount;
            const parentBooking = bookings.find((b) => b._id === payment.bookingId);
            cashHoldings[holder].transactions.push({
              paymentId: payment._id,
              bookingDate: parentBooking?.bookingDate,
              timeSlot: parentBooking ? (parentBooking.bulkId ? 'Bulk Booking' : `${parentBooking.startTime} - ${parentBooking.endTime}`) : '',
              customerName: parentBooking?.customerName || 'Anonymous',
              amount: s.amount,
              paymentDate: payment.paymentDate,
              referenceNote: s.referenceNote || payment.referenceNote || '',
            });
          }
        }
      }
    } else {
      if (payment.paymentMode === 'bank_transfer' || payment.paymentMode === 'upi' || payment.paymentMode === 'card') {
        bankTransferTotal += payment.amountPaid;
      } else if (payment.paymentMode === 'cash') {
        cashTotal += payment.amountPaid;
        const holder = payment.cashReceivedBy;
        if (holder && cashHoldings[holder]) {
          cashHoldings[holder].total += payment.amountPaid;
          const parentBooking = bookings.find((b) => b._id === payment.bookingId);
          cashHoldings[holder].transactions.push({
            paymentId: payment._id,
            bookingDate: parentBooking?.bookingDate,
            timeSlot: parentBooking ? (parentBooking.bulkId ? 'Bulk Booking' : `${parentBooking.startTime} - ${parentBooking.endTime}`) : '',
            customerName: parentBooking?.customerName || 'Anonymous',
            amount: payment.amountPaid,
            paymentDate: payment.paymentDate,
            referenceNote: payment.referenceNote || '',
          });
        }
      }
    }
  }

  const bookingBreakdown = bookings.map((booking) => {
    const bookingPayments = allPayments.filter((payment) => payment.bookingId === booking._id);
    const totalPaidForBooking = bookingPayments.reduce((sum, payment) => sum + payment.amountPaid, 0);
    const paymentModes = [...new Set(bookingPayments.flatMap(p => p.splits && p.splits.length > 0 ? p.splits.map(s => s.paymentMode) : [p.paymentMode]))];

    return {
      _id: booking._id,
      bookingType: booking.bulkId ? 'bulk' : 'standard',
      bookingDate: booking.bookingDate,
      startTime: booking.startTime,
      endTime: booking.endTime,
      slotsCount: (booking as any).slots?.length || 0,
      customerName: booking.customerName || 'Anonymous',
      expectedAmount: booking.expectedAmount,
      totalPaid: totalPaidForBooking,
      remainingBalance: Math.max(0, booking.expectedAmount - totalPaidForBooking),
      paymentModes,
      paymentStatus: booking.paymentStatus,
      payments: bookingPayments,
    };
  });

  return {
    summary: {
      totalExpected,
      totalReceived,
      pendingAmount: Math.max(0, pendingAmount),
      bankTransferTotal,
      cashTotal,
      partialPaymentsCount,
    },
    cashHoldings,
    bookingBreakdown,
  };
}
