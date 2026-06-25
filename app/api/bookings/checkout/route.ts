import { type NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import dbConnect from '@/lib/db';
import Booking from '@/models/Booking';
import InventoryItem from '@/models/InventoryItem';
import InventoryTransaction from '@/models/InventoryTransaction';
import { auditAction } from '@/lib/audit';
import { successResponse, errorResponse, getRequestMeta } from '@/lib/utils';
import { getDevAllFacilitiesPricingConfig, getAllFacilitiesPricingConfig } from '@/lib/turf-pricing-settings';
import {
  calculateTurfSlotPrice,
  normalizeTurfPriceType,
  type TurfPricingResult,
} from '@/lib/turf-pricing';
import {
  createDevId,
  devUserRef,
  getDevStore,
  isDevFallbackEnabled,
  type DevBooking,
  type DevInventoryTransaction,
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
    
    const facility = ['turf', 'nets_with_machine', 'nets_without_machine'].includes(body.facility as string) ? (body.facility as 'turf' | 'nets_with_machine' | 'nets_without_machine') : 'turf';
    const loungeHours = Number(body.loungeHours) || 0;
    const productsPayload = Array.isArray(body.products) ? body.products : [];

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

    const allPricing = useDevStore ? getDevAllFacilitiesPricingConfig() : await getAllFacilitiesPricingConfig();
    const pricing = allPricing[facility] || allPricing.turf;
    const loungeHourlyRate = allPricing.loungeHourlyRate || 0;
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

    let baseAmount = quotedItems.reduce((sum, item) => sum + item.quote.amount, 0);
    if (baseAmount <= 0 || quotedItems.some((item) => item.quote.amount <= 0)) {
      return errorResponse('Calculated slot price must be greater than 0');
    }

    let loungeAmount = 0;
    if (loungeHours > 0) {
      loungeAmount = loungeHours * loungeHourlyRate; 
    }

    // Process products
    let productAmount = 0;
    const validatedProducts: Array<{ itemId: string, name: string, quantity: number, price: number }> = [];
    
    if (!useDevStore) {
      for (const p of productsPayload) {
        if (!p.itemId || !p.quantity || p.quantity <= 0) continue;
        const item = await InventoryItem.findById(p.itemId);
        if (!item) return errorResponse(`Product ${p.itemId} not found`);
        if (item.currentStock < p.quantity) return errorResponse(`Insufficient stock for ${item.name}. Current: ${item.currentStock}`);
        
        const price = item.unitPrice * p.quantity;
        productAmount += price;
        validatedProducts.push({
          itemId: item._id.toString(),
          name: item.name,
          quantity: p.quantity,
          price,
        });
      }
    } else {
      const devStore1 = getDevStore();
      for (const p of productsPayload) {
        if (!p.itemId || !p.quantity || p.quantity <= 0) continue;
        const item = devStore1.inventoryItems.find((entry) => entry._id === p.itemId);
        if (!item) return errorResponse(`Product ${p.itemId} not found`);
        if (item.currentStock < p.quantity) return errorResponse(`Insufficient stock for ${item.name}. Current: ${item.currentStock}`);
        
        const price = item.unitPrice * p.quantity;
        productAmount += price;
        validatedProducts.push({
          itemId: item._id,
          name: item.name,
          quantity: p.quantity,
          price,
        });
      }
    }

    const totalExpectedAmount = baseAmount + loungeAmount + productAmount;

    const discount = normalizeDiscount(body.discount, totalExpectedAmount);
    // Discount distribution is based on the baseAmount for now, or just total
    const discountDistribution = distributeDiscount(quotedItems.map((item) => item.quote.amount), discount.amount);
    const preparedItems: PreparedCheckoutItem[] = quotedItems.map((item, index) => ({
      ...item,
      discountAmount: discountDistribution[index] || 0,
    }));
    const finalAmount = Math.max(0, totalExpectedAmount - discount.amount);
    const bulkId = `checkout_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    if (useDevStore) {
      const conflict = findDevConflict(preparedItems, facility);
      if (conflict) {
        return errorResponse(`Time slot conflict! An existing booking (${conflict.startTime} - ${conflict.endTime}) overlaps with the requested slot.`);
      }

      // Drop inventory and log transactions
      const devStore2 = getDevStore();
      const now = new Date().toISOString();
      for (const p of validatedProducts) {
        const item = devStore2.inventoryItems.find((entry) => entry._id === p.itemId);
        if (item) {
          item.currentStock -= p.quantity;
          item.updatedAt = now;
          devStore2.inventoryTransactions.unshift({
            _id: createDevId('txn'),
            itemId: item._id,
            type: 'sale',
            quantity: p.quantity,
            amount: p.price,
            supplier: 'Amount received by booking',
            customerName: customerName || 'Amount received by booking',
            customerContact: contactNumber,
            date: now,
            enteredBy: session.user.id,
            createdAt: now,
          } as DevInventoryTransaction);
        }
      }
      const bookings: DevBooking[] = preparedItems.map((item, index) => ({
        _id: createDevId('booking'),
        bookingDate: new Date(item.bookingDate).toISOString(),
        startTime: item.startTime,
        endTime: item.endTime,
        customerName,
        contactNumber,
        expectedAmount: item.quote.amount + (index === 0 ? loungeAmount : 0) + (index === 0 ? productAmount : 0),
        discountAmount: item.discountAmount,
        discountPercentage: discount.percentage,
        priceType,
        facility,
        loungeHours: index === 0 ? loungeHours : 0,
        loungeAmount: index === 0 ? loungeAmount : 0,
        products: index === 0 ? validatedProducts : [],
        productAmount: index === 0 ? productAmount : 0,
        pricingSnapshot: buildPricingSnapshot(item, {
          baseAmount: item.quote.amount,
          discountAmount: item.discountAmount,
          discountPercentage: discount.percentage,
          finalAmount: item.quote.amount + (index === 0 ? loungeAmount : 0) + (index === 0 ? productAmount : 0) - item.discountAmount,
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

      devStore2.bookings.unshift(...bookings);
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
      facility,
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

    // Drop inventory and log transactions
    for (const p of validatedProducts) {
      const item = await InventoryItem.findById(p.itemId);
      if (item) {
        item.currentStock -= p.quantity;
        await item.save();
        await InventoryTransaction.create({
          itemId: item._id,
          type: 'sale',
          quantity: p.quantity,
          amount: p.price,
          customerName: customerName || 'Amount received by booking',
          supplier: 'Amount received by booking', // In case supplier is used as a tag field in DB
          customerContact: contactNumber,
          date: new Date(),
          enteredBy: session.user.id,
        });
      }
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
      expectedAmount: totalExpectedAmount,
      facility,
      loungeHours,
      loungeAmount,
      products: validatedProducts,
      productAmount,
      discountAmount: discount.amount,
      discountPercentage: discount.percentage,
      priceType,
      pricingSnapshot: preparedItems.map(item => buildPricingSnapshot(item, {
        baseAmount, // Only slot base amount
        discountAmount: discount.amount,
        discountPercentage: discount.percentage,
        finalAmount, // Full final
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
      description: `Created ${facility} checkout ${bulkId}. Base: ₹${baseAmount}, Lounge: ₹${loungeAmount}, Products: ₹${productAmount}. Discount: ₹${discount.amount}. Final: ₹${finalAmount}`,
      newValue: {
        bulkId,
        facility,
        itemCount: preparedItems.length,
        baseAmount,
        loungeAmount,
        productAmount,
        discountAmount: discount.amount,
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

function findDevConflict(items: CheckoutItem[], facility: string) {
  const store = getDevStore();
  return store.bookings.find((booking) => (
    booking.facility === facility &&
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
