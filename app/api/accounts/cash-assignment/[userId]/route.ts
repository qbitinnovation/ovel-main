import { type NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import dbConnect from '@/lib/db';
import AccountTransaction from '@/models/AccountTransaction';
import InventoryTransaction from '@/models/InventoryTransaction';
import CashSettlement from '@/models/CashSettlement';
import { errorResponse, successResponse } from '@/lib/utils';
import { isDevFallbackEnabled } from '@/lib/dev-store';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('Unauthorized', 401);
    if (session.user.userType !== 'superadmin' && session.user.userType !== 'management') {
      return errorResponse('Forbidden', 403);
    }

    const resolvedParams = await params;
    const { userId } = resolvedParams;
    if (!userId) return errorResponse('User ID is required');

    try {
      await dbConnect();
    } catch (dbError) {
      if (!isDevFallbackEnabled()) throw dbError;
      return successResponse({ transactions: [], summary: { totalCashAssigned: 0, totalCashSettled: 0, balance: 0, transactionCount: 0 } });
    }
    
    // Fetch bookings cash assignments
    const accountTxns = await AccountTransaction.find({ receivedBy: userId })
      .sort({ date: -1 })
      .lean();

    // Fetch sales cash assignments
    const inventoryTxns = await InventoryTransaction.find({ receivedBy: userId, type: 'sale' })
      .sort({ date: -1 })
      .lean();

    // Fetch settlements
    const settlements = await CashSettlement.find({ userId })
      .sort({ settledAt: -1 })
      .lean();

    const collections = [
      ...accountTxns.map(t => ({
        _id: t._id,
        date: t.date,
        amount: t.amount,
        source: 'Booking',
        customerName: t.customerName || 'Unknown',
        customerContact: t.customerContact || '',
        summary: t.summary || 'Booking Payment'
      })),
      ...inventoryTxns.map(t => ({
        _id: t._id,
        date: t.date,
        amount: t.amount,
        source: 'Direct Sale',
        customerName: t.customerName || 'Unknown',
        customerContact: t.customerContact || '',
        summary: `Sold ${t.quantity} items`
      }))
    ];

    // Sort oldest to newest for FIFO assignment of settlements
    collections.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const totalCashSettled = settlements.reduce((sum, s) => sum + s.amount, 0);

    let remainingSettled = totalCashSettled;
    const formattedTxns = collections.map(c => {
      let status: 'Settled' | 'Not Settled' = 'Not Settled';
      if (remainingSettled >= c.amount) {
        status = 'Settled';
        remainingSettled -= c.amount;
      } else {
        status = 'Not Settled';
        remainingSettled = 0;
      }
      return {
        ...c,
        status
      };
    });

    // Sort by date descending for display
    formattedTxns.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const totalCashAssigned = formattedTxns.reduce((sum, t) => sum + t.amount, 0);
    
    const summary = {
      totalCashAssigned,
      totalCashSettled,
      balance: totalCashAssigned - totalCashSettled,
      transactionCount: formattedTxns.length
    };

    return successResponse({ transactions: formattedTxns, summary });

  } catch (error) {
    console.error('GET /api/accounts/cash-assignment/[userId] error:', error);
    return errorResponse('Failed to fetch user cash history', 500);
  }
}
