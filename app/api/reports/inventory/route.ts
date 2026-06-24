import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import dbConnect from '@/lib/db';
import InventoryItem from '@/models/InventoryItem';
import InventoryTransaction from '@/models/InventoryTransaction';
import { getDevStore, isDevFallbackEnabled } from '@/lib/dev-store';
import { successResponse, errorResponse } from '@/lib/utils';
import { auth } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('Unauthorized', 401);
    
    let useDevStore = false;
    try {
      await dbConnect();
    } catch (error) {
      if (!isDevFallbackEnabled()) throw error;
      useDevStore = true;
    }

    if (useDevStore) {
      return successResponse({
        totalItems: 0,
        lowStockItems: [],
        totalUsage: 0
      });
    }

    const url = new URL(request.url);
    const filter = url.searchParams.get('filter') || 'all';

    let dateQuery = {};
    const now = new Date();
    if (filter === 'month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      dateQuery = { date: { $gte: startOfMonth } };
    } else if (filter === 'year') {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      dateQuery = { date: { $gte: startOfYear } };
    }

    const items = await InventoryItem.find({});
    const totalItems = items.length;
    const lowStockItems = items.filter(i => i.currentStock < (i.lowStockThreshold || 5));

    const transactions = await InventoryTransaction.find({ type: 'sale', ...dateQuery });
    const totalUsage = transactions.reduce((sum, t) => sum + t.quantity, 0);

    return successResponse({
      totalItems,
      lowStockItems,
      totalUsage
    });

  } catch (error) {
    console.error('Inventory Report Error:', error);
    return errorResponse('Failed to generate inventory report', 500);
  }
}
