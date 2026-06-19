import { type NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import dbConnect from '@/lib/db';
import Booking from '@/models/Booking';
import PaymentEntry from '@/models/PaymentEntry';
import { auditAction } from '@/lib/audit';
import { successResponse, errorResponse, getRequestMeta } from '@/lib/utils';
import { USER_TYPES } from '@/lib/constants';

export const dynamic = 'force-dynamic';

// PUT — Edit a payment entry (SuperAdmin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('Unauthorized', 401);

    // Only SuperAdmin can edit payment entries
    if (session.user.userType !== USER_TYPES.SUPERADMIN) {
      return errorResponse('Only SuperAdmin can edit payment entries', 403);
    }

    const { paymentId } = await params;
    const body = await request.json();
    const { amountPaid, paymentMode, paymentDate, referenceNumber, cashReceivedBy, referenceNote } = body;

    await dbConnect();

    const payment = await PaymentEntry.findById(paymentId);
    if (!payment) return errorResponse('Payment entry not found', 404);

    // Store old values for audit trail
    const oldValue = {
      amountPaid: payment.amountPaid,
      paymentMode: payment.paymentMode,
      paymentDate: payment.paymentDate,
      referenceNumber: payment.referenceNumber,
      cashReceivedBy: payment.cashReceivedBy,
      referenceNote: payment.referenceNote,
    };

    // Validate and update fields
    if (amountPaid !== undefined) {
      if (amountPaid <= 0) return errorResponse('Amount paid must be greater than 0');
      payment.amountPaid = Number(amountPaid);
    }
    if (paymentMode !== undefined) {
      if (!['bank_transfer', 'cash', 'upi', 'card', 'split'].includes(paymentMode)) {
        return errorResponse('Payment mode must be bank_transfer, cash, upi, card, or split');
      }
      payment.paymentMode = paymentMode as any;
    }
    if (paymentDate !== undefined) {
      payment.paymentDate = new Date(paymentDate);
    }
    if (referenceNumber !== undefined) {
      payment.referenceNumber = referenceNumber.trim();
    }

    // Handle cash-specific fields
    const finalMode = paymentMode || payment.paymentMode;
    if (finalMode === 'cash') {
      if (cashReceivedBy !== undefined) {
        if (!['turf_staff', 'turf_owner', 'arjo'].includes(cashReceivedBy)) {
          return errorResponse('Invalid Cash Received By value');
        }
        payment.cashReceivedBy = cashReceivedBy;
      }
      if (!payment.cashReceivedBy) {
        return errorResponse('Cash Received By is required for cash payments');
      }
    } else {
      payment.cashReceivedBy = '';
    }

    if (referenceNote !== undefined) {
      payment.referenceNote = referenceNote;
    }

    await payment.save();

    // Recalculate parent booking totals
    const booking = await Booking.findById(payment.bookingId);
    if (booking && booking.bookingStatus !== 'cancelled') {
      const allPayments = await PaymentEntry.find({ bookingId: booking._id });
      const totalPaid = allPayments.reduce((sum, p) => sum + p.amountPaid, 0);

      booking.totalPaid = totalPaid;
      const finalPayable = booking.expectedAmount - (booking.discountAmount || 0);
      if (totalPaid === 0) {
        booking.paymentStatus = 'pending';
      } else if (totalPaid >= finalPayable) {
        booking.paymentStatus = 'paid';
      } else {
        booking.paymentStatus = 'partial';
      }
      await booking.save();
    }

    const newValue = {
      amountPaid: payment.amountPaid,
      paymentMode: payment.paymentMode,
      paymentDate: payment.paymentDate,
      referenceNumber: payment.referenceNumber,
      cashReceivedBy: payment.cashReceivedBy,
      referenceNote: payment.referenceNote,
    };

    const meta = getRequestMeta(request.headers);
    await auditAction({
      userId: session.user.id,
      userName: session.user.name || '',
      userType: session.user.userType,
      action: 'edit_payment_entry',
      module: 'bookings',
      recordId: payment._id,
      description: `SuperAdmin edited payment entry. Old amount: ₹${oldValue.amountPaid}, New amount: ₹${payment.amountPaid}`,
      oldValue,
      newValue,
      ...meta,
    }, request.headers);

    return successResponse(payment, 'Payment entry updated successfully');
  } catch (error) {
    console.error('PUT /api/bookings/payments/[paymentId] error:', error);
    return errorResponse('Failed to update payment entry', 500);
  }
}
