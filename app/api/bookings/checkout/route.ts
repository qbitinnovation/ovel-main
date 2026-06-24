import { type NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import dbConnect from '@/lib/db';
import Booking from '@/models/Booking';
import { auditAction } from '@/lib/audit';
import { successResponse, errorResponse, getRequestMeta } from '@/lib/utils';
import {
  calculateTurfSlotPrice,
  normalizeTurfPriceType,
  type TurfPricingResult,
} from '@/lib/turf-pricing';
import { getDevTurfPricingConfig, getTurfPricingConfig } from '@/lib/turf-pricing-settings';
import {
  createDevId,
  devUserRef,
  getDevStore,
  isDevFallbackEnabled,
  type DevBooking,
} from '@/lib/dev-store';

export const dynamic = 'force-dynamic';

type DiscountType = 'percentage' | 'flat';
type CheckoutItemKind = 'slot' | 'full_day' | 'extra_slot';

interface CheckoutItem {
  bookingDate: string;
  startTime: string;
  endTime: string;
  kind: CheckoutItemKind;
  label: string;
}

interface PreparedCheckoutItem extends CheckoutItem {
  quote: TurfPricingResult;
  discountAmount: number;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('Unauthorized', 401);

    const { checkPermission } = await import('@/lib/permissions');
    const perm = await checkPermission(session.user.id, 'bookings', 'create_booking');
    if (!perm.allowed) return errorResponse('Forbidden', 403);

    const body = await request.json() as Record<string, unknown>;
    const itemsResult = parseCheckoutItems(body.items);
    if ('error' in itemsResult) return errorResponse(itemsResult.error);

    const items = itemsResult.items;
    if (items.length === 0) return errorResponse('At least one booking slot is required');

    const priceType = normalizeTurfPriceType(body.priceType);
    const customerName = typeof body.customerName === 'string' ? body.customerName.trim() : '';
    const contactNumber = typeof body.contactNumber === 'string' ? body.contactNumber.trim() : '';
    const notes = typeof body.notes === 'string' ? body.notes.trim() : '';

    const internalOverlap = findInternalOverlap(items);
    if (internalOverlap) {
      return errorResponse(`Selected slots overlap on ${internalOverlap.bookingDate}. Please adjust the cart.`);
    }

    let useDevStore = false;
    try {
      await dbConnect();
    } catch (error) {
      if (!isDevFallbackEnabled()) throw error;
      useDevStore = true;
    }

    const pricing = useDevStore ? getDevTurfPricingConfig() : await getTurfPricingConfig();
    const quotedItems = items.map((item) => ({
      ...item,
      quote: calculateTurfSlotPrice({
        bookingDate: item.bookingDate,
        startTime: item.startTime,
        endTime: item.endTime,
        priceType,
        weekdayRules: pricing.weekdayRules,
        weekendRules: pricing.weekendRules,
        holidays: pricing.holidays,
        weekendDays: pricing.weekendDays,
      }),
    }));

    const baseAmount = quotedItems.reduce((sum, item) => sum + item.quote.amount, 0);
    if (baseAmount <= 0 || quotedItems.some((item) => item.quote.amount <= 0)) {
      return errorResponse('Calculated slot price must be greater than 0');
    }

    const discount = normalizeDiscount(body.discount, baseAmount);
    const discountDistribution = distributeDiscount(quotedItems.map((item) => item.quote.amount), discount.amount);
    const preparedItems: PreparedCheckoutItem[] = quotedItems.map((item, index) => ({
      ...item,
      discountAmount: discountDistribution[index] || 0,
    }));
    const finalAmount = Math.max(0, baseAmount - discount.amount);
    const bulkId = `checkout_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    if (useDevStore) {
      const conflict = findDevConflict(preparedItems);
      if (conflict) {
        return errorResponse(`Time slot conflict! An existing booking (${conflict.startTime} - ${conflict.endTime}) overlaps with the requested slot.`);
      }

      const now = new Date().toISOString();
      const bookings: DevBooking[] = preparedItems.map((item) => ({
        _id: createDevId('booking'),
        bookingDate: new Date(item.bookingDate).toISOString(),
        startTime: item.startTime,
        endTime: item.endTime,
        customerName,
        contactNumber,
        expectedAmount: item.quote.amount,
        discountAmount: item.discountAmount,
        discountPercentage: discount.percentage,
        priceType,
        pricingSnapshot: buildPricingSnapshot(item, {
          baseAmount,
          discountAmount: discount.amount,
          discountPercentage: discount.percentage,
          finalAmount,
          discountType: discount.type,
        }),
        notes: buildItemNotes(notes, item),
        bookingStatus: 'confirmed',
        paymentStatus: 'pending',
        totalPaid: 0,
        cancelReason: '',
        cancelledAt: null,
        cancelledBy: null,
        createdBy: session.user.id,
        bulkId,
        createdAt: now,
        updatedAt: now,
      }));

      const store = getDevStore();
      store.bookings.unshift(...bookings);
      return successResponse(
        {
          bulkId,
          bookings: bookings.map((booking) => ({
            ...booking,
            createdBy: devUserRef(booking.createdBy),
            cancelledBy: null,
          })),
          summary: { baseAmount, discountAmount: discount.amount, discountPercentage: discount.percentage, finalAmount },
        },
        'Booking checkout confirmed successfully',
        201
      );
    }

    const conflicts = await Booking.find({
      bookingStatus: 'confirmed',
      $or: preparedItems.map((item) => {
        const { start, end } = dateBounds(item.bookingDate);
        return {
          $or: [
            {
              bookingDate: { $gte: start, $lte: end },
              startTime: { $lt: item.endTime },
              endTime: { $gt: item.startTime },
            },
            {
              slots: {
                $elemMatch: {
                  bookingDate: { $gte: start, $lte: end },
                  startTime: { $lt: item.endTime },
                  endTime: { $gt: item.startTime },
                }
              }
            }
          ]
        };
      }),
    }).limit(1);

    if (conflicts.length > 0) {
      const conflictSlot = `${conflicts[0].startTime} - ${conflicts[0].endTime}`;
      return errorResponse(`Time slot conflict! An existing booking (${conflictSlot}) overlaps with the requested slot.`);
    }

    const isBulk = preparedItems.length > 1;
    const primaryItem = preparedItems[0];
    
    const doc = await Booking.create({
      bookingType: isBulk ? 'bulk' : 'standard',
      bookingDate: parseDateOnly(primaryItem.bookingDate),
      startTime: primaryItem.startTime,
      endTime: primaryItem.endTime,
      slots: preparedItems.map((item) => ({
        bookingDate: parseDateOnly(item.bookingDate),
        startTime: item.startTime,
        endTime: item.endTime,
      })),
      customerName,
      contactNumber,
      expectedAmount: baseAmount,
      discountAmount: discount.amount,
      discountPercentage: discount.percentage,
      priceType,
      pricingSnapshot: preparedItems.map(item => buildPricingSnapshot(item, {
        baseAmount,
        discountAmount: discount.amount,
        discountPercentage: discount.percentage,
        finalAmount,
        discountType: discount.type,
      })),
      notes: notes || (isBulk ? 'Bulk booking' : buildItemNotes(notes, primaryItem)),
      bookingStatus: 'confirmed',
      paymentStatus: 'pending',
      totalPaid: 0,
      bulkId,
      createdBy: session.user.id,
    });

    const meta = getRequestMeta(request.headers);
    await auditAction({
      userId: session.user.id,
      userName: session.user.name || '',
      userType: session.user.userType,
      action: 'create_booking_checkout',
      module: 'bookings',
      recordId: doc._id,
      description: `Created booking checkout ${bulkId} with ${preparedItems.length} item(s). Base: Rs.${baseAmount}. Discount: Rs.${discount.amount}. Final: Rs.${finalAmount}`,
      newValue: {
        bulkId,
        itemCount: preparedItems.length,
        baseAmount,
        discountAmount: discount.amount,
        discountPercentage: discount.percentage,
        finalAmount,
        priceType,
      },
      ...meta,
    }, request.headers);

    return successResponse(
      {
        bulkId,
        bookings: [doc],
        summary: { baseAmount, discountAmount: discount.amount, discountPercentage: discount.percentage, finalAmount },
      },
      'Booking checkout confirmed successfully',
      201
    );
  } catch (error) {
    console.error('POST /api/bookings/checkout error:', error);
    return errorResponse(error instanceof Error ? error.message : 'Failed to confirm booking checkout', 500);
  }
}

function parseCheckoutItems(value: unknown): { items: CheckoutItem[] } | { error: string } {
  if (!Array.isArray(value)) return { error: 'Booking items must be an array' };

  const items: CheckoutItem[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const row = value[index];
    if (!row || typeof row !== 'object') return { error: `Invalid booking item #${index + 1}` };

    const record = row as Record<string, unknown>;
    const bookingDate = typeof record.bookingDate === 'string' ? record.bookingDate.split('T')[0] : '';
    const startTime = typeof record.startTime === 'string' ? record.startTime : '';
    const endTime = typeof record.endTime === 'string' ? record.endTime : '';
    const rawKind = typeof record.kind === 'string' ? record.kind : 'slot';
    const label = typeof record.label === 'string' ? record.label : '';

    if (!DATE_RE.test(bookingDate)) return { error: `Invalid booking date in item #${index + 1}` };
    if (!TIME_RE.test(startTime)) return { error: `Invalid start time in item #${index + 1}` };
    if (!TIME_RE.test(endTime)) return { error: `Invalid end time in item #${index + 1}` };

    const startMinutes = toMinutes(startTime);
    const endMinutes = toMinutes(endTime);
    if (startMinutes === null || endMinutes === null || startMinutes >= endMinutes) {
      return { error: `Start time must be before end time in item #${index + 1}` };
    }

    const kind: CheckoutItemKind =
      rawKind === 'full_day' || rawKind === 'extra_slot' || rawKind === 'slot' ? rawKind : 'slot';

    items.push({
      bookingDate,
      startTime,
      endTime,
      kind,
      label,
    });
  }

  return { items };
}

