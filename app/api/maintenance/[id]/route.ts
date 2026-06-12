import { type NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import dbConnect from '@/lib/db';
import MaintenanceTask from '@/models/MaintenanceTask';
import { auditAction } from '@/lib/audit';
import { successResponse, errorResponse, sanitizeInput, getRequestMeta } from '@/lib/utils';
import { devUserRef, getDevStore, isDevFallbackEnabled } from '@/lib/dev-store';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('Unauthorized', 401);
    const { id } = await params;
    try {
      await dbConnect();
    } catch (error) {
      if (!isDevFallbackEnabled()) throw error;
      const task = getDevStore().maintenanceTasks.find((item) => item._id === id);
      if (!task) return errorResponse('Task not found', 404);
      return successResponse({ ...task, assigneeId: devUserRef(task.assigneeId), creatorId: devUserRef(task.creatorId), closedBy: devUserRef(task.closedBy) });
    }
    const task = await MaintenanceTask.findById(id)
      .populate('assigneeId', 'name email')
      .populate('creatorId', 'name email')
      .populate('closedBy', 'name')
      .populate('statusHistory.changedBy', 'name');
    if (!task) return errorResponse('Task not found', 404);
    return successResponse(task);
  } catch (error) {
    console.error('GET /api/maintenance/[id] error:', error);
    return errorResponse('Failed to fetch task', 500);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('Unauthorized', 401);
    const { id } = await params;
    const body = await request.json();
    try {
      await dbConnect();
    } catch (error) {
      if (!isDevFallbackEnabled()) throw error;
      const task = getDevStore().maintenanceTasks.find((item) => item._id === id);
      if (!task) return errorResponse('Task not found', 404);
      if (task.status === 'closed') return errorResponse('Cannot edit a closed task');
      const { title, description, location, priority, dueDate, assigneeId } = body;
      if (title) task.title = sanitizeInput(title);
      if (description !== undefined) task.description = sanitizeInput(description);
      if (location !== undefined) task.location = sanitizeInput(location);
      if (priority) task.priority = priority;
      if (dueDate) task.dueDate = new Date(dueDate).toISOString();
      if (assigneeId) task.assigneeId = assigneeId;
      task.updatedAt = new Date().toISOString();
      return successResponse(task, 'Task updated');
    }
    const task = await MaintenanceTask.findById(id);
    if (!task) return errorResponse('Task not found', 404);
    if (task.status === 'closed') return errorResponse('Cannot edit a closed task');
    const { title, description, location, priority, dueDate, assigneeId } = body;
    if (title) task.title = sanitizeInput(title);
    if (description !== undefined) task.description = sanitizeInput(description);
    if (location !== undefined) task.location = sanitizeInput(location);
    if (priority) task.priority = priority;
    if (dueDate) task.dueDate = new Date(dueDate);
    if (assigneeId) task.assigneeId = assigneeId;
    await task.save();
    const meta = getRequestMeta(request.headers);
    await auditAction({ userId: session.user.id, userName: session.user.name || '', userType: session.user.userType, action: 'edit_task', module: 'maintenance_tasks', recordId: task._id, description: `Edited task "${task.title}"`, ...meta }, request.headers);
    return successResponse(task, 'Task updated');
  } catch (error) {
    console.error('PUT /api/maintenance/[id] error:', error);
    return errorResponse('Failed to update task', 500);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('Unauthorized', 401);
    const { id } = await params;
    const body = await request.json();
    const { action, note } = body;
    try {
      await dbConnect();
    } catch (error) {
      if (!isDevFallbackEnabled()) throw error;
      const task = getDevStore().maintenanceTasks.find((item) => item._id === id);
      if (!task) return errorResponse('Task not found', 404);
      const now = new Date().toISOString();
      switch (action) {
        case 'start':
          if (task.status !== 'open') return errorResponse('Only open tasks can be started');
          task.status = 'in_progress';
          task.statusHistory.push({ status: 'in_progress', changedBy: session.user.id, changedAt: now, note: note || 'Work started' });
          break;
        case 'complete':
          if (task.status === 'closed') return errorResponse('Task is already closed');
          task.status = 'completed';
          task.completedAt = now;
          task.resolutionNote = note || '';
          task.statusHistory.push({ status: 'completed', changedBy: session.user.id, changedAt: now, note: note || 'Marked as completed' });
          break;
        case 'close':
          if (task.status !== 'completed') return errorResponse('Task must be completed before closing');
          task.status = 'closed';
          task.closedAt = now;
          task.closedBy = session.user.id;
          task.statusHistory.push({ status: 'closed', changedBy: session.user.id, changedAt: now, note: note || 'Task closed after verification' });
          break;
        case 'reopen':
          task.status = 'open';
          task.completedAt = null;
          task.closedAt = null;
          task.closedBy = null;
          task.statusHistory.push({ status: 'open', changedBy: session.user.id, changedAt: now, note: note || 'Task reopened' });
          break;
        default:
          return errorResponse('Invalid action');
      }
      task.updatedAt = now;
      return successResponse(task, action === 'start' ? 'Task started' : `Task ${action}d`);
    }
    const task = await MaintenanceTask.findById(id);
    if (!task) return errorResponse('Task not found', 404);
    const meta = getRequestMeta(request.headers);

    switch (action) {
      case 'start':
        if (task.status !== 'open') return errorResponse('Only open tasks can be started');
        task.status = 'in_progress';
        task.statusHistory.push({ status: 'in_progress', changedBy: session.user.id as any, changedAt: new Date(), note: note || 'Work started' });
        break;
      case 'complete':
        if (task.status === 'closed') return errorResponse('Task is already closed');
        task.status = 'completed';
        task.completedAt = new Date();
        task.resolutionNote = note || '';
        task.statusHistory.push({ status: 'completed', changedBy: session.user.id as any, changedAt: new Date(), note: note || 'Marked as completed' });
        break;
      case 'close':
        if (task.status !== 'completed') return errorResponse('Task must be completed before closing');
        // Two-person rule: creator closes
        task.status = 'closed';
        task.closedAt = new Date();
        task.closedBy = session.user.id as any;
        task.statusHistory.push({ status: 'closed', changedBy: session.user.id as any, changedAt: new Date(), note: note || 'Task closed after verification' });
        break;
      case 'reopen':
        if (task.status === 'open') return errorResponse('Task is already open');
        task.status = 'open';
        task.completedAt = null;
        task.closedAt = null;
        task.closedBy = null;
        task.statusHistory.push({ status: 'open', changedBy: session.user.id as any, changedAt: new Date(), note: note || 'Task reopened' });
        break;
      default:
        return errorResponse('Invalid action');
    }

    await task.save();
    await auditAction({ userId: session.user.id, userName: session.user.name || '', userType: session.user.userType, action: `${action}_task`, module: 'maintenance_tasks', recordId: task._id, description: `${action} task "${task.title}". ${note || ''}`, ...meta }, request.headers);
    return successResponse(task, action === 'start' ? 'Task started' : `Task ${action}d`);
  } catch (error) {
    console.error('PATCH /api/maintenance/[id] error:', error);
    return errorResponse('Failed to update task status', 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('Unauthorized', 401);
    if (session.user.userType !== 'superadmin') return errorResponse('Only SuperAdmin can delete tasks', 403);
    const { id } = await params;
    try {
      await dbConnect();
    } catch (error) {
      if (!isDevFallbackEnabled()) throw error;
      const store = getDevStore();
      const index = store.maintenanceTasks.findIndex((item) => item._id === id);
      if (index === -1) return errorResponse('Task not found', 404);
      store.maintenanceTasks.splice(index, 1);
      return successResponse(null, 'Task deleted');
    }
    const task = await MaintenanceTask.findByIdAndDelete(id);
    if (!task) return errorResponse('Task not found', 404);
    const meta = getRequestMeta(request.headers);
    await auditAction({ userId: session.user.id, userName: session.user.name || '', userType: session.user.userType, action: 'delete_task', module: 'maintenance_tasks', recordId: task._id, description: `Deleted task "${task.title}"`, ...meta }, request.headers);
    return successResponse(null, 'Task deleted');
  } catch (error) {
    console.error('DELETE /api/maintenance/[id] error:', error);
    return errorResponse('Failed to delete task', 500);
  }
}
