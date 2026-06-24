import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import dbConnect from '@/lib/db';
import MaintenanceTask from '@/models/MaintenanceTask';
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
        totalResolved: 0,
        totalPending: 0,
        delayAnomalies: []
      });
    }

    const url = new URL(request.url);
    const filter = url.searchParams.get('filter') || 'all';

    let dateQuery = {};
    const now = new Date();
    if (filter === 'month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      dateQuery = { createdAt: { $gte: startOfMonth } };
    } else if (filter === 'year') {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      dateQuery = { createdAt: { $gte: startOfYear } };
    }

    const tasks = await MaintenanceTask.find({ ...dateQuery });
    
    const totalResolved = tasks.filter(t => t.status === 'completed' || t.status === 'closed').length;
    const totalPending = tasks.filter(t => t.status === 'open' || t.status === 'in_progress' || t.status === 'overdue').length;

    // Delay Anomalies
    const delayAnomalies = await Anomaly.find({ type: 'maintenance_delay', status: { $ne: 'resolved' } }).populate('referenceId');

    return successResponse({
      totalResolved,
      totalPending,
      delayAnomalies
    });

  } catch (error) {
    console.error('Maintenance Report Error:', error);
    return errorResponse('Failed to generate maintenance report', 500);
  }
}