function normalizeDiscount(value: unknown, baseAmount: number): {
  type: DiscountType;
  amount: number;
  percentage: number;
} {
  const record = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const type: DiscountType = record.type === 'percentage' ? 'percentage' : 'flat';
  const rawValue = Number(record.value || 0);
  const safeValue = Number.isFinite(rawValue) ? Math.max(0, rawValue) : 0;

  if (type === 'percentage') {
    const percentage = Math.min(100, safeValue);
    return {
      type,
      amount: Math.min(baseAmount, Math.round((baseAmount * percentage) / 100)),
      percentage,
    };
  }

  const amount = Math.min(baseAmount, Math.round(safeValue));
  return {
    type,
    amount,
    percentage: baseAmount > 0 ? Number(((amount / baseAmount) * 100).toFixed(2)) : 0,
  };
}

function distributeDiscount(amounts: number[], discountAmount: number) {
  if (discountAmount <= 0) return amounts.map(() => 0);
  const total = amounts.reduce((sum, amount) => sum + amount, 0);
  let used = 0;

  return amounts.map((amount, index) => {
    if (index === amounts.length - 1) return Math.max(0, discountAmount - used);
    const share = total > 0 ? Math.round((discountAmount * amount) / total) : 0;
    used += share;
    return share;
  });
}

