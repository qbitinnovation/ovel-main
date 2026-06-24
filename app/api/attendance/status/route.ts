import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { auth } from '@/lib/auth';
import dbConnect from '@/lib/db';
import Attendance from '@/models/Attendance';
import { successResponse, errorResponse } from '@/lib/utils';
import { getDevStore, isDevFallbackEnabled } from '@/lib/dev-store';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('Unauthorized', 401);

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let useDevStore = false;
    try {
      await dbConnect();
    } catch (error) {
      if (!isDevFallbackEnabled()) throw error;
      useDevStore = true;
    }

    if (useDevStore) {
      const store = getDevStore();
      const existingToday = (store as any).attendances?.find((a: any) => 
        a.userId === session.user.id && new Date(a.timestamp) >= startOfDay
      );
      
      return successResponse({
        hasSubmittedToday: !!existingToday,
        record: existingToday || null
      });
    }

    const existingToday = await Attendance.findOne({
      userId: session.user.id,
      timestamp: { $gte: startOfDay }
    }).sort({ timestamp: -1 });

    return successResponse({
      hasSubmittedToday: !!existingToday,
      record: existingToday || null
    });

  } catch (error) {
    console.error('GET /api/attendance/status error:', error);
    return errorResponse('Failed to fetch attendance status', 500);
  }
}
