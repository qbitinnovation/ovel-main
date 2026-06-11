import { type NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import dbConnect from '@/lib/db';
import Booking from '@/models/Booking';
import { auditAction } from '@/lib/audit';
import { successResponse, errorResponse, getRequestMeta, parsePagination, paginate } from '@/lib/utils';
import { createDevId, devUserRef, getDevStore, isDevFallbackEnabled, type DevBooking } from '@/lib/dev-store';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('Unauthorized', 401);

    const sp = request.nextUrl.searchParams;
    const { page, limit } = parsePagination(sp);
    const startDate = sp.get('startDate');
    const endDate = sp.get('endDate');
    const status = sp.get('status'); // 'pending' | 'partial' | 'paid'
    const bookingStatus = sp.get('bookingStatus'); // 'confirmed' | 'cancelled'

    try {
      await dbConnect();
    } catch (error) {
      if (!isDevFallbackEnabled()) throw error;
      const store = getDevStore();
      let bookings = store.bookings;
      if (startDate) bookings = bookings.filter((booking) => new Date(booking.bookingDate) >= new Date(startDate));
      if (endDate) bookings = bookings.filter((booking) => new Date(booking.bookingDate) <= new Date(endDate));
      if (status) bookings = bookings.filter((booking) => booking.paymentStatus === status);
      if (bookingStatus) bookings = bookings.filter((booking) => booking.bookingStatus === bookingStatus);
      const total = bookings.length;
      const pagination = paginate({ page, limit, total });
      const pagedBookings = bookings
        .slice()
        .sort((a, b) => new Date(b.bookingDate).getTime() - new Date(a.bookingDate).getTime() || b.startTime.localeCompare(a.startTime))
        .slice(pagination.skip, pagination.skip + limit)
        .map((booking) => ({ ...booking, createdBy: devUserRef(booking.createdBy), cancelledBy: devUserRef(booking.cancelledBy) }));
      return successResponse({ bookings: pagedBookings, pagination });
    }

    const filter: Record<string, unknown> = {};

    if (startDate || endDate) {
      filter.bookingDate = {};
      if (startDate) (filter.bookingDate as Record<string, Date>).$gte = new Date(startDate);
      if (endDate) (filter.bookingDate as Record<string, Date>).$lte = new Date(endDate);
    }
    if (status) filter.paymentStatus = status;
    if (bookingStatus) filter.bookingStatus = bookingStatus;

    const total = await Booking.countDocuments(filter);
    const pagination = paginate({ page, limit, total });

    const bookings = await Booking.find(filter)
      .populate('createdBy', 'name')
      .populate('cancelledBy', 'name')
      .sort({ bookingDate: -1, startTime: -1 })
      .skip(pagination.skip)
      .limit(limit);

    return successResponse({ bookings, pagination });
  } catch (error) {
    console.error('GET /api/bookings error:', error);
    return errorResponse('Failed to fetch bookings', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('Unauthorized', 401);

    const body = await request.json();
    const { bookingDate, startTime, endTime, customerName, contactNumber, expectedAmount, notes } = body;

    // Validate required fields
    if (!bookingDate) return errorResponse('Booking date is required');
    if (!startTime) return errorResponse('Start time is required');
    if (!endTime) return errorResponse('End time is required');
    if (!expectedAmount || expectedAmount <= 0) return errorResponse('Expected amount must be greater than 0');

    // Validate time format (HH:mm)
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(startTime)) return errorResponse('Invalid start time format. Use HH:mm');
    if (!timeRegex.test(endTime)) return errorResponse('Invalid end time format. Use HH:mm');
    if (startTime >= endTime) return errorResponse('Start time must be before end time');

    let useDevStore = false;
    try {
      await dbConnect();
    } catch (error) {
      if (!isDevFallbackEnabled()) throw error;
      useDevStore = true;
    }

    if (useDevStore) {
      const store = getDevStore();
      const requestedDate = new Date(bookingDate).toDateString();
      const conflict = store.bookings.find((booking) =>
        booking.bookingStatus === 'confirmed' &&
        new Date(booking.bookingDate).toDateString() === requestedDate &&
        booking.startTime < endTime &&
        startTime < booking.endTime
      );
      if (conflict) return errorResponse(`Time slot conflict! An existing booking (${conflict.startTime} - ${conflict.endTime}) overlaps with the requested slot. Double booking is not allowed.`);
      const now = new Date().toISOString();
      const booking: DevBooking = {
        _id: createDevId('booking'),
        bookingDate: new Date(bookingDate).toISOString(),
        startTime,
        endTime,
        customerName: customerName?.trim() || '',
        contactNumber: contactNumber?.trim() || '',
        expectedAmount: Number(expectedAmount),
        notes: notes || '',
        bookingStatus: 'confirmed',
        paymentStatus: 'pending',
        totalPaid: 0,
        cancelReason: '',
        cancelledAt: null,
        cancelledBy: null,
        createdBy: session.user.id,
        createdAt: now,
        updatedAt: now,
      };
      store.bookings.unshift(booking);
      return successResponse({ ...booking, createdBy: devUserRef(session.user.id), cancelledBy: null }, 'Booking confirmed successfully', 201);
    }

    // Check for overlapping confirmed bookings on the same date
    // Overlap: existingStart < newEnd AND newStart < existingEnd
    const dateStart = new Date(bookingDate);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(bookingDate);
    dateEnd.setHours(23, 59, 59, 999);

    const conflicts = await Booking.find({
      bookingDate: { $gte: dateStart, $lte: dateEnd },
      bookingStatus: 'confirmed',
      startTime: { $lt: endTime },
      endTime: { $gt: startTime },
    });

    if (conflicts.length > 0) {
      const conflictSlot = `${conflicts[0].startTime} - ${conflicts[0].endTime}`;
      return errorResponse(
        `Time slot conflict! An existing booking (${conflictSlot}) overlaps with the requested slot. Double booking is not allowed.`
      );
    }

    const booking = await Booking.create({
      bookingDate: new Date(bookingDate),
      startTime,
      endTime,
      customerName: customerName?.trim() || '',
      contactNumber: contactNumber?.trim() || '',
      expectedAmount: Number(expectedAmount),
      notes: notes || '',
      bookingStatus: 'confirmed',
      paymentStatus: 'pending',
      totalPaid: 0,
      createdBy: session.user.id,
    });

    const meta = getRequestMeta(request.headers);
    await auditAction({
      userId: session.user.id,
      userName: session.user.name || '',
      userType: session.user.userType,
      action: 'create_booking',
      module: 'bookings',
      recordId: booking._id,
      description: `Created booking for ${new Date(bookingDate).toLocaleDateString('en-IN')} ${startTime}-${endTime}. Customer: ${customerName || 'Anonymous'}. Expected: ₹${expectedAmount}`,
      newValue: {
        bookingDate,
        startTime,
        endTime,
        customerName: customerName || '',
        expectedAmount,
      },
      ...meta,
    }, request.headers);

    return successResponse(booking, 'Booking confirmed successfully', 201);
  } catch (error) {
    console.error('POST /api/bookings error:', error);
    return errorResponse('Failed to create booking', 500);
  }
}
