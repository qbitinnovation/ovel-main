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

    const { id } = await params;
    const body = await request.json();
    const { customerName, contactNumber, notes, bookingDate, startTime, endTime, updateGroup } = body;

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
        const paymentCount = store.payments.filter((payment) => payment.bookingId === b._id).length;
        if (paymentCount > 0 && (bookingDate || startTime || endTime)) {
          return errorResponse('Cannot change booking date or time slot because payments have been recorded against this booking');
        }
        if (customerName !== undefined) b.customerName = customerName.trim();
        if (contactNumber !== undefined) b.contactNumber = contactNumber.trim();
        if (notes !== undefined) b.notes = notes;
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

    // Check if payments exist on any booking being updated if date/time is changing
    for (const b of bookingsToUpdate) {
      const paymentCount = await PaymentEntry.countDocuments({ bookingId: b._id });
      if (paymentCount > 0 && (bookingDate || startTime || endTime)) {
        return errorResponse(
          'Cannot change booking date or time slot because payments have been recorded against this booking'
        );
      }
    }

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
    const newBookingDate = bookingDate ? new Date(bookingDate) : booking.bookingDate;

    if (startTime || endTime || bookingDate) {
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
      if (startTime && !timeRegex.test(startTime)) return errorResponse('Invalid start time format');
      if (endTime && !timeRegex.test(endTime)) return errorResponse('Invalid end time format');
      if (newStartTime >= newEndTime) return errorResponse('Start time must be before end time');

      const dateStart = new Date(newBookingDate);
      dateStart.setHours(0, 0, 0, 0);
      const dateEnd = new Date(newBookingDate);
      dateEnd.setHours(23, 59, 59, 999);

      const conflicts = await Booking.find({
        _id: { $ne: id },
        bookingDate: { $gte: dateStart, $lte: dateEnd },
        bookingStatus: 'confirmed',
        startTime: { $lt: newEndTime },
        endTime: { $gt: newStartTime },
      });

      if (conflicts.length > 0) {
        return errorResponse('Time slot conflict with another confirmed booking');
      }

      booking.bookingDate = newBookingDate;
      booking.startTime = newStartTime;
      booking.endTime = newEndTime;
    }

    // Update editable fields for all bookings in group or just single booking
    for (const b of bookingsToUpdate) {
      if (customerName !== undefined) b.customerName = customerName.trim();
      if (contactNumber !== undefined) b.contactNumber = contactNumber.trim();
      if (notes !== undefined) b.notes = notes;
      
      // Save changes if it's not the main booking (main booking is saved below)
      if (b._id.toString() !== booking._id.toString()) {
        await b.save();
      }
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
      description: `Edited booking for ${booking.bookingDate.toLocaleDateString('en-IN')} ${booking.startTime}-${booking.endTime}. Group update: ${!!isGroupUpdate}`,
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
      description: `Cancelled booking for ${booking.bookingDate.toLocaleDateString('en-IN')} ${booking.startTime}-${booking.endTime}. Reason: ${reason || 'No reason given'}. Group cancel: ${!!isGroupDelete}`,
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
