import { type NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import Position from '@/models/Position';
import AccountTransaction from '@/models/AccountTransaction';
import InventoryTransaction from '@/models/InventoryTransaction';
import CashSettlement from '@/models/CashSettlement';
import Notification from '@/models/Notification';
import { errorResponse, successResponse } from '@/lib/utils';
import { isDevFallbackEnabled } from '@/lib/dev-store';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('Unauthorized', 401);
    if (session.user.userType !== 'superadmin' && session.user.userType !== 'management') {
      return errorResponse('Forbidden', 403);
    }

    try {
      await dbConnect();
    } catch (dbError) {
      if (!isDevFallbackEnabled()) throw dbError;
      return successResponse({ users: [] }); 
    }

    // Get all users who could receive cash
    const users = await User.find({ userType: { $ne: 'superadmin' } })
      .populate('positionId', 'title', Position)
      .lean();

    const userCashData = [];

    for (const user of users) {
      // Total cash assigned via Bookings
      const accountTxns = await AccountTransaction.find({ receivedBy: user._id }).lean();
      const bookingCash = accountTxns.reduce((sum, t) => sum + t.amount, 0);

      // Total cash assigned via Sales
      const inventoryTxns = await InventoryTransaction.find({ receivedBy: user._id, type: 'sale' }).lean();
      const salesCash = inventoryTxns.reduce((sum, t) => sum + t.amount, 0);

      const totalCashAssigned = bookingCash + salesCash;

      // Total cash settled
      const settlements = await CashSettlement.find({ userId: user._id }).lean();
      const totalCashSettled = settlements.reduce((sum, s) => sum + s.amount, 0);

      const balance = totalCashAssigned - totalCashSettled;

      if (totalCashAssigned > 0) {
        userCashData.push({
          userId: user._id,
          name: user.name,
          portalType: user.portalType,
          position: (user.positionId as any)?.title || 'User',
          totalCashAssigned,
          totalCashSettled,
          balance,
          lastSettlement: settlements.length > 0 ? settlements[0].settledAt : null
        });
      }
    }

    return successResponse({ users: userCashData });

  } catch (error) {
    console.error('GET /api/accounts/cash-assignment error:', error);
    return errorResponse('Failed to fetch cash assignments', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('Unauthorized', 401);
    if (session.user.userType !== 'superadmin' && session.user.userType !== 'management') {
      return errorResponse('Forbidden', 403);
    }

    const { userId, amount, referenceNote } = await request.json();
    if (!userId || !amount) return errorResponse('User ID and amount are required');
    if (amount <= 0) return errorResponse('Amount must be positive');

    await dbConnect();

    const settlement = await CashSettlement.create({
      userId,
      amount,
      settledBy: session.user.id,
      referenceNote: referenceNote || ''
    });

    await Notification.create({
      userId,
      type: 'cash_settled',
      title: 'Cash Settled',
      message: `Your cash balance of ₹${amount} has been successfully settled.`,
      moduleKey: 'cash-assignment',
      recordId: settlement._id,
    });



    return successResponse({ settlement }, 'Cash settled successfully', 201);
  } catch (error) {
    console.error('POST /api/accounts/cash-assignment error:', error);
    return errorResponse('Failed to settle cash', 500);
  }
}