function findInternalOverlap(items: CheckoutItem[]) {
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      if (items[i].bookingDate !== items[j].bookingDate) continue;
      if (rangesOverlap(items[i].startTime, items[i].endTime, items[j].startTime, items[j].endTime)) {
        return items[i];
      }
    }
  }
  return null;
}

function findDevConflict(items: CheckoutItem[]) {
  const store = getDevStore();
  return store.bookings.find((booking) => (
    booking.bookingStatus === 'confirmed' &&
    items.some((item) => (
      toDateKey(booking.bookingDate) === item.bookingDate &&
      rangesOverlap(booking.startTime, booking.endTime, item.startTime, item.endTime)
    ))
  ));
}

function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  const aStartMinutes = toMinutes(aStart);
  const aEndMinutes = toMinutes(aEnd);
  const bStartMinutes = toMinutes(bStart);
  const bEndMinutes = toMinutes(bEnd);
  if (aStartMinutes === null || aEndMinutes === null || bStartMinutes === null || bEndMinutes === null) return false;
  return aStartMinutes < bEndMinutes && bStartMinutes < aEndMinutes;
}

function buildPricingSnapshot(item: PreparedCheckoutItem, checkout: {
  baseAmount: number;
  discountAmount: number;
  discountPercentage: number;
  finalAmount: number;
  discountType: DiscountType;
}) {
  return {
    ...item.quote,
    checkout: {
      kind: item.kind,
      label: item.label,
      itemDiscountAmount: item.discountAmount,
      ...checkout,
    },
  };
}

function buildItemNotes(notes: string, item: CheckoutItem) {
  const label = item.label || (item.kind === 'full_day' ? 'Full day' : 'Slot booking');
  return notes ? `${notes} (${label})` : label;
}

function dateBounds(dateKey: string) {
  const start = parseDateOnly(dateKey);
  start.setHours(0, 0, 0, 0);
  const end = parseDateOnly(dateKey);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function parseDateOnly(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function toMinutes(time: string) {
  if (!TIME_RE.test(time)) return null;
  if (time === '23:59') return 24 * 60;
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function toDateKey(value: string | Date) {
  if (value instanceof Date) return value.toISOString().split('T')[0];
  return value.includes('T') ? value.split('T')[0] : value;
}
