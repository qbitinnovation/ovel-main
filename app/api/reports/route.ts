import { type NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import dbConnect from '@/lib/db';
import FinanceEntry from '@/models/FinanceEntry';
import MaintenanceTask from '@/models/MaintenanceTask';
import TurfInventoryItem from '@/models/TurfInventoryItem';
import Checklist from '@/models/Checklist';
import User from '@/models/User';
import Position from '@/models/Position';
import { successResponse, errorResponse } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('Unauthorized', 401);

    const sp = request.nextUrl.searchParams;
    const type = sp.get('type') || 'overview';

    await dbConnect();

    if (type === 'finance') {
      const entries = await FinanceEntry.find().sort({ date: -1 }).limit(30);
      const totalIncome = entries.reduce((s, e) => s + e.totalIncome, 0);
      const totalExpenses = entries.reduce((s, e) => s + e.totalExpenses + e.totalElectricity + e.totalOtherPayments, 0);
      return successResponse({ entries, totalIncome, totalExpenses, netProfit: totalIncome - totalExpenses });
    }

    if (type === 'maintenance') {
      const total = await MaintenanceTask.countDocuments();
      const open = await MaintenanceTask.countDocuments({ status: 'open' });
      const completed = await MaintenanceTask.countDocuments({ status: 'completed' });
      const closed = await MaintenanceTask.countDocuments({ status: 'closed' });
      const overdue = await MaintenanceTask.countDocuments({ status: { $in: ['open', 'in_progress'] }, dueDate: { $lt: new Date() } });
      return successResponse({ total, open, completed, closed, overdue });
    }

    if (type === 'inventory') {
      const items = await TurfInventoryItem.find({ isActive: true });
      const attentionItems = items.filter((i) => i.condition !== 'good' || i.quantity === 0);
      return successResponse({ totalItems: items.length, attentionCount: attentionItems.length, items });
    }

    if (type === 'checklist') {
      const total = await Checklist.countDocuments();
      const verified = await Checklist.countDocuments({ overallStatus: 'verified' });
      const pending = await Checklist.countDocuments({ overallStatus: 'pending' });
      const partial = await Checklist.countDocuments({ overallStatus: 'partially_verified' });
      return successResponse({ total, verified, pending, partial, complianceRate: total > 0 ? ((verified / total) * 100).toFixed(1) : '0' });
    }

    // Overview
    const totalUsers = await User.countDocuments({ userType: { $ne: 'superadmin' } });
    const activeUsers = await User.countDocuments({ isActive: true, isArchived: false, userType: { $ne: 'superadmin' } });
    const totalPositions = await Position.countDocuments({ isActive: true });
    const totalTasks = await MaintenanceTask.countDocuments();
    const openTasks = await MaintenanceTask.countDocuments({ status: 'open' });
    const totalEntries = await FinanceEntry.countDocuments();

    return successResponse({
      users: { total: totalUsers, active: activeUsers },
      positions: totalPositions,
      tasks: { total: totalTasks, open: openTasks },
      financeEntries: totalEntries,
    });
  } catch (error) {
    console.error('GET /api/reports error:', error);
    return errorResponse('Failed to fetch report data', 500);
  }
}
