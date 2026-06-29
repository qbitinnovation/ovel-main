import { type NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import dbConnect from '@/lib/db';
import Booking from '@/models/Booking';
import PaymentEntry from '@/models/PaymentEntry';
import AccountTransaction from '@/models/AccountTransaction';
import Notification from '@/models/Notification';
import { auditAction } from '@/lib/audit';
import { successResponse, errorResponse, getRequestMeta } from '@/lib/utils';
import { checkPermission } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('Unauthorized', 401);

    const permission = await checkPermission(session.user.id, 'bookings', 'add_payment');
    if (!permission.allowed) return errorResponse('Forbidden', 403);

    const body = await request.json();
    const {
      bookingIds,
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

    if (!bookingIds || !Array.isArray(bookingIds) || bookingIds.length === 0) {
      return errorResponse('No bookings selected for payment');
    }
    if (!paymentDate) return errorResponse('Payment date is required');

    let finalSplits = splits;
    let finalDiscountAmount = Number(discountAmount) || 0;
    let finalDiscountPercentage = Number(discountPercentage) || 0;

    if (!finalSplits || finalSplits.length === 0) {
      finalSplits = [{
        amount: Number(amountPaid) || 0,
        paymentMode: paymentMode || 'bank_transfer',
        referenceNumber: referenceNumber?.trim() || '',
        cashReceivedBy: paymentMode === 'cash' ? cashReceivedBy : '',
        referenceNote: referenceNote || '',
      }];
    }

    const totalPaidAmount = finalSplits.reduce((sum: number, s: any) => sum + Number(s.amount), 0);

    await dbConnect();

    // Fetch all bookings
    const bookings = await Booking.find({ _id: { $in: bookingIds }, bookingStatus: 'confirmed' }).sort({ bookingDate: 1 });
    if (bookings.length === 0) return errorResponse('No valid confirmed bookings found', 404);

    const totalExpectedGroup = bookings.reduce((sum, b) => sum + b.expectedAmount, 0);
    const pct = finalDiscountPercentage || (totalExpectedGroup > 0 ? (finalDiscountAmount / totalExpectedGroup) * 100 : 0);

    // Distribute discount
    for (const b of bookings) {
      b.discountPercentage = pct;
      b.discountAmount = Math.round(b.expectedAmount * (pct / 100));
    }

    // Distribute total payment across bookings
    let remainingPayment = totalPaidAmount;
    for (let i = 0; i < bookings.length; i++) {
      const b = bookings[i];
      const needed = Math.max(0, b.expectedAmount - b.discountAmount);
      const isLast = i === bookings.length - 1;
      const applyAmount = isLast ? remainingPayment : Math.min(remainingPayment, needed);

      b.totalPaid = applyAmount;
      b.paymentStatus = b.totalPaid === 0 ? 'pending' : b.totalPaid >= b.expectedAmount - b.discountAmount ? 'paid' : 'partial';
      await b.save();
      remainingPayment -= applyAmount;
    }

    const validBookingIds = bookings.map(b => b._id);
    
    // Delete existing payment entries for these bookings
    await PaymentEntry.deleteMany({ bookingId: { $in: validBookingIds } });

    // Create a PaymentEntry for the first booking to maintain reference
    const firstSplit = finalSplits[0] || {};
    const payment = await PaymentEntry.create({
      bookingId: bookings[0]._id,
      amountPaid: totalPaidAmount,
      paymentMode: finalSplits.length === 1 ? firstSplit.paymentMode : 'split',
      paymentDate: new Date(paymentDate),
      referenceNumber: firstSplit.referenceNumber || '',
      cashReceivedBy: firstSplit.cashReceivedBy || '',
      referenceNote: firstSplit.referenceNote || `Bulk payment for ${bookings.length} bookings`,
      discountAmount: finalDiscountAmount,
      discountPercentage: finalDiscountPercentage,
      splits: finalSplits,
      createdBy: session.user.id,
    });

    // Handle AccountTransactions (SINGLE consolidated transaction per split)
    await AccountTransaction.deleteMany({ bookingId: { $in: validBookingIds } });
    const txns = finalSplits.map((split: any) => ({
      type: 'income',
      source: 'booking',
      amount: split.amount,
      paymentMode: split.paymentMode,
      customerName: bookings[0].customerName || '',
      customerContact: bookings[0].contactNumber || '',
      summary: `Bulk Booking payment for ${bookings.length} bookings (Customer: ${bookings[0].customerName || 'Walk-in'})`,
      referenceNumber: split.referenceNumber || '',
      date: new Date(paymentDate),
      createdBy: session.user.id,
      receivedBy: split.cashReceivedBy || undefined,
      bookingId: bookings[0]._id, // Attach to first one
    }));
    await AccountTransaction.insertMany(txns);
    
    for (const txn of txns) {
      if (txn.receivedBy) {
        await Notification.create({
          userId: txn.receivedBy,
          type: 'cash_assignment',
          title: 'Cash Assigned',
          message: `You have been assigned as the receiver for a cash payment of ₹${txn.amount}.`,
          moduleKey: 'bookings',
          recordId: bookings[0]._id,
        });
      }
    }

    const meta = getRequestMeta(request.headers);
    const modesDesc = finalSplits.map((s: any) => `${s.amount} via ${s.paymentMode}`).join(', ');
    await auditAction({
      userId: session.user.id,
      userName: session.user.name || '',
      userType: session.user.userType,
      action: 'add_payment',
      module: 'bookings',
      recordId: bookings[0]._id,
      description: `Recorded BULK payment ₹${totalPaidAmount} (Discount: ₹${finalDiscountAmount}) via [${modesDesc}] for ${bookings.length} bookings.`,
      newValue: { amountPaid: totalPaidAmount, discountAmount: finalDiscountAmount, splits: finalSplits },
      ...meta,
    }, request.headers);

    return successResponse(
      { payment, totalPaid: totalPaidAmount },
      'Bulk payment recorded successfully',
      201
    );
  } catch (error) {
    console.error('POST /api/bookings/bulk-payment error:', error);
    return errorResponse('Failed to record bulk payment', 500);
  }
}
