import { type NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import dbConnect from '@/lib/db';
import MeetingMinutes from '@/models/MeetingMinutes';
import MaintenanceTask from '@/models/MaintenanceTask';
import { auditAction } from '@/lib/audit';
import { successResponse, errorResponse, getRequestMeta } from '@/lib/utils';
import { createDevId, devUserRef, getDevStore, isDevFallbackEnabled, type DevMomRecord } from '@/lib/dev-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('Unauthorized', 401);
    try {
      await dbConnect();
    } catch (error) {
      if (!isDevFallbackEnabled()) throw error;
      const records = getDevStore().momRecords
        .slice()
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 50)
        .map((record) => ({ ...record, createdBy: devUserRef(record.createdBy) }));
      return successResponse(records);
    }
    const records = await MeetingMinutes.find()
      .populate('createdBy', 'name')
      .sort({ date: -1 })
      .limit(50);
    return successResponse(records);
  } catch (error) {
    console.error('GET /api/mom error:', error);
    return errorResponse('Failed to fetch MOM records', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('Unauthorized', 401);
    const body = await request.json();
    const { date, attendees, pointsEnglish, decisions } = body;
    if (!date) return errorResponse('Meeting date is required');
    if (!pointsEnglish?.trim()) return errorResponse('Meeting points are required');
    let useDevStore = false;
    try {
      await dbConnect();
    } catch (error) {
      if (!isDevFallbackEnabled()) throw error;
      useDevStore = true;
    }

    if (useDevStore) {
      const store = getDevStore();
      const pendingTasks = store.maintenanceTasks.filter((task) => ['open', 'in_progress', 'completed'].includes(task.status));
      const pendingTasksSummary = pendingTasks.map((task) => `[${task.status.toUpperCase()}] ${task.title} - Assigned to ${devUserRef(task.assigneeId)?.name || 'Unknown'}`).join('\n');
      const now = new Date().toISOString();
      const record: DevMomRecord = {
        _id: createDevId('mom'),
        date: new Date(date).toISOString(),
        attendees: attendees || [],
        pointsEnglish: pointsEnglish.trim(),
        pointsMalayalam: '',
        decisions: decisions || [],
        pendingTasksSummary,
        linkedTaskIds: pendingTasks.map((task) => task._id),
        createdBy: session.user.id,
        createdAt: now,
        updatedAt: now,
      };
      store.momRecords.unshift(record);
      return successResponse(record, 'MOM saved', 201);
    }

    // Auto-pull pending/overdue tasks
    const pendingTasks = await MaintenanceTask.find({
      status: { $in: ['open', 'in_progress', 'completed'] },
    }).populate('assigneeId', 'name').limit(50);

    const pendingTasksSummary = pendingTasks.map(
      (t) => `[${t.status.toUpperCase()}] ${t.title} — Assigned to ${(t.assigneeId as any)?.name || 'Unknown'}`
    ).join('\n');

    const record = await MeetingMinutes.create({
      date: new Date(date),
      attendees: attendees || [],
      pointsEnglish: pointsEnglish.trim(),
      decisions: decisions || [],
      pendingTasksSummary,
      linkedTaskIds: pendingTasks.map((t) => t._id),
      createdBy: session.user.id,
    });

    const meta = getRequestMeta(request.headers);
    await auditAction({ userId: session.user.id, userName: session.user.name || '', userType: session.user.userType, action: 'create_mom_entry', module: 'malayalam_mom', recordId: record._id, description: `Created MOM for ${new Date(date).toLocaleDateString()}`, ...meta }, request.headers);

    return successResponse(record, 'MOM saved', 201);
  } catch (error) {
    console.error('POST /api/mom error:', error);
    return errorResponse('Failed to save MOM', 500);
  }
}
