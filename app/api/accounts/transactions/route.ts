import { type NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import dbConnect from '@/lib/db';
import PaymentEntry from '@/models/PaymentEntry';
import InventoryTransaction from '@/models/InventoryTransaction';
import Booking from '@/models/Booking';
import AccountTransaction from '@/models/AccountTransaction';
import User from '@/models/User';
import Position from '@/models/Position';
import { errorResponse, successResponse, parsePagination, paginate } from '@/lib/utils';
import { isDevFallbackEnabled, getDevStore, devUserRef } from '@/lib/dev-store';
import { checkPermission } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('Unauthorized', 401);

    const permission = await checkPermission(session.user.id, 'accounts_finance', 'view_transactions');
    if (!permission.allowed) return errorResponse('Forbidden', 403);

    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'all'; // all, bookings, sales, manual
    const limit = Number(searchParams.get('limit')) || 100;

    try {
      await dbConnect();
    } catch (dbError) {
      if (!isDevFallbackEnabled()) throw dbError;
      const store = getDevStore();
      let devTxns: any[] = [];
      
      if (['all', 'bookings'].includes(filter)) {
        const devBookingTxns = store.accountTransactions.filter(t => t.source === 'booking');
        const devTxnBookingIds = new Set(devBookingTxns.map(t => t.bookingId));
        
        devTxns.push(...devBookingTxns.map((t) => {
          const user = devUserRef(t.createdBy);
          return {
            _id: t._id,
            type: 'booking',
            date: t.date,
            amount: t.type === 'expense' ? -t.amount : t.amount,
            customerName: t.customerName || 'Unknown Customer',
            customerContact: t.customerContact || '',
            summary: t.summary || 'Booking Payment',
            user: { name: user?.name, portal: 'System', position: 'Unknown' },
            details: t
          };
        }));

        devTxns.push(...store.payments.filter(p => !devTxnBookingIds.has(p.bookingId)).map((p) => {
          const booking = store.bookings.find(b => b._id === p.bookingId);
          const user = devUserRef(p.createdBy);
          return {
            _id: p._id,
            type: 'booking',
            date: p.paymentDate,
            amount: p.amountPaid,
            customerName: booking?.customerName || 'Unknown Customer',
            customerContact: booking?.contactNumber || '',
            summary: `Booking Payment (${p.paymentMode})`,
            user: { name: user?.name, portal: 'System', position: 'Unknown' },
            details: p
          };
        }));
      }

      if (['all', 'sales'].includes(filter)) {
        devTxns.push(...store.inventoryTransactions.map((s) => {
          const item = store.inventoryItems.find(i => i._id === s.itemId);
          const user = devUserRef(s.enteredBy);
          return {
            _id: s._id,
            type: s.type,
            date: s.date,
            amount: s.amount,
            customerName: s.supplier || 'Customer',
            customerContact: '',
            summary: `${s.type === 'sale' ? 'Sold' : 'Restocked'} ${s.quantity} x ${item?.name || 'Item'}`,
            user: { name: user?.name, portal: 'System', position: 'Unknown' },
            details: s
          };
        }));
      }

      if (['all', 'manual'].includes(filter)) {
        devTxns.push(...store.accountTransactions.filter(t => t.source === 'manual').map((t) => {
          const user = devUserRef(t.createdBy);
          return {
            _id: t._id,
            type: 'manual',
            date: t.date,
            amount: t.type === 'expense' ? -t.amount : t.amount,
            customerName: t.customerName || 'Manual Entry',
            customerContact: t.customerContact || '',
            summary: t.summary || 'Manual Entry',
            user: { name: user?.name, portal: 'System', position: 'Unknown' },
            details: t
          };
        }));
      }

      devTxns.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      if (devTxns.length > limit) devTxns = devTxns.slice(0, limit);

      return successResponse({ transactions: devTxns });
    }
    
    let transactions: any[] = [];

    // 1. Fetch Bookings
    if (['all', 'bookings'].includes(filter)) {
      const bookingTxns = await AccountTransaction.find({ source: 'booking' })
        .populate({
          path: 'createdBy',
          select: 'name userType portalType positionId',
          populate: { path: 'positionId', select: 'title', model: Position }
        })
        .sort({ date: -1 })
        .limit(limit)
        .lean();

      const txnBookingIds = new Set(bookingTxns.map(t => t.bookingId?.toString()));

      for (const t of bookingTxns) {
        const user = t.createdBy as any;
        transactions.push({
          _id: t._id,
          type: 'booking',
          date: t.date,
          amount: t.type === 'expense' ? -t.amount : t.amount,
          customerName: t.customerName || 'Unknown Customer',
          customerContact: t.customerContact || '',
          summary: t.summary || 'Booking Payment',
          user: {
            name: user?.name,
            portal: user?.portalType,
            position: user?.positionId?.title || user?.userType
          },
          details: t
        });
      }

      const payments = await PaymentEntry.find()
        .populate('bookingId')
        .populate({
          path: 'createdBy',
          select: 'name userType portalType positionId',
          populate: { path: 'positionId', select: 'title', model: Position }
        })
        .sort({ paymentDate: -1 })
        .limit(limit)
        .lean();

      for (const p of payments) {
        const booking = p.bookingId as any;
        if (txnBookingIds.has(booking?._id?.toString())) continue;

        const user = p.createdBy as any;
        transactions.push({
          _id: p._id,
          type: 'booking',
          date: p.paymentDate,
          amount: p.amountPaid,
          customerName: booking?.customerName || 'Unknown Customer',
          customerContact: booking?.contactNumber || '',
          summary: `Booking Payment (${p.paymentMode})`,
          user: {
            name: user?.name,
            portal: user?.portalType,
            position: user?.positionId?.title || user?.userType
          },
          details: p
        });
      }
    }

    // 2. Fetch Sales
    if (['all', 'sales'].includes(filter)) {
      const sales = await InventoryTransaction.find({ type: 'sale' })
        .populate('itemId')
        .populate({
          path: 'enteredBy',
          select: 'name userType portalType positionId',
          populate: { path: 'positionId', select: 'title', model: Position }
        })
        .sort({ date: -1 })
        .limit(limit)
        .lean();

      for (const s of sales) {
        const item = s.itemId as any;
        const user = s.enteredBy as any;
        transactions.push({
          _id: s._id,
          type: 'sale',
          date: s.date,
          amount: s.amount,
          customerName: s.customerName || 'Walk-in Customer',
          customerContact: s.customerContact || '',
          summary: `Sold ${s.quantity} x ${item?.name || 'Item'}`,
          user: {
            name: user?.name,
            portal: user?.portalType,
            position: user?.positionId?.title || user?.userType
          },
          details: s
        });
      }
    }

    // 3. Fetch Manual Entries from the new AccountTransaction model
    if (['all', 'manual'].includes(filter)) {
      const manualTxns = await AccountTransaction.find({ source: 'manual' })
        .populate({
          path: 'createdBy',
          select: 'name userType portalType positionId',
          populate: { path: 'positionId', select: 'title', model: Position }
        })
        .sort({ date: -1 })
        .limit(limit)
        .lean();

      for (const t of manualTxns) {
        const user = t.createdBy as any;
        transactions.push({
          _id: t._id,
          type: 'manual',
          date: t.date,
          amount: t.type === 'expense' ? -t.amount : t.amount,
          customerName: 'Manual Entry',
          customerContact: '',
          summary: t.summary || 'Manual Entry',
          user: {
            name: user?.name || 'System',
            portal: user?.portalType || 'System',
            position: user?.positionId?.title || user?.userType || 'Unknown'
          },
          details: t
        });
      }
    }

    // Sort combined
    transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    if (transactions.length > limit) {
      transactions = transactions.slice(0, limit);
    }

    return successResponse({ transactions });

  } catch (error: any) {
    console.error('GET /api/accounts/transactions error:', error);
    return errorResponse(error?.message || 'Failed to fetch transactions', 500);
  }
}
