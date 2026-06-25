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
  createDevId,
  devUserRef,
  getDevStore,
  isDevFallbackEnabled,
  type DevBooking,
  type DevInventoryTransaction,
} from '@/lib/dev-store';

export const dynamic = 'force-dynamic';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('Unauthorized', 401);

    const { checkPermission } = await import('@/lib/permissions');
    const perm = await checkPermission(session.user.id, 'bookings', 'edit_booking');
    if (!perm.allowed) return errorResponse('Forbidden', 403);

    const resolvedParams = await params;
    const bookingId = resolvedParams.id;
    if (!bookingId) return errorResponse('Booking ID is required');

    const body = await request.json() as Record<string, unknown>;
    const loungeHours = Number(body.loungeHours) || 0;
    const productsPayload = Array.isArray(body.products) ? body.products : [];

    if (loungeHours < 0) return errorResponse('Lounge hours cannot be negative');

    let useDevStore = false;
    try {
      await dbConnect();
    } catch (error) {
      if (!isDevFallbackEnabled()) throw error;
      useDevStore = true;
    }

    if (useDevStore) {
      const store = getDevStore();
      const booking = store.bookings.find(b => b._id === bookingId);
      if (!booking) return errorResponse('Booking not found', 404);
      if (booking.bookingStatus !== 'confirmed') return errorResponse('Only confirmed bookings can have addons modified');
      
      const allPricing = getDevAllFacilitiesPricingConfig();
      const loungeHourlyRate = allPricing.loungeHourlyRate || 0;
      
      const validatedProducts: Array<{ itemId: string, name: string, quantity: number, price: number }> = [];
      let addedProductAmount = 0;
      
      for (const p of productsPayload) {
        if (!p.itemId || !p.quantity || p.quantity <= 0) continue;
        const item = store.inventoryItems.find((entry) => entry._id === p.itemId);
        if (!item) return errorResponse(`Product ${p.itemId} not found`);
        if (item.currentStock < p.quantity) return errorResponse(`Insufficient stock for ${item.name}. Current: ${item.currentStock}`);
        
        const price = item.unitPrice * p.quantity;
        addedProductAmount += price;
        validatedProducts.push({
          itemId: item._id,
          name: item.name,
          quantity: p.quantity,
          price,
        });
      }

      if (loungeHours > 0) {
        const targetDate = booking.bookingDate.split('T')[0];
        const existingLounge = store.bookings.find(b => 
          b.bookingStatus === 'confirmed' &&
          b._id !== booking._id &&
          b.loungeHours > 0 &&
          b.bookingDate.split('T')[0] === targetDate
        );
        if (existingLounge) {
          return errorResponse('Lounge area is already reserved by another team for this day.');
        }
      }

      const now = new Date().toISOString();
      for (const p of validatedProducts) {
        const item = store.inventoryItems.find((entry) => entry._id === p.itemId);
        if (item) {
          item.currentStock -= p.quantity;
          item.updatedAt = now;
          store.inventoryTransactions.unshift({
            _id: createDevId('txn'),
            itemId: item._id,
            type: 'sale',
            quantity: p.quantity,
            amount: p.price,
            supplier: 'Added to existing booking',
            customerName: booking.customerName || 'Added to booking',
            customerContact: booking.contactNumber,
            date: now,
            enteredBy: session.user.id,
            createdAt: now,
            bookingId: booking._id,
          } as DevInventoryTransaction);
          
          const existingProductIndex = booking.products.findIndex(prod => prod.itemId === p.itemId);
          if (existingProductIndex >= 0) {
             booking.products[existingProductIndex].quantity += p.quantity;
             booking.products[existingProductIndex].price += p.price;
          } else {
             booking.products.push(p);
          }
        }
      }
      
      let newLoungeAmount = 0;
      if (loungeHours > 0) {
        newLoungeAmount = loungeHourlyRate;
      }

      const loungeAmountDiff = newLoungeAmount - booking.loungeAmount;
      
      booking.loungeHours = loungeHours;
      booking.loungeAmount = newLoungeAmount;
      booking.productAmount += addedProductAmount;
      booking.expectedAmount += loungeAmountDiff + addedProductAmount;
      booking.updatedAt = now;

      return successResponse({ booking: { ...booking, createdBy: devUserRef(booking.createdBy) } }, 'Add-ons updated successfully');
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) return errorResponse('Booking not found', 404);
    if (booking.bookingStatus !== 'confirmed') return errorResponse('Only confirmed bookings can have addons modified');

    const allPricing = await getAllFacilitiesPricingConfig();
    const loungeHourlyRate = allPricing.loungeHourlyRate || 0;

    const validatedProducts: Array<{ itemId: string, name: string, quantity: number, price: number }> = [];
    let addedProductAmount = 0;

    for (const p of productsPayload) {
      if (!p.itemId || !p.quantity || p.quantity <= 0) continue;
      const item = await InventoryItem.findById(p.itemId);
      if (!item) return errorResponse(`Product ${p.itemId} not found`);
      if (item.currentStock < p.quantity) return errorResponse(`Insufficient stock for ${item.name}. Current: ${item.currentStock}`);
      
      const price = item.unitPrice * p.quantity;
      addedProductAmount += price;
      validatedProducts.push({
        itemId: item._id.toString(),
        name: item.name,
        quantity: p.quantity,
        price,
      });
    }

    if (loungeHours > 0) {
      const targetDate = booking.bookingDate || (booking.slots && booking.slots[0]?.bookingDate);
      if (!targetDate) {
        return errorResponse('Booking date is missing.');
      }
      const start = new Date(targetDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(targetDate);
      end.setHours(23, 59, 59, 999);

      const existingLounge = await Booking.findOne({
        _id: { $ne: booking._id },
        bookingStatus: 'confirmed',
        loungeHours: { $gt: 0 },
        $or: [
          { bookingDate: { $gte: start, $lte: end } },
          { 'slots.bookingDate': { $gte: start, $lte: end } }
        ]
      });
      if (existingLounge) {
        return errorResponse('Lounge area is already reserved by another team for this day.');
      }
    }

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
          customerName: booking.customerName || 'Added to booking',
          supplier: 'Added to existing booking',
          customerContact: booking.contactNumber,
          date: new Date(),
          enteredBy: session.user.id,
          bookingId: booking._id,
        });

        const existingProductIndex = booking.products.findIndex(prod => prod.itemId.toString() === p.itemId);
        if (existingProductIndex >= 0) {
           booking.products[existingProductIndex].quantity += p.quantity;
           booking.products[existingProductIndex].price += p.price;
        } else {
           booking.products.push(p);
        }
      }
    }

    let newLoungeAmount = 0;
    if (loungeHours > 0) {
      newLoungeAmount = loungeHourlyRate;
    }

    const loungeAmountDiff = newLoungeAmount - booking.loungeAmount;
    
    booking.loungeHours = loungeHours;
    booking.loungeAmount = newLoungeAmount;
    booking.productAmount += addedProductAmount;
    booking.expectedAmount += loungeAmountDiff + addedProductAmount;

    await booking.save();

    const meta = getRequestMeta(request.headers);
    await auditAction({
      userId: session.user.id,
      userName: session.user.name || '',
      userType: session.user.userType,
      action: 'update_booking_addons',
      module: 'bookings',
      recordId: booking._id,
      description: `Updated add-ons for booking. Added ${loungeHours} lounge hours (diff: ₹${loungeAmountDiff}) and products worth ₹${addedProductAmount}. Expected amount is now ₹${booking.expectedAmount}.`,
      newValue: {
        loungeHours,
        loungeAmountDiff,
        addedProductAmount,
        expectedAmount: booking.expectedAmount,
      },
      ...meta,
    }, request.headers);

    return successResponse({ booking }, 'Add-ons updated successfully');
  } catch (error) {
    console.error('PUT /api/bookings/[id]/addons error:', error);
    return errorResponse(error instanceof Error ? error.message : 'Failed to update addons', 500);
  }
}
