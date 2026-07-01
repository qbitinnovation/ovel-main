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
      .populate({ path: 'linkedTaskIds', select: 'title priority dueDate status assigneeId estimatedCost actualCost', populate: { path: 'assigneeId', select: 'name' } })
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
    const { action, id, date, attendees, pointsEnglish, pointsMalayalam, decisions, tasks } = body;
    
    const { checkPermission } = await import('@/lib/permissions');
    
    // Check permissions based on action
    if (action === 'update') {
      const perm = await checkPermission(session.user.id, 'malayalam_mom', 'edit_mom');
      if (!perm.allowed) return errorResponse('Forbidden: Missing edit_mom permission', 403);
      if (!id) return errorResponse('MOM ID is required for update', 400);
    } else {
      const perm = await checkPermission(session.user.id, 'malayalam_mom', 'create_mom_entry');
      if (!perm.allowed) return errorResponse('Forbidden: Missing create_mom_entry permission', 403);
    }

    if (!date) return errorResponse('Meeting date is required');
    if (!pointsEnglish?.trim()) return errorResponse('Meeting points are required');
    
    let useDevStore = false;
    try {
      await dbConnect();
    } catch (error) {
      if (!isDevFallbackEnabled()) throw error;
      useDevStore = true;
    }

    const meta = getRequestMeta(request.headers);

    if (useDevStore) {
      const store = getDevStore();
      const now = new Date().toISOString();
      
      if (action === 'update') {
        const index = store.momRecords.findIndex(r => r._id === id);
        if (index === -1) return errorResponse('MOM record not found', 404);
        
        store.momRecords[index] = {
          ...store.momRecords[index],
          date: new Date(date).toISOString(),
          attendees: attendees || [],
          pointsEnglish: pointsEnglish.trim(),
          pointsMalayalam: pointsMalayalam || '',
          decisions: decisions || [],
          updatedAt: now,
        };
        return successResponse(store.momRecords[index], 'MOM updated', 200);
      } else {
        const record: DevMomRecord = {
          _id: createDevId('mom'),
          date: new Date(date).toISOString(),
          attendees: attendees || [],
          pointsEnglish: pointsEnglish.trim(),
          pointsMalayalam: pointsMalayalam || '',
          decisions: decisions || [],
          pendingTasksSummary: '',
          linkedTaskIds: [],
          createdBy: session.user.id,
          createdAt: now,
          updatedAt: now,
        };
        store.momRecords.unshift(record);
        return successResponse(record, 'MOM saved', 201);
      }
    }

    if (action === 'update') {
      const record = await MeetingMinutes.findByIdAndUpdate(
        id,
        {
          date: new Date(date),
          attendees: attendees || [],
          pointsEnglish: pointsEnglish.trim(),
          pointsMalayalam: pointsMalayalam || '',
          decisions: decisions || [],
        },
        { new: true }
      );
      
      if (!record) return errorResponse('MOM record not found', 404);
      
      await auditAction({ userId: session.user.id, userName: session.user.name || '', userType: session.user.userType, action: 'edit_mom', module: 'malayalam_mom', recordId: record._id, description: `Updated MOM for ${new Date(date).toLocaleDateString()}`, ...meta }, request.headers);
      
      return successResponse(record, 'MOM updated', 200);
    } else {
      const record = await MeetingMinutes.create({
        date: new Date(date),
        attendees: attendees || [],
        pointsEnglish: pointsEnglish.trim(),
        pointsMalayalam: pointsMalayalam || '',
        decisions: decisions || [],
        linkedTaskIds: [],
        createdBy: session.user.id,
      });

      let linkedTaskIds = [];
      if (tasks && Array.isArray(tasks) && tasks.length > 0) {
        for (const t of tasks) {
          const newTask = await MaintenanceTask.create({
            title: t.title,
            priority: t.priority.toLowerCase(),
            dueDate: new Date(t.dueDate),
            assigneeId: t.assigneeId,
            creatorId: session.user.id,
            status: 'open',
            estimatedCost: t.estimatedCost ? Number(t.estimatedCost) : 0,
            actualCost: 0,
            linkedMomId: record._id
          });
          linkedTaskIds.push(newTask._id);
        }
        record.linkedTaskIds = linkedTaskIds;
        await record.save();
      }

      await auditAction({ userId: session.user.id, userName: session.user.name || '', userType: session.user.userType, action: 'create_mom_entry', module: 'malayalam_mom', recordId: record._id, description: `Created MOM for ${new Date(date).toLocaleDateString()}`, ...meta }, request.headers);

      return successResponse(record, 'MOM saved', 201);
    }
  } catch (error) {
    console.error('POST /api/mom error:', error);
    return errorResponse('Failed to save MOM', 500);
  }
}
