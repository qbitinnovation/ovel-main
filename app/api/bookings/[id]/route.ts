import { type NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import dbConnect from '@/lib/db';
import Booking from '@/models/Booking';
import PaymentEntry from '@/models/PaymentEntry';
import { auditAction } from '@/lib/audit';
import { successResponse, errorResponse, getRequestMeta } from '@/lib/utils';
import type { Types } from 'mongoose';
import { devUserRef, getDevStore, isDevFallbackEnabled } from '@/lib/dev-store';

export const dynamic = 'force-dynamic';

// GET single booking with its payment entries
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
      const bookingIds = booking.bulkId
        ? store.bookings.filter((b) => b.bulkId === booking.bulkId).map((b) => b._id)
        : [booking._id];
      const payments = store.payments
        .filter((payment) => bookingIds.includes(payment.bookingId))
        .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())
        .map((payment) => ({ ...payment, createdBy: devUserRef(payment.createdBy) }));
      return successResponse({ booking: { ...booking, createdBy: devUserRef(booking.createdBy), cancelledBy: devUserRef(booking.cancelledBy) }, payments });
    }

    const booking = await Booking.findById(id)
      .populate('createdBy', 'name')
      .populate('cancelledBy', 'name');

    if (!booking) return errorResponse('Booking not found', 404);

    const bookingIds = booking.bulkId
      ? (await Booking.find({ bulkId: booking.bulkId })).map((b) => b._id)
      : [booking._id];

    const payments = await PaymentEntry.find({ bookingId: { $in: bookingIds } })
      .populate('createdBy', 'name')
      .sort({ paymentDate: -1 });

    return successResponse({ booking, payments });
  } catch (error) {
    console.error('GET /api/bookings/[id] error:', error);
    return errorResponse('Failed to fetch booking', 500);
  }
}

