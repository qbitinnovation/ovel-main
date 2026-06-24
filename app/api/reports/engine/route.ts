import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import dbConnect from '@/lib/db';
import Booking from '@/models/Booking';
import MaintenanceTask from '@/models/MaintenanceTask';
import Complaint from '@/models/Complaint';
import ReportSnapshot from '@/models/ReportSnapshot';
import Anomaly from '@/models/Anomaly';
import { getDevStore, isDevFallbackEnabled } from '@/lib/dev-store';
import { successResponse, errorResponse } from '@/lib/utils';

async function calculateAnomalies() {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // 1. Maintenance Delays
  // Tasks that are open/in_progress and past due, or completed past due
  const delayedTasks = await MaintenanceTask.find({
    $or: [
      { status: { $in: ['open', 'in_progress', 'overdue'] }, dueDate: { $lt: now } },
      { status: { $in: ['completed', 'closed'] }, $expr: { $gt: ['$completedAt', '$dueDate'] } }
    ]
  });

  for (const task of delayedTasks) {
    const existing = await Anomaly.findOne({ referenceId: task._id, type: 'maintenance_delay' });
    if (!existing) {
      await Anomaly.create({
        type: 'maintenance_delay',
        severity: task.priority === 'urgent' || task.priority === 'high' ? 'high' : 'medium',
        title: `Maintenance Delay: ${task.title}`,
        description: `Task was due on ${task.dueDate.toLocaleDateString()} but is currently ${task.status}.`,
        referenceId: task._id,
        referenceModel: 'MaintenanceTask',
      });
    }
  }

  // 2. Late Payments
  // Bookings that are past bookingDate but not paid
  const lateBookings = await Booking.find({
    paymentStatus: { $in: ['pending', 'partial'] },
    bookingDate: { $lt: startOfToday }
  });

  for (const booking of lateBookings) {
    const existing = await Anomaly.findOne({ referenceId: booking._id, type: 'late_payment' });
    if (!existing) {
      await Anomaly.create({
        type: 'late_payment',
        severity: 'high',
        title: `Late Payment: ${booking.customerName || 'Unknown'}`,
        description: `Booking on ${booking.bookingDate?.toLocaleDateString() || 'Unknown'} has ${booking.paymentStatus} payment. Expected: ${booking.expectedAmount}`,
        referenceId: booking._id,
        referenceModel: 'Booking',
      });
    }
  }

  // 3. Sales Drop
  // Compare this month to last month
  const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const thisMonthBookings = await Booking.aggregate([
    { $match: { bookingDate: { $gte: firstDayThisMonth }, bookingStatus: 'confirmed' } },
    { $group: { _id: null, total: { $sum: '$expectedAmount' } } }
  ]);
  const thisMonthTotal = thisMonthBookings[0]?.total || 0;

  const lastMonthBookings = await Booking.aggregate([
    { $match: { bookingDate: { $gte: firstDayLastMonth, $lt: firstDayThisMonth }, bookingStatus: 'confirmed' } },
    { $group: { _id: null, total: { $sum: '$expectedAmount' } } }
  ]);
  const lastMonthTotal = lastMonthBookings[0]?.total || 0;

  if (lastMonthTotal > 0 && thisMonthTotal < lastMonthTotal * 0.8) {
    // Drop of more than 20%
    const existing = await Anomaly.findOne({ type: 'sales_drop', 'detectedAt': { $gte: firstDayThisMonth } });
    if (!existing) {
      await Anomaly.create({
        type: 'sales_drop',
        severity: 'critical',
        title: `Sales Drop Detected`,
        description: `Revenue this month (${thisMonthTotal}) is significantly lower than last month (${lastMonthTotal}).`,
      });
    }
  }
}

async function getOrCreateDailySnapshot(date: Date) {
  const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);
  
  const dateStr = `${startOfDay.getFullYear()}-${String(startOfDay.getMonth() + 1).padStart(2, '0')}-${String(startOfDay.getDate()).padStart(2, '0')}`;

  let snapshot = await ReportSnapshot.findOne({ type: 'daily', dateStr });
  
  if (!snapshot) {
    const bookings = await Booking.find({ bookingDate: { $gte: startOfDay, $lt: endOfDay }, bookingStatus: 'confirmed' });
    const totalRevenue = bookings.reduce((sum, b) => sum + (b.expectedAmount || 0), 0);
    const totalBookings = bookings.length;

    const completedTasks = await MaintenanceTask.countDocuments({ completedAt: { $gte: startOfDay, $lt: endOfDay } });
    const pendingTasks = await MaintenanceTask.countDocuments({ status: { $in: ['open', 'in_progress'] }, createdAt: { $lt: endOfDay } });
    
    const complaintsReceived = await Complaint.countDocuments({ createdAt: { $gte: startOfDay, $lt: endOfDay } });
    const complaintsResolved = await Complaint.countDocuments({ resolvedAt: { $gte: startOfDay, $lt: endOfDay } });

    snapshot = await ReportSnapshot.create({
      type: 'daily',
      dateStr,
      timestamp: startOfDay,
      metrics: {
        totalRevenue,
        totalExpenses: 0,
        netProfit: totalRevenue,
        totalBookings,
        tasksCompleted: completedTasks,
        tasksPending: pendingTasks,
        complaintsReceived,
        complaintsResolved
      }
    });
  }
  return snapshot;
}

export async function GET(request: Request) {
  try {
    let useDevStore = false;
    try {
      await dbConnect();
    } catch (error) {
      if (!isDevFallbackEnabled()) throw error;
      useDevStore = true;
    }

    if (useDevStore) {
      const store = getDevStore() as any;
      return successResponse({
        message: 'Dev store lazy aggregation skipped',
        anomalies: store.anomalies || [],
        snapshot: null
      });
    }

    // Lazy evaluation of snapshots and anomalies
    await calculateAnomalies();

    // Generate snapshot for yesterday if missing
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    await getOrCreateDailySnapshot(yesterday);

    // Also get today's live data
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    const todaysBookings = await Booking.find({ bookingDate: { $gte: startOfToday }, bookingStatus: 'confirmed' });
    const todayRevenue = todaysBookings.reduce((sum, b) => sum + (b.expectedAmount || 0), 0);
    const pendingTasksCount = await MaintenanceTask.countDocuments({ status: { $in: ['open', 'in_progress'] } });
    
    const activeAnomalies = await Anomaly.find({ status: 'active' }).sort({ detectedAt: -1 }).limit(10);

    return successResponse({
      live: {
        todayRevenue,
        todayBookings: todaysBookings.length,
        pendingTasks: pendingTasksCount
      },
      anomalies: activeAnomalies
    });

  } catch (error) {
    console.error('Reports Engine Error:', error);
    return errorResponse(error instanceof Error ? error.message : 'Failed to run reporting engine', 500);
  }
}
