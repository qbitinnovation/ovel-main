import { type NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import dbConnect from '@/lib/db';
import Booking from '@/models/Booking';
import PaymentEntry from '@/models/PaymentEntry';
import AccountTransaction from '@/models/AccountTransaction';
import { auditAction } from '@/lib/audit';
import { successResponse, errorResponse, getRequestMeta } from '@/lib/utils';
import { createDevId, devUserRef, getDevStore, isDevFallbackEnabled, type DevPayment } from '@/lib/dev-store';
import { checkPermission } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

// GET all payments for a booking
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('Unauthorized', 401);

    const permission = await checkPermission(session.user.id, 'bookings', 'view_payment_dashboard');
    if (!permission.allowed) return errorResponse('Forbidden', 403);

    const { id } = await params;
    try {
      await dbConnect();
    } catch (error) {
      if (!isDevFallbackEnabled()) throw error;
      const store = getDevStore();
      const booking = store.bookings.find((entry) => entry._id === id);
      if (!booking) return errorResponse('Booking not found', 404);
      const payments = store.payments
        .filter((payment) => payment.bookingId === id)
        .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())
        .map((payment) => ({ ...payment, createdBy: devUserRef(payment.createdBy) }));
      return successResponse({
        payments,
        booking: {
          expectedAmount: booking.expectedAmount,
          totalPaid: booking.totalPaid,
          discountAmount: booking.discountAmount || 0,
          discountPercentage: booking.discountPercentage || 0,
        }
      });
    }

    const booking = await Booking.findById(id);
    if (!booking) return errorResponse('Booking not found', 404);

    const payments = await PaymentEntry.find({ bookingId: id })
      .populate('createdBy', 'name')
      .sort({ paymentDate: -1 });

    return successResponse({
      payments,
      booking: {
        expectedAmount: booking.expectedAmount,
        totalPaid: booking.totalPaid,
        discountAmount: booking.discountAmount || 0,
        discountPercentage: booking.discountPercentage || 0,
      }
    });
  } catch (error) {
    console.error('GET /api/bookings/[id]/payments error:', error);
    return errorResponse('Failed to fetch payments', 500);
  }
}

