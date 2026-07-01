import { type NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import dbConnect from '@/lib/db';
import Booking from '@/models/Booking';
import InventoryTransaction from '@/models/InventoryTransaction';
import InventoryItem from '@/models/InventoryItem';
import Position from '@/models/Position';
import { errorResponse, successResponse } from '@/lib/utils';
import { checkPermission } from '@/lib/permissions';

import AccountTransaction from '@/models/AccountTransaction';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('Unauthorized', 401);

    const permission = await checkPermission(session.user.id, 'accounts_finance', 'view_transactions');
    if (!permission.allowed) return errorResponse('Forbidden', 403);

    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get('limit')) || 200;

    await dbConnect();

    // Fetch Bookings (includes all statuses)
    const bookings = await Booking.find()
      .populate({
        path: 'createdBy',
        select: 'name userType portalType positionId',
        populate: { path: 'positionId', select: 'name', model: Position }
      })
      .populate({ path: 'products.itemId', model: InventoryItem })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    // Fetch Direct Sales (excluding sales tied to bookings)
    const sales = await InventoryTransaction.find({ 
      type: 'sale',
      supplier: { $not: { $regex: 'booking', $options: 'i' } }
    })
      .populate({ path: 'itemId', model: InventoryItem })
      .populate({
        path: 'enteredBy',
        select: 'name userType portalType positionId',
        populate: { path: 'positionId', select: 'name', model: Position }
      })
      .sort({ date: -1 })
      .limit(limit)
      .lean();

    // Fetch Expenses from AccountTransaction
    const expenses = await AccountTransaction.find({ type: 'expense' })
      .populate({
        path: 'createdBy',
        select: 'name userType portalType positionId',
        populate: { path: 'positionId', select: 'name', model: Position }
      })
      .sort({ date: -1 })
      .limit(limit)
      .lean();

    // Fetch Manual Entries from AccountTransaction
    const manualEntries = await AccountTransaction.find({ source: 'manual' })
      .populate({
        path: 'createdBy',
        select: 'name userType portalType positionId',
        populate: { path: 'positionId', select: 'name', model: Position }
      })
      .sort({ date: -1 })
      .limit(limit)
      .lean();

    return successResponse({ bookings, sales, expenses, manualEntries });
  } catch (error: any) {
    console.error('GET /api/accounts/billing error:', error);
    return errorResponse(error?.message || 'Failed to fetch billing data', 500);
  }
}