// PUT — Edit booking details
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('Unauthorized', 401);

    const { checkPermission } = await import('@/lib/permissions');
    const perm = await checkPermission(session.user.id, 'bookings', 'edit_booking');
    if (!perm.allowed) return errorResponse('Forbidden', 403);

    const { id } = await params;
    const body = await request.json();
    const { customerName, contactNumber, notes, bookingDate, startTime, endTime, updateGroup, expectedAmount } = body;

    try {
      await dbConnect();
    } catch (error) {
      if (!isDevFallbackEnabled()) throw error;
      const store = getDevStore();
      const booking = store.bookings.find((entry) => entry._id === id);
      if (!booking) return errorResponse('Booking not found', 404);
      if (booking.bookingStatus === 'cancelled') return errorResponse('Cannot edit a cancelled booking');
      
      const isGroupUpdate = updateGroup && booking.bulkId;
      const bookingsToUpdate = isGroupUpdate
        ? store.bookings.filter((b) => b.bulkId === booking.bulkId)
        : [booking];

      for (const b of bookingsToUpdate) {
        const oldDate = b.bookingDate;
        const oldStartTime = b.startTime;
        const oldEndTime = b.endTime;
        const oldExpectedAmount = b.expectedAmount;

        if (customerName !== undefined) b.customerName = customerName.trim();
        if (contactNumber !== undefined) b.contactNumber = contactNumber.trim();
        if (notes !== undefined) b.notes = notes;
        if (bookingDate !== undefined) b.bookingDate = new Date(bookingDate).toISOString();
        if (startTime !== undefined) b.startTime = startTime;
        if (endTime !== undefined) b.endTime = endTime;
        if (expectedAmount !== undefined) {
          b.expectedAmount = expectedAmount;
          const finalAmt = Math.max(0, b.expectedAmount - (b.discountAmount || 0));
          const refundAmount = b.totalPaid - finalAmt;
          
          if (refundAmount > 0) {
            b.totalPaid = finalAmt;
            b.paymentStatus = 'paid';
            
            const { createDevId } = await import('@/lib/dev-store');
            
            store.payments.unshift({
              _id: createDevId('payment'),
              bookingId: b._id,
              amountPaid: -refundAmount,
              paymentMode: 'bank_transfer',
              paymentDate: new Date().toISOString(),
              referenceNumber: '',
              cashReceivedBy: '',
              referenceNote: 'Automatic adjustment due to booking edit (price decrease)',
              discountAmount: 0,
              discountPercentage: 0,
              splits: [],
              createdBy: session.user.id,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
            
            store.accountTransactions.unshift({
              _id: createDevId('account_txn'),
              type: 'expense',
              source: 'booking',
              amount: refundAmount,
              paymentMode: 'bank_transfer',
              customerName: b.customerName || '',
              customerContact: b.contactNumber || '',
              summary: `Booking edit adjustment refund for ${b.bookingDate ? new Date(b.bookingDate).toLocaleDateString('en-IN') : ''}`,
              referenceNumber: '',
              date: new Date().toISOString(),
              createdBy: session.user.id,
              bookingId: b._id,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          } else {
            if (b.totalPaid >= finalAmt && finalAmt > 0) {
              b.paymentStatus = 'paid';
            } else if (b.totalPaid > 0) {
              b.paymentStatus = 'partial';
            } else {
              b.paymentStatus = 'pending';
            }
          }
        }
        
        // Keep slots in sync for standard bookings in dev-store fallback
        if (b.bookingType === 'standard') {
          b.slots = [{
            bookingDate: b.bookingDate,
            startTime: b.startTime,
            endTime: b.endTime
          } as any];
        }
        
        // Log edit history in dev store
        const isDateChanged = oldDate !== b.bookingDate;
        const isTimeChanged = oldStartTime !== b.startTime || oldEndTime !== b.endTime;
        const isPriceChanged = oldExpectedAmount !== b.expectedAmount;
        if (isDateChanged || isTimeChanged || isPriceChanged) {
          if (!b.editHistory) b.editHistory = [];
          b.editHistory.push({
            editedAt: new Date().toISOString(),
            oldDate,
            oldStartTime,
            oldEndTime,
            oldExpectedAmount,
            newDate: b.bookingDate,
            newStartTime: b.startTime,
            newEndTime: b.endTime,
            newExpectedAmount: b.expectedAmount
          });
        }
        
        b.updatedAt = new Date().toISOString();
      }
      return successResponse(booking, 'Booking updated successfully');
    }

    const booking = await Booking.findById(id);
    if (!booking) return errorResponse('Booking not found', 404);

    if (booking.bookingStatus === 'cancelled') {
      return errorResponse('Cannot edit a cancelled booking');
    }

    const isGroupUpdate = updateGroup && booking.bulkId;
    const bookingsToUpdate = isGroupUpdate
      ? await Booking.find({ bulkId: booking.bulkId })
      : [booking];

    // Store old values for audit
    const oldValue = {
      customerName: booking.customerName,
      contactNumber: booking.contactNumber,
      expectedAmount: booking.expectedAmount,
      notes: booking.notes,
      bookingDate: booking.bookingDate,
      startTime: booking.startTime,
      endTime: booking.endTime,
    };

    // If changing time slot on a booking without payments, check for conflicts
    const newStartTime = startTime || booking.startTime;
    const newEndTime = endTime || booking.endTime;
    const newBookingDate = bookingDate ? parseDateOnly(bookingDate) : booking.bookingDate;

    if (startTime || endTime || bookingDate) {
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
      if (startTime && !timeRegex.test(startTime)) return errorResponse('Invalid start time format');
      if (endTime && !timeRegex.test(endTime)) return errorResponse('Invalid end time format');
      if (newStartTime >= newEndTime) return errorResponse('Start time must be before end time');

      const dateStart = parseDateOnly(newBookingDate as Date);
      dateStart.setHours(0, 0, 0, 0);
      const dateEnd = parseDateOnly(newBookingDate as Date);
      dateEnd.setHours(23, 59, 59, 999);

      const conflicts = await Booking.find({
        _id: { $ne: id },
        bookingStatus: 'confirmed',
        $or: [
          {
            bookingDate: { $gte: dateStart, $lte: dateEnd },
            startTime: { $lt: newEndTime },
            endTime: { $gt: newStartTime },
          },
          {
            'slots.bookingDate': { $gte: dateStart, $lte: dateEnd },
            'slots.startTime': { $lt: newEndTime },
            'slots.endTime': { $gt: newStartTime },
          }
        ]
      });

      if (conflicts.length > 0) {
        return errorResponse('Time slot conflict with another confirmed booking');
      }

      booking.bookingDate = newBookingDate;
      booking.startTime = newStartTime;
      booking.endTime = newEndTime;

      if (booking.bookingType === 'standard') {
        booking.slots = [{
          bookingDate: newBookingDate as Date,
          startTime: newStartTime,
          endTime: newEndTime,
        }];
      }
    }

    // Update editable fields for all bookings in group or just single booking
    for (const b of bookingsToUpdate) {
      if (customerName !== undefined) b.customerName = customerName.trim();
      if (contactNumber !== undefined) b.contactNumber = contactNumber.trim();
      if (notes !== undefined) b.notes = notes;
      
      if (expectedAmount !== undefined) {
        b.expectedAmount = expectedAmount;
        const finalAmt = Math.max(0, b.expectedAmount - (b.discountAmount || 0));
        const refundAmount = b.totalPaid - finalAmt;
        
        if (refundAmount > 0) {
          b.totalPaid = finalAmt;
          b.paymentStatus = 'paid';
          
          await PaymentEntry.create({
            bookingId: b._id,
            amountPaid: -refundAmount,
            paymentMode: 'bank_transfer',
            paymentDate: new Date(),
            referenceNote: 'Automatic adjustment due to booking edit (price decrease)',
            createdBy: session.user.id,
          });
          
          // Use dynamic import for AccountTransaction if it's not imported at top
          // It's actually imported from '@/models/AccountTransaction' ? Wait I need to import it
          const AccountTransactionModule = await import('@/models/AccountTransaction');
          const AccountTransactionModel = AccountTransactionModule.default;
          
          await AccountTransactionModel.create({
            type: 'expense',
            source: 'booking',
            amount: refundAmount,
            paymentMode: 'bank_transfer',
            customerName: b.customerName || '',
            customerContact: b.contactNumber || '',
            summary: `Booking edit adjustment refund for ${b.bookingDate ? new Date(b.bookingDate).toLocaleDateString('en-IN') : ''}`,
            date: new Date(),
            createdBy: session.user.id,
            bookingId: b._id,
          });
        } else {
          if (b.totalPaid >= finalAmt && finalAmt > 0) {
            b.paymentStatus = 'paid';
          } else if (b.totalPaid > 0) {
            b.paymentStatus = 'partial';
          } else {
            b.paymentStatus = 'pending';
          }
        }
      }
      
      // Save changes if it's not the main booking (main booking is saved below)
      if (b._id.toString() !== booking._id.toString()) {
        await b.save();
      }
    }

    const isDateChanged = oldValue.bookingDate?.toISOString() !== booking.bookingDate?.toISOString();
    const isTimeChanged = oldValue.startTime !== booking.startTime || oldValue.endTime !== booking.endTime;
    const isPriceChanged = oldValue.expectedAmount !== booking.expectedAmount;
    
    if (isDateChanged || isTimeChanged || isPriceChanged) {
      if (!booking.editHistory) booking.editHistory = [];
      booking.editHistory.push({
        editedAt: new Date(),
        oldDate: oldValue.bookingDate,
        oldStartTime: oldValue.startTime,
        oldEndTime: oldValue.endTime,
        oldExpectedAmount: oldValue.expectedAmount,
        newDate: booking.bookingDate,
        newStartTime: booking.startTime,
        newEndTime: booking.endTime,
        newExpectedAmount: booking.expectedAmount,
      });
    }

    await booking.save();

    const newValue = {
      customerName: booking.customerName,
      contactNumber: booking.contactNumber,
      expectedAmount: booking.expectedAmount,
      notes: booking.notes,
      bookingDate: booking.bookingDate,
      startTime: booking.startTime,
      endTime: booking.endTime,
    };

    const meta = getRequestMeta(request.headers);
    await auditAction({
      userId: session.user.id,
      userName: session.user.name || '',
      userType: session.user.userType,
      action: 'edit_booking',
      module: 'bookings',
      recordId: booking._id,
      description: `Edited booking for ${booking.bookingDate ? new Date(booking.bookingDate).toLocaleDateString('en-IN') : 'Unknown Date'} ${booking.startTime}-${booking.endTime}. Group update: ${!!isGroupUpdate}`,
      oldValue,
      newValue,
      ...meta,
    }, request.headers);

    return successResponse(booking, 'Booking updated successfully');
  } catch (error) {
    console.error('PUT /api/bookings/[id] error:', error);
    return errorResponse('Failed to update booking', 500);
  }
}

// DELETE — Cancel booking (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('Unauthorized', 401);

    const { checkPermission } = await import('@/lib/permissions');
    const perm = await checkPermission(session.user.id, 'bookings', 'cancel_booking');
    if (!perm.allowed) return errorResponse('Forbidden', 403);

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { reason } = body as { reason?: string };

    try {
      await dbConnect();
    } catch (error) {
      if (!isDevFallbackEnabled()) throw error;
      const store = getDevStore();
      const booking = store.bookings.find((entry) => entry._id === id);
      if (!booking) return errorResponse('Booking not found', 404);
      if (booking.bookingStatus === 'cancelled') return errorResponse('Booking is already cancelled');

      const isGroupDelete = booking.bulkId;
      const bookingsToCancel = isGroupDelete
        ? store.bookings.filter((b) => b.bulkId === booking.bulkId)
        : [booking];

      const now = new Date().toISOString();
      for (const b of bookingsToCancel) {
        if (b.bookingStatus !== 'cancelled') {
          b.bookingStatus = 'cancelled';
          b.cancelReason = reason || '';
          b.cancelledAt = now;
          b.cancelledBy = session.user.id;
          b.updatedAt = now;
        }
      }
      return successResponse(booking, 'Booking cancelled successfully');
    }

    const booking = await Booking.findById(id);
    if (!booking) return errorResponse('Booking not found', 404);

    if (booking.bookingStatus === 'cancelled') {
      return errorResponse('Booking is already cancelled');
    }

    const isGroupDelete = booking.bulkId;
    const bookingsToCancel = isGroupDelete
      ? await Booking.find({ bulkId: booking.bulkId })
      : [booking];

    const now = new Date();
    for (const b of bookingsToCancel) {
      if (b.bookingStatus !== 'cancelled') {
        b.bookingStatus = 'cancelled';
        b.cancelReason = reason || '';
        b.cancelledAt = now;
        b.cancelledBy = session.user.id as unknown as Types.ObjectId;
        
        // Save other bookings if it's not the main booking (main booking is saved below)
        if (b._id.toString() !== booking._id.toString()) {
          await b.save();
        }
      }
    }

    await booking.save();

    const meta = getRequestMeta(request.headers);
    await auditAction({
      userId: session.user.id,
      userName: session.user.name || '',
      userType: session.user.userType,
      action: 'cancel_booking',
      module: 'bookings',
      recordId: booking._id,
      description: `Cancelled booking for ${booking.bookingDate ? new Date(booking.bookingDate).toLocaleDateString('en-IN') : 'Unknown Date'} ${booking.startTime}-${booking.endTime}. Reason: ${reason || 'No reason given'}. Group cancel: ${!!isGroupDelete}`,
      oldValue: { bookingStatus: 'confirmed' },
      newValue: { bookingStatus: 'cancelled', cancelReason: reason || '' },
      ...meta,
    }, request.headers);

    return successResponse(booking, 'Booking cancelled successfully');
  } catch (error) {
    console.error('DELETE /api/bookings/[id] error:', error);
    return errorResponse('Failed to cancel booking', 500);
  }
}

function parseDateOnly(dateInput: string | Date) {
  if (dateInput instanceof Date) return new Date(dateInput);
  const [year, month, day] = dateInput.split('T')[0].split('-').map(Number);
  return new Date(year, month - 1, day);
}
