import mongoose from 'mongoose';
import { type NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import dbConnect from '@/lib/db';
import PaymentEntry from '@/models/PaymentEntry';
import InventoryTransaction from '@/models/InventoryTransaction';
import InventoryItem from '@/models/InventoryItem';
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
        devTxns.push(...store.inventoryTransactions.filter(s => s.type === 'sale' && !(s.supplier && s.supplier.toLowerCase().includes('booking'))).map((s) => {
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
          populate: { path: 'positionId', select: 'name', model: Position }
        })
        .populate({
          path: 'receivedBy',
          select: 'name userType portalType positionId',
          populate: { path: 'positionId', select: 'name', model: Position }
        })
        .populate({
          path: 'bookingId',
          populate: { path: 'products.itemId', model: InventoryItem }
        })
        .sort({ date: -1 })
        .limit(limit)
        .lean();

      const txnBookingIds = new Set(bookingTxns.map(t => (t.bookingId as any)?._id?.toString() || t.bookingId?.toString()));

      for (const t of bookingTxns) {
        const user = t.createdBy as any;
        const receivedUserObj = t.receivedBy as any;
        let receivedUser = null;
        if (receivedUserObj) {
          let extra = '';
          if (receivedUserObj.positionId?.name) {
            extra = receivedUserObj.positionId.name;
          } else if (receivedUserObj.portalType === 'turf') {
            extra = 'Turf Manager';
          } else if (receivedUserObj.portalType === 'shareholder') {
            extra = 'Shareholder';
          } else if (receivedUserObj.userType) {
            extra = receivedUserObj.userType.charAt(0).toUpperCase() + receivedUserObj.userType.slice(1);
          }
          
          receivedUser = {
            name: receivedUserObj.name || '—',
            portal: extra
          };
        }

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
            position: user?.positionId?.name || user?.userType
          },
          receivedUser,
          details: t
        });
      }

      const payments = await PaymentEntry.find()
        .populate({
          path: 'bookingId',
          populate: { path: 'products.itemId', model: InventoryItem }
        })
        .populate({
          path: 'createdBy',
          select: 'name userType portalType positionId',
          populate: { path: 'positionId', select: 'name', model: Position }
        })
        .sort({ paymentDate: -1 })
        .limit(limit)
        .lean();

      // Gather unique IDs from cashReceivedBy field
      const receiverIds = new Set<string>();
      for (const p of payments) {
        if (p.cashReceivedBy && mongoose.Types.ObjectId.isValid(p.cashReceivedBy)) {
          receiverIds.add(p.cashReceivedBy.toString());
        }
      }

      // Fetch users for cashReceivedBy
      const receivedUserMap = new Map<string, any>();
      if (receiverIds.size > 0) {
        const users = await User.find({ _id: { $in: Array.from(receiverIds).map(id => new mongoose.Types.ObjectId(id)) } })
          .populate({ path: 'positionId', select: 'name', model: Position })
          .lean();
        for (const u of users) {
          receivedUserMap.set(u._id.toString(), u);
        }
      }

      for (const p of payments) {
        const booking = p.bookingId as any;
        if (txnBookingIds.has(booking?._id?.toString())) continue;

        const user = p.createdBy as any;
        const receivedUserObj = p.cashReceivedBy ? receivedUserMap.get(p.cashReceivedBy.toString()) : null;
        let receivedUser = null;
        if (receivedUserObj) {
          let extra = '';
          if (receivedUserObj.positionId?.name) {
            extra = receivedUserObj.positionId.name;
          } else if (receivedUserObj.portalType === 'turf') {
            extra = 'Turf Manager';
          } else if (receivedUserObj.portalType === 'shareholder') {
            extra = 'Shareholder';
          } else if (receivedUserObj.userType) {
            extra = receivedUserObj.userType.charAt(0).toUpperCase() + receivedUserObj.userType.slice(1);
          }
          
          receivedUser = {
            name: receivedUserObj.name || '—',
            portal: extra
          };
        } else if (p.cashReceivedBy) {
          receivedUser = {
            name: p.cashReceivedBy,
            portal: ''
          };
        }

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
            position: user?.positionId?.name || user?.userType
          },
          receivedUser,
          details: p
        });
      }
    }

    // 2. Fetch Sales (Exclude those created during bookings)
    if (['all', 'sales'].includes(filter)) {
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
            position: user?.positionId?.name || user?.userType
          },
          details: s
        });
      }
    }

    // 3. Fetch Manual and Maintenance Entries from the new AccountTransaction model
    if (['all', 'manual'].includes(filter)) {
      const manualTxns = await AccountTransaction.find({ source: { $in: ['manual', 'maintenance'] } })
        .populate({
          path: 'createdBy',
          select: 'name userType portalType positionId',
          populate: { path: 'positionId', select: 'name', model: Position }
        })
        .sort({ date: -1 })
        .limit(limit)
        .lean();

      for (const t of manualTxns) {
        let user = t.createdBy as any;
        
        if ((!user || !user.name) && t.createdBy) {
          const fallback = devUserRef(t.createdBy.toString());
          if (fallback && fallback.name !== 'User') {
            user = { name: fallback.name, portalType: 'System', positionId: null, userType: 'Demo' };
          }
        }

        transactions.push({
          _id: t._id,
          type: t.source,
          date: t.date,
          amount: t.type === 'expense' ? -t.amount : t.amount,
          customerName: t.source === 'maintenance' ? 'Maintenance' : 'Manual Entry',
          customerContact: '',
          summary: t.summary || 'Manual Entry',
          user: {
            name: user?.name,
            portal: user?.portalType,
            position: user?.positionId?.name || user?.userType || 'Unknown'
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