// POST — Add or update a payment entry (including discount and splits)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('Unauthorized', 401);

    const permission = await checkPermission(session.user.id, 'bookings', 'add_payment');
    if (!permission.allowed) return errorResponse('Forbidden', 403);

    const { id } = await params;
    const body = await request.json();
    const {
      amountPaid,
      paymentMode,
      paymentDate,
      referenceNumber,
      cashReceivedBy,
      referenceNote,
      discountAmount,
      discountPercentage,
      splits,
    } = body;

    if (!paymentDate) return errorResponse('Payment date is required');

    let finalSplits = splits;
    let finalDiscountAmount = Number(discountAmount) || 0;
    let finalDiscountPercentage = Number(discountPercentage) || 0;

    // Fallback if splits array is not provided (backwards compatibility)
    if (!finalSplits || finalSplits.length === 0) {
      finalSplits = [{
        amount: Number(amountPaid) || 0,
        paymentMode: paymentMode || 'bank_transfer',
        referenceNumber: referenceNumber?.trim() || '',
        cashReceivedBy: paymentMode === 'cash' ? cashReceivedBy : '',
        referenceNote: referenceNote || '',
      }];
    }

    // Validate splits
    for (const s of finalSplits) {
      if (s.amount < 0) return errorResponse('Split amount cannot be negative');
      if (!['bank_transfer', 'upi', 'card', 'cash'].includes(s.paymentMode)) {
        return errorResponse('Invalid payment mode in splits');
      }
      if (s.paymentMode === 'cash') {
        if (!s.cashReceivedBy) {
          return errorResponse('Cash Received By is required for cash splits');
        }
      }
    }

    const totalPaidAmount = finalSplits.reduce((sum: number, s: any) => sum + Number(s.amount), 0);

    let useDevStore = false;
    try {
      await dbConnect();
    } catch (error) {
      if (!isDevFallbackEnabled()) throw error;
      useDevStore = true;
    }

    if (useDevStore) {
      // Dev store fallback
      const store = getDevStore();
      const booking = store.bookings.find((entry) => entry._id === id);
      if (!booking) return errorResponse('Booking not found', 404);
      if (booking.bookingStatus === 'cancelled') return errorResponse('Cannot add payment to a cancelled booking');

      const now = new Date().toISOString();
      if (booking.bulkId) {
        const groupBookings = store.bookings
          .filter((b) => b.bulkId === booking.bulkId && b.bookingStatus === 'confirmed')
          .sort((a, b) => a.bookingDate.localeCompare(b.bookingDate));

        const totalExpectedGroup = groupBookings.reduce((sum, b) => sum + b.expectedAmount, 0);
        const pct = finalDiscountPercentage || (totalExpectedGroup > 0 ? (finalDiscountAmount / totalExpectedGroup) * 100 : 0);

        groupBookings.forEach(b => {
          b.discountPercentage = pct;
          b.discountAmount = Math.round(b.expectedAmount * (pct / 100));
        });

        let remainingPayment = totalPaidAmount;
        groupBookings.forEach((b, idx) => {
          const needed = Math.max(0, b.expectedAmount - (b.discountAmount || 0));
          const isLast = idx === groupBookings.length - 1;
          const applyAmount = isLast ? remainingPayment : Math.min(remainingPayment, needed);
          b.totalPaid = applyAmount;
          b.paymentStatus = b.totalPaid === 0 ? 'pending' : b.totalPaid >= b.expectedAmount - (b.discountAmount || 0) ? 'paid' : 'partial';
          b.updatedAt = now;
          remainingPayment -= applyAmount;
        });

        // Delete old dev payments for group
        const groupBookingIds = groupBookings.map(gb => gb._id);
        store.payments = store.payments.filter(p => !groupBookingIds.includes(p.bookingId));

        const firstSplit = finalSplits[0] || {};
        const devPayment: DevPayment = {
          _id: createDevId('payment'),
          bookingId: booking._id,
          amountPaid: totalPaidAmount,
          paymentMode: finalSplits.length === 1 ? firstSplit.paymentMode : 'split',
          paymentDate: new Date(paymentDate).toISOString(),
          referenceNumber: firstSplit.referenceNumber || '',
          cashReceivedBy: firstSplit.cashReceivedBy || '',
          referenceNote: firstSplit.referenceNote || '',
          discountAmount: finalDiscountAmount,
          discountPercentage: finalDiscountPercentage,
          splits: finalSplits,
          createdBy: session.user.id,
          createdAt: now,
          updatedAt: now,
        };
        store.payments.unshift(devPayment);

        const devAccountTxn = {
          _id: createDevId('account_txn'),
          type: 'income' as const,
          source: 'booking' as const,
          amount: totalPaidAmount,
          paymentMode: finalSplits.length === 1 ? firstSplit.paymentMode : 'split',
          customerName: booking.customerName || '',
          customerContact: booking.contactNumber || '',
          summary: `Booking payment for Bulk Booking (ID: ${booking.bulkId})`,
          referenceNumber: firstSplit.referenceNumber || '',
          date: new Date(paymentDate).toISOString(),
          createdBy: session.user.id,
          bookingId: booking._id,
          createdAt: now,
          updatedAt: now,
        };
        store.accountTransactions.unshift(devAccountTxn);

        return successResponse({ payments: [devPayment], booking: { bulkId: booking.bulkId, totalPaid: totalPaidAmount } }, 'Payment recorded successfully', 201);
      } else {
        booking.discountAmount = finalDiscountAmount;
        booking.discountPercentage = finalDiscountPercentage;
        booking.totalPaid = totalPaidAmount;
        booking.paymentStatus = totalPaidAmount === 0 ? 'pending' : totalPaidAmount >= booking.expectedAmount - finalDiscountAmount ? 'paid' : 'partial';
        booking.updatedAt = now;

        store.payments = store.payments.filter(p => p.bookingId !== id);
        const firstSplit = finalSplits[0] || {};
        const devPayment: DevPayment = {
          _id: createDevId('payment'),
          bookingId: id,
          amountPaid: totalPaidAmount,
          paymentMode: finalSplits.length === 1 ? firstSplit.paymentMode : 'split',
          paymentDate: new Date(paymentDate).toISOString(),
          referenceNumber: firstSplit.referenceNumber || '',
          cashReceivedBy: firstSplit.cashReceivedBy || '',
          referenceNote: firstSplit.referenceNote || '',
          discountAmount: finalDiscountAmount,
          discountPercentage: finalDiscountPercentage,
          splits: finalSplits,
          createdBy: session.user.id,
          createdAt: now,
          updatedAt: now,
        };
        store.payments.unshift(devPayment);

        const devAccountTxn = {
          _id: createDevId('account_txn'),
          type: 'income' as const,
          source: 'booking' as const,
          amount: totalPaidAmount,
          paymentMode: finalSplits.length === 1 ? firstSplit.paymentMode : 'split',
          customerName: booking.customerName || '',
          customerContact: booking.contactNumber || '',
          summary: `Booking payment for ${booking.bookingDate ? new Date(booking.bookingDate).toLocaleDateString('en-IN') : 'Unknown Date'} ${booking.startTime}-${booking.endTime}`,
          referenceNumber: firstSplit.referenceNumber || '',
          date: new Date(paymentDate).toISOString(),
          createdBy: session.user.id,
          bookingId: booking._id,
          createdAt: now,
          updatedAt: now,
        };
        store.accountTransactions.unshift(devAccountTxn);

        return successResponse({ payment: devPayment, booking: { totalPaid: booking.totalPaid, paymentStatus: booking.paymentStatus } }, 'Payment recorded successfully', 201);
      }
    }

    const booking = await Booking.findById(id);
    if (!booking) return errorResponse('Booking not found', 404);
    if (booking.bookingStatus === 'cancelled') {
      return errorResponse('Cannot add payment to a cancelled booking');
    }

    if (booking.bulkId) {
      const groupBookings = await Booking.find({ bulkId: booking.bulkId, bookingStatus: 'confirmed' })
        .sort({ bookingDate: 1 });

      const totalExpectedGroup = groupBookings.reduce((sum, b) => sum + b.expectedAmount, 0);
      const pct = finalDiscountPercentage || (totalExpectedGroup > 0 ? (finalDiscountAmount / totalExpectedGroup) * 100 : 0);

      // Distribute discount
      for (const b of groupBookings) {
        b.discountPercentage = pct;
        b.discountAmount = Math.round(b.expectedAmount * (pct / 100));
      }

      // Distribute total payment
      let remainingPayment = totalPaidAmount;
      for (let i = 0; i < groupBookings.length; i++) {
        const b = groupBookings[i];
        const needed = Math.max(0, b.expectedAmount - b.discountAmount);
        const isLast = i === groupBookings.length - 1;
        const applyAmount = isLast ? remainingPayment : Math.min(remainingPayment, needed);

        b.totalPaid = applyAmount;
        b.paymentStatus = b.totalPaid === 0 ? 'pending' : b.totalPaid >= b.expectedAmount - b.discountAmount ? 'paid' : 'partial';
        await b.save();
        remainingPayment -= applyAmount;
      }

      // Delete existing payment entries for bulk group (keep only one consolidated record)
      const groupBookingIds = groupBookings.map(gb => gb._id);
      await PaymentEntry.deleteMany({ bookingId: { $in: groupBookingIds } });

      // Create consolidated PaymentEntry linked to the first booking
      const firstSplit = finalSplits[0] || {};
      const payment = await PaymentEntry.create({
        bookingId: booking._id,
        amountPaid: totalPaidAmount,
        paymentMode: finalSplits.length === 1 ? firstSplit.paymentMode : 'split',
        paymentDate: new Date(paymentDate),
        referenceNumber: firstSplit.referenceNumber || '',
        cashReceivedBy: firstSplit.cashReceivedBy || '',
        referenceNote: firstSplit.referenceNote || '',
        discountAmount: finalDiscountAmount,
        discountPercentage: finalDiscountPercentage,
        splits: finalSplits,
        createdBy: session.user.id,
      });

      await AccountTransaction.deleteMany({ bookingId: { $in: groupBookingIds } });
      await AccountTransaction.create({
        type: 'income',
        source: 'booking',
        amount: totalPaidAmount,
        paymentMode: finalSplits.length === 1 ? firstSplit.paymentMode : 'split',
        customerName: booking.customerName || '',
        customerContact: booking.contactNumber || '',
        summary: `Booking payment for Bulk Booking (ID: ${booking.bulkId})`,
        referenceNumber: firstSplit.referenceNumber || '',
        date: new Date(paymentDate),
        createdBy: session.user.id,
        bookingId: booking._id,
      });

      const meta = getRequestMeta(request.headers);
      const modesDesc = finalSplits.map((s: any) => `${s.amount} via ${s.paymentMode}`).join(', ');
      await auditAction({
        userId: session.user.id,
        userName: session.user.name || '',
        userType: session.user.userType,
        action: 'add_payment',
        module: 'bookings',
        recordId: booking._id,
        description: `Recorded bulk payment ₹${totalPaidAmount} (Discount: ₹${finalDiscountAmount}) via [${modesDesc}] for bulk booking (ID: ${booking.bulkId})`,
        newValue: {
          amountPaid: totalPaidAmount,
          discountAmount: finalDiscountAmount,
          splits: finalSplits,
        },
        ...meta,
      }, request.headers);

      return successResponse(
        { payments: [payment], booking: { bulkId: booking.bulkId, totalPaid: totalPaidAmount } },
        'Payment recorded successfully',
        201
      );
    }

    // Single Booking payment logic
    booking.discountAmount = finalDiscountAmount;
    booking.discountPercentage = finalDiscountPercentage;
    booking.totalPaid = totalPaidAmount;
    booking.paymentStatus = totalPaidAmount === 0 ? 'pending' : totalPaidAmount >= booking.expectedAmount - finalDiscountAmount ? 'paid' : 'partial';
    await booking.save();

    // Delete existing payment entries for single booking
    await PaymentEntry.deleteMany({ bookingId: id });

    // Create consolidated payment entry
    const firstSplit = finalSplits[0] || {};
    const payment = await PaymentEntry.create({
      bookingId: id,
      amountPaid: totalPaidAmount,
      paymentMode: finalSplits.length === 1 ? firstSplit.paymentMode : 'split',
      referenceNumber: firstSplit.referenceNumber || '',
      cashReceivedBy: firstSplit.cashReceivedBy || '',
      referenceNote: firstSplit.referenceNote || '',
      paymentDate: new Date(paymentDate),
      discountAmount: finalDiscountAmount,
      discountPercentage: finalDiscountPercentage,
      splits: finalSplits,
      createdBy: session.user.id,
    });

    await AccountTransaction.deleteMany({ bookingId: id });
    await AccountTransaction.create({
      type: 'income',
      source: 'booking',
      amount: totalPaidAmount,
      paymentMode: finalSplits.length === 1 ? firstSplit.paymentMode : 'split',
      customerName: booking.customerName || '',
      customerContact: booking.contactNumber || '',
      summary: `Booking payment for ${booking.bookingDate ? new Date(booking.bookingDate).toLocaleDateString('en-IN') : 'Unknown Date'} ${booking.startTime}-${booking.endTime}`,
      referenceNumber: firstSplit.referenceNumber || '',
      date: new Date(paymentDate),
      createdBy: session.user.id,
      bookingId: id,
    });

    const meta = getRequestMeta(request.headers);
    const modesDesc = finalSplits.map((s: any) => `${s.amount} via ${s.paymentMode}`).join(', ');
    await auditAction({
      userId: session.user.id,
      userName: session.user.name || '',
      userType: session.user.userType,
      action: 'add_payment',
      module: 'bookings',
      recordId: payment._id,
      description: `Recorded payment ₹${totalPaidAmount} (Discount: ₹${finalDiscountAmount}) via [${modesDesc}] for booking ${booking.bookingDate ? new Date(booking.bookingDate).toLocaleDateString('en-IN') : 'Unknown Date'} ${booking.startTime}-${booking.endTime}. Status: ${booking.paymentStatus}`,
      newValue: {
        amountPaid: totalPaidAmount,
        discountAmount: finalDiscountAmount,
        splits: finalSplits,
        totalPaid: totalPaidAmount,
        paymentStatus: booking.paymentStatus,
      },
      ...meta,
    }, request.headers);

    return successResponse(
      { payment, booking: { totalPaid: booking.totalPaid, paymentStatus: booking.paymentStatus } },
      'Payment recorded successfully',
      201
    );
  } catch (error) {
    console.error('POST /api/bookings/[id]/payments error:', error);
    return errorResponse('Failed to record payment', 500);
  }
}
