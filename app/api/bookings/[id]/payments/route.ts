import { type NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import dbConnect from '@/lib/db';
import Booking from '@/models/Booking';
import PaymentEntry from '@/models/PaymentEntry';
import { auditAction } from '@/lib/audit';
import { successResponse, errorResponse, getRequestMeta } from '@/lib/utils';
import { createDevId, devUserRef, getDevStore, isDevFallbackEnabled, type DevPayment } from '@/lib/dev-store';

export const dynamic = 'force-dynamic';

// GET all payments for a booking
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('Unauthorized', 401);

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
      return successResponse({ payments, booking: { expectedAmount: booking.expectedAmount, totalPaid: booking.totalPaid } });
    }

    const booking = await Booking.findById(id);
    if (!booking) return errorResponse('Booking not found', 404);

    const payments = await PaymentEntry.find({ bookingId: id })
      .populate('createdBy', 'name')
      .sort({ paymentDate: -1 });

    return successResponse({ payments, booking: { expectedAmount: booking.expectedAmount, totalPaid: booking.totalPaid } });
  } catch (error) {
    console.error('GET /api/bookings/[id]/payments error:', error);
    return errorResponse('Failed to fetch payments', 500);
  }
}

// POST — Add a new payment entry
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('Unauthorized', 401);

    const { id } = await params;
    const body = await request.json();
    const { amountPaid, paymentMode, paymentDate, referenceNumber, cashReceivedBy, referenceNote } = body;

    // Validate required fields
    if (!amountPaid || amountPaid <= 0) return errorResponse('Amount paid must be greater than 0');
    if (!paymentMode) return errorResponse('Payment mode is required');
    if (!['bank_transfer', 'cash'].includes(paymentMode)) {
      return errorResponse('Payment mode must be bank_transfer or cash');
    }
    if (!paymentDate) return errorResponse('Payment date is required');

    // Cash-specific validation
    if (paymentMode === 'cash') {
      if (!cashReceivedBy) {
        return errorResponse('Cash Received By is required for cash payments');
      }
      if (!['turf_staff', 'turf_owner', 'arjo'].includes(cashReceivedBy)) {
        return errorResponse('Invalid Cash Received By value');
      }
    }

    let useDevStore = false;
    try {
      await dbConnect();
    } catch (error) {
      if (!isDevFallbackEnabled()) throw error;
      useDevStore = true;
    }

    if (useDevStore) {
      const store = getDevStore();
      const booking = store.bookings.find((entry) => entry._id === id);
      if (!booking) return errorResponse('Booking not found', 404);
      if (booking.bookingStatus === 'cancelled') return errorResponse('Cannot add payment to a cancelled booking');
      const now = new Date().toISOString();
      const payment: DevPayment = {
        _id: createDevId('payment'),
        bookingId: id,
        amountPaid: Number(amountPaid),
        paymentMode,
        paymentDate: new Date(paymentDate).toISOString(),
        referenceNumber: referenceNumber?.trim() || '',
        cashReceivedBy: paymentMode === 'cash' ? cashReceivedBy : '',
        referenceNote: referenceNote || '',
        createdBy: session.user.id,
        createdAt: now,
        updatedAt: now,
      };
      store.payments.unshift(payment);
      const totalPaid = store.payments.filter((entry) => entry.bookingId === id).reduce((sum, entry) => sum + entry.amountPaid, 0);
      booking.totalPaid = totalPaid;
      booking.paymentStatus = totalPaid === 0 ? 'pending' : totalPaid >= booking.expectedAmount ? 'paid' : 'partial';
      booking.updatedAt = now;
      return successResponse({ payment, booking: { totalPaid: booking.totalPaid, paymentStatus: booking.paymentStatus } }, 'Payment recorded successfully', 201);
    }

    const booking = await Booking.findById(id);
    if (!booking) return errorResponse('Booking not found', 404);

    if (booking.bookingStatus === 'cancelled') {
      return errorResponse('Cannot add payment to a cancelled booking');
    }

    // Create payment entry
    const payment = await PaymentEntry.create({
      bookingId: id,
      amountPaid: Number(amountPaid),
      paymentMode,
      paymentDate: new Date(paymentDate),
      referenceNumber: referenceNumber?.trim() || '',
      cashReceivedBy: paymentMode === 'cash' ? cashReceivedBy : '',
      referenceNote: referenceNote || '',
      createdBy: session.user.id,
    });

    // Recalculate booking totals
    const allPayments = await PaymentEntry.find({ bookingId: id });
    const totalPaid = allPayments.reduce((sum, p) => sum + p.amountPaid, 0);

    booking.totalPaid = totalPaid;
    if (totalPaid === 0) {
      booking.paymentStatus = 'pending';
    } else if (totalPaid >= booking.expectedAmount) {
      booking.paymentStatus = 'paid';
    } else {
      booking.paymentStatus = 'partial';
    }

    await booking.save();

    const meta = getRequestMeta(request.headers);
    const modeLabel = paymentMode === 'cash' ? `Cash (${cashReceivedBy?.replace('_', ' ')})` : 'Bank Transfer';
    await auditAction({
      userId: session.user.id,
      userName: session.user.name || '',
      userType: session.user.userType,
      action: 'add_payment_entry',
      module: 'bookings',
      recordId: payment._id,
      description: `Added payment ₹${amountPaid} via ${modeLabel} for booking ${booking.bookingDate.toLocaleDateString('en-IN')} ${booking.startTime}-${booking.endTime}. Total paid: ₹${totalPaid}/${booking.expectedAmount}. Status: ${booking.paymentStatus}`,
      newValue: {
        amountPaid,
        paymentMode,
        cashReceivedBy: cashReceivedBy || null,
        totalPaid,
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
