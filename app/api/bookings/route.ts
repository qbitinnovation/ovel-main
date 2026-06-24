import { type NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import dbConnect from '@/lib/db';
import Booking from '@/models/Booking';
import { auditAction } from '@/lib/audit';
import { successResponse, errorResponse, getRequestMeta, parsePagination, paginate } from '@/lib/utils';
import { createDevId, devUserRef, getDevStore, isDevFallbackEnabled, type DevBooking } from '@/lib/dev-store';
import { calculateTurfSlotPrice } from '@/lib/turf-pricing';
import { getDevTurfPricingConfig, getTurfPricingConfig } from '@/lib/turf-pricing-settings';
import { checkPermission } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('Unauthorized', 401);

    const [permView, permCreate, permDashboard] = await Promise.all([
      checkPermission(session.user.id, 'bookings', 'view_booking'),
      checkPermission(session.user.id, 'bookings', 'create_booking'),
      checkPermission(session.user.id, 'bookings', 'view_payment_dashboard')
    ]);

    if (!permView.allowed && !permCreate.allowed && !permDashboard.allowed) {
      return errorResponse('Forbidden', 403);
    }

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
      if (startDate) bookings = bookings.filter((booking) => toDateKey(booking.bookingDate) >= startDate);
      if (endDate) bookings = bookings.filter((booking) => toDateKey(booking.bookingDate) <= endDate);
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
      const dateFilter: Record<string, Date> = {};
      if (startDate) {
        const start = parseDateOnly(startDate);
        start.setHours(0, 0, 0, 0);
        dateFilter.$gte = start;
      }
      if (endDate) {
        const end = parseDateOnly(endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter.$lte = end;
      }
      
      filter.$or = [
        { bookingDate: { ...dateFilter } },
        { 'slots.bookingDate': { ...dateFilter } }
      ];
    }
    if (status) filter.paymentStatus = status;
    if (bookingStatus) filter.bookingStatus = bookingStatus;

    const total = await Booking.countDocuments(filter);
    const pagination = paginate({ page, limit, total });

    const bookings = await Booking.find(filter)
      .populate('createdBy', 'name')
      .populate('cancelledBy', 'name')
      .sort({ bookingDate: -1, startTime: -1 })
      .limit(limit);

    console.log(`GET /api/bookings: found ${bookings.length} bookings for filter`, JSON.stringify(filter));

    return successResponse({ bookings, pagination });
  } catch (error) {
    try { require('fs').writeFileSync('api_error.txt', error instanceof Error ? error.stack : String(error)); } catch (e) {}
    console.error('GET /api/bookings error:', error);
    return errorResponse(`Failed to fetch bookings: ${error instanceof Error ? error.message : String(error)}`, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('Unauthorized', 401);

    const permission = await checkPermission(session.user.id, 'bookings', 'create_booking');
    if (!permission.allowed) return errorResponse('Forbidden', 403);

    const body = await request.json();
    const { bookingDate, startTime, endTime, customerName, contactNumber, notes, bulkId, priceType, discountAmount, discountPercentage } = body;

    // Validate required fields
    if (!bookingDate) return errorResponse('Booking date is required');
    if (!startTime) return errorResponse('Start time is required');
    if (!endTime) return errorResponse('End time is required');

    // Validate time format (HH:mm)
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(startTime)) return errorResponse('Invalid start time format. Use HH:mm');
    if (!timeRegex.test(endTime)) return errorResponse('Invalid end time format. Use HH:mm');
    if (startTime >= endTime) return errorResponse('Start time must be before end time');

    let useDevStore = false;
    let expectedAmount = 0;
    let pricingSnapshot: ReturnType<typeof calculateTurfSlotPrice> | null = null;
    try {
      await dbConnect();
    } catch (error) {
      if (!isDevFallbackEnabled()) throw error;
      useDevStore = true;
    }

    const pricing = useDevStore ? getDevTurfPricingConfig() : await getTurfPricingConfig();
    pricingSnapshot = calculateTurfSlotPrice({
      bookingDate,
      startTime,
      endTime,
      priceType,
      weekdayRules: pricing.weekdayRules,
      weekendRules: pricing.weekendRules,
      holidays: pricing.holidays,
      weekendDays: pricing.weekendDays,
    });
    expectedAmount = pricingSnapshot.amount;

    let finalDiscountAmount = Number(discountAmount) || 0;
    const finalDiscountPercentage = Number(discountPercentage) || 0;
    if (finalDiscountPercentage > 0) {
      finalDiscountAmount = (expectedAmount * finalDiscountPercentage) / 100;
    }
    
    expectedAmount -= finalDiscountAmount;
    expectedAmount = Math.max(0, Math.round(expectedAmount));
    
    if (pricingSnapshot.amount <= 0) return errorResponse('Calculated slot price must be greater than 0');

    if (useDevStore) {
      const store = getDevStore();
      const requestedDateKey = toDateKey(bookingDate);
      const conflict = store.bookings.find((booking) =>
        booking.bookingStatus === 'confirmed' &&
        toDateKey(booking.bookingDate) === requestedDateKey &&
        booking.startTime < endTime &&
        startTime < booking.endTime
      );
      if (conflict) return errorResponse(`Time slot conflict! An existing booking (${conflict.startTime} - ${conflict.endTime}) overlaps with the requested slot. Double booking is not allowed.`);
      const now = new Date().toISOString();
      const booking: DevBooking = {
        _id: createDevId('booking'),
        bookingDate: parseDateOnly(bookingDate).toISOString(),
        startTime,
        endTime,
        customerName: customerName?.trim() || '',
        contactNumber: contactNumber?.trim() || '',
        expectedAmount,
        discountAmount: finalDiscountAmount,
        discountPercentage: finalDiscountPercentage,
        priceType: pricingSnapshot.priceType,
        pricingSnapshot,
        notes: notes || '',
        bookingStatus: 'confirmed',
        paymentStatus: 'pending',
        totalPaid: 0,
        cancelReason: '',
        cancelledAt: null,
        cancelledBy: null,
        createdBy: session.user.id,
        bulkId: bulkId || null,
        createdAt: now,
        updatedAt: now,
      };
      store.bookings.unshift(booking);
      return successResponse({ ...booking, createdBy: devUserRef(session.user.id), cancelledBy: null }, 'Booking confirmed successfully', 201);
    }

    // Check for overlapping confirmed bookings on the same date
    // Overlap: existingStart < newEnd AND newStart < existingEnd
    const dateStart = parseDateOnly(bookingDate);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = parseDateOnly(bookingDate);
    dateEnd.setHours(23, 59, 59, 999);

    const conflicts = await Booking.find({
      bookingStatus: 'confirmed',
      $or: [
        {
          bookingDate: { $gte: dateStart, $lte: dateEnd },
          startTime: { $lt: endTime },
          endTime: { $gt: startTime },
        },
        {
          slots: {
            $elemMatch: {
              bookingDate: { $gte: dateStart, $lte: dateEnd },
              startTime: { $lt: endTime },
              endTime: { $gt: startTime },
            }
          }
        }
      ]
    });

    if (conflicts.length > 0) {
      const conflictSlot = `${conflicts[0].startTime} - ${conflicts[0].endTime}`;
      return errorResponse(
        `Time slot conflict! An existing booking (${conflictSlot}) overlaps with the requested slot. Double booking is not allowed.`
      );
    }

    const booking = await Booking.create({
      bookingDate: parseDateOnly(bookingDate),
      startTime,
      endTime,
      customerName: customerName?.trim() || '',
      contactNumber: contactNumber?.trim() || '',
      expectedAmount: Number(expectedAmount),
      discountAmount: finalDiscountAmount,
      discountPercentage: finalDiscountPercentage,
      priceType: pricingSnapshot.priceType,
      pricingSnapshot,
      notes: notes || '',
      bookingStatus: 'confirmed',
      paymentStatus: 'pending',
      totalPaid: 0,
      bulkId: bulkId || null,
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
        priceType: pricingSnapshot.priceType,
        pricingSnapshot,
      },
      ...meta,
    }, request.headers);

    return successResponse(booking, 'Booking confirmed successfully', 201);
  } catch (error) {
    console.error('POST /api/bookings error:', error);
    return errorResponse('Failed to create booking', 500);
  }
}

function parseDateOnly(dateInput: string | Date) {
  if (dateInput instanceof Date) return new Date(dateInput);
  const [year, month, day] = dateInput.split('T')[0].split('-').map(Number);
  return new Date(year, month - 1, day);
}

function toDateKey(value: string | Date) {
  if (value instanceof Date) return value.toISOString().split('T')[0];
  return value.includes('T') ? value.split('T')[0] : value;
}
