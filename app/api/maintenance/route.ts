import { type NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import dbConnect from '@/lib/db';
import MaintenanceTask from '@/models/MaintenanceTask';
import { auditAction } from '@/lib/audit';
import { successResponse, errorResponse, sanitizeInput, getRequestMeta, parsePagination, paginate } from '@/lib/utils';
import { createDevId, devUserRef, getDevStore, isDevFallbackEnabled, type DevMaintenanceTask } from '@/lib/dev-store';
import { checkPermission } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('Unauthorized', 401);

    const permission = await checkPermission(session.user.id, 'maintenance_tasks', 'view_all_tasks');
    if (!permission.allowed) return errorResponse('Forbidden', 403);

    const sp = request.nextUrl.searchParams;
    const { page, limit } = parsePagination(sp);
    const status = sp.get('status');
    const priority = sp.get('priority');
    const assigneeId = sp.get('assigneeId');

    try {
      await dbConnect();
    } catch (error) {
      if (!isDevFallbackEnabled()) throw error;
      const store = getDevStore();
      let tasks = store.maintenanceTasks;
      if (status) tasks = tasks.filter((task) => task.status === status);
      if (priority) tasks = tasks.filter((task) => task.priority === priority);
      if (assigneeId) tasks = tasks.filter((task) => task.assigneeId === assigneeId);
      const total = tasks.length;
      const pagination = paginate({ page, limit, total });
      const pagedTasks = tasks.slice(pagination.skip, pagination.skip + limit).map((task) => ({
        ...task,
        assigneeId: devUserRef(task.assigneeId),
        creatorId: devUserRef(task.creatorId),
      }));
      return successResponse({ tasks: pagedTasks, pagination });
    }

    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (assigneeId) filter.assigneeId = assigneeId;

    const total = await MaintenanceTask.countDocuments(filter);
    const pagination = paginate({ page, limit, total });

    const tasks = await MaintenanceTask.find(filter)
      .populate('assigneeId', 'name')
      .populate('creatorId', 'name')
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(limit);

    return successResponse({ tasks, pagination });
  } catch (error) {
    console.error('GET /api/maintenance error:', error);
    return errorResponse('Failed to fetch tasks', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('Unauthorized', 401);

    const permission = await checkPermission(session.user.id, 'maintenance_tasks', 'create_task');
    if (!permission.allowed) return errorResponse('Forbidden', 403);

    const body = await request.json();
    const { title, description, location, priority, dueDate, assigneeId } = body;

    if (!title?.trim()) return errorResponse('Task title is required');
    if (!dueDate) return errorResponse('Due date is mandatory');
    if (!assigneeId) return errorResponse('Assignee is required');
    if (!priority || !['low', 'medium', 'high', 'urgent'].includes(priority)) {
      return errorResponse('Valid priority is required');
    }

    let useDevStore = false;
    try {
      await dbConnect();
    } catch (error) {
      if (!isDevFallbackEnabled()) throw error;
      useDevStore = true;
    }

    if (useDevStore) {
      const now = new Date().toISOString();
      const task: DevMaintenanceTask = {
        _id: createDevId('task'),
        title: sanitizeInput(title),
        description: description ? sanitizeInput(description) : '',
        location: location ? sanitizeInput(location) : '',
        priority,
        dueDate: new Date(dueDate).toISOString(),
        assigneeId,
        creatorId: session.user.id,
        status: 'open',
        resolutionNote: '',
        statusHistory: [{ status: 'open', changedBy: session.user.id, changedAt: now, note: 'Task created' }],
        closedAt: null,
        closedBy: null,
        completedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      getDevStore().maintenanceTasks.unshift(task);
      return successResponse({ ...task, assigneeId: devUserRef(assigneeId), creatorId: devUserRef(session.user.id) }, 'Task created', 201);
    }

    const task = await MaintenanceTask.create({
      title: sanitizeInput(title),
      description: description ? sanitizeInput(description) : '',
      location: location ? sanitizeInput(location) : '',
      priority,
      dueDate: new Date(dueDate),
      assigneeId,
      creatorId: session.user.id,
      status: 'open',
      statusHistory: [{
        status: 'open',
        changedBy: session.user.id,
        changedAt: new Date(),
        note: 'Task created',
      }],
    });

    const meta = getRequestMeta(request.headers);
    await auditAction({
      userId: session.user.id,
      userName: session.user.name || '',
      userType: session.user.userType,
      action: 'create_task',
      module: 'maintenance_tasks',
      recordId: task._id,
      description: `Created task "${task.title}" (${priority}) due ${new Date(dueDate).toLocaleDateString()}`,
      newValue: { title: task.title, priority, dueDate },
      ...meta,
    }, request.headers);

    return successResponse(task, 'Task created', 201);
  } catch (error) {
    console.error('POST /api/maintenance error:', error);
    return errorResponse('Failed to create task', 500);
  }
}
