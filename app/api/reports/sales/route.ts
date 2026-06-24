import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import dbConnect from '@/lib/db';
import Booking from '@/models/Booking';
import Anomaly from '@/models/Anomaly';
import { getDevStore, isDevFallbackEnabled } from '@/lib/dev-store';
import { successResponse, errorResponse } from '@/lib/utils';
import { auth } from '@/lib/auth';

function calculateHours(startTime: string, endTime: string): number {
  if (!startTime || !endTime) return 0;
  const parseTime = (time: string) => {
    const [t, m] = time.split(' ');
    let [hours, minutes] = t.split(':').map(Number);
    if (m === 'PM' && hours !== 12) hours += 12;
    if (m === 'AM' && hours === 12) hours = 0;
    return hours + minutes / 60;
  };
  let duration = parseTime(endTime) - parseTime(startTime);
  if (duration < 0) duration += 24; // Handle overnight slots
  return duration;
}

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
        totalUsageHours: 0,
        totalBookings: 0,
        salesDrops: [],
        peakHour: 'N/A'
      });
    }

    const url = new URL(request.url);
    const filter = url.searchParams.get('filter') || 'all';

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
    
    let totalUsageHours = 0;
    const hourCounts: Record<string, number> = {};

    bookings.forEach(b => {
      if (b.bookingType === 'standard' && b.startTime && b.endTime) {
        totalUsageHours += calculateHours(b.startTime, b.endTime);
        hourCounts[b.startTime] = (hourCounts[b.startTime] || 0) + 1;
      } else if (b.bookingType === 'bulk' && b.slots) {
        b.slots.forEach(slot => {
          totalUsageHours += calculateHours(slot.startTime, slot.endTime);
          hourCounts[slot.startTime] = (hourCounts[slot.startTime] || 0) + 1;
        });
      }
    });

    let peakHour = 'N/A';
    let maxCount = 0;
    for (const [hour, count] of Object.entries(hourCounts)) {
      if (count > maxCount) {
        maxCount = count;
        peakHour = hour;
      }
    }

    // Sales Drop Anomalies
    const salesDrops = await Anomaly.find({ type: 'sales_drop' }).sort({ detectedAt: -1 }).limit(5);

    return successResponse({
      totalUsageHours,
      totalBookings: bookings.length,
      peakHour,
      salesDrops
    });

  } catch (error) {
    console.error('Sales Report Error:', error);
    return errorResponse('Failed to generate sales report', 500);
  }
}
