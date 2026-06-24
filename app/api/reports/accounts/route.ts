import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import dbConnect from '@/lib/db';
import Booking from '@/models/Booking';
import Anomaly from '@/models/Anomaly';
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
        totalRevenue: 0,
        outstandingBalances: 0,
        thisMonthRevenue: 0,
        lastMonthRevenue: 0,
        latePayments: []
      });
    }

    const url = new URL(request.url);
    const filter = url.searchParams.get('filter') || 'all'; // all, month, year

    let dateQuery = {};
    const now = new Date();
    if (filter === 'month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      dateQuery = { bookingDate: { $gte: startOfMonth } };
    } else if (filter === 'year') {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      dateQuery = { bookingDate: { $gte: startOfYear } };
    }

    const bookings = await Booking.find({ bookingStatus: 'confirmed', ...dateQuery });
    
    const totalRevenue = bookings.reduce((sum, b) => sum + (b.totalPaid || 0), 0);
    const outstandingBalances = bookings.reduce((sum, b) => {
      const remaining = b.expectedAmount - (b.totalPaid || 0);
      return sum + (remaining > 0 ? remaining : 0);
    }, 0);

    // MoM data
    const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const thisMonthBookings = await Booking.find({ bookingDate: { $gte: firstDayThisMonth }, bookingStatus: 'confirmed' });
    const thisMonthRevenue = thisMonthBookings.reduce((sum, b) => sum + (b.totalPaid || 0), 0);

    const lastMonthBookings = await Booking.find({ bookingDate: { $gte: firstDayLastMonth, $lt: firstDayThisMonth }, bookingStatus: 'confirmed' });
    const lastMonthRevenue = lastMonthBookings.reduce((sum, b) => sum + (b.totalPaid || 0), 0);

    // Late Payments Anomalies
    const latePayments = await Anomaly.find({ type: 'late_payment', status: { $ne: 'resolved' } }).populate('referenceId');

    return successResponse({
      totalRevenue,
      outstandingBalances,
      thisMonthRevenue,
      lastMonthRevenue,
      latePayments
    });

  } catch (error) {
    console.error('Accounts Report Error:', error);
    return errorResponse('Failed to generate accounts report', 500);
  }
}
