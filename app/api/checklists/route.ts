import { type NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import dbConnect from '@/lib/db';
import Checklist from '@/models/Checklist';
import { auditAction } from '@/lib/audit';
import { successResponse, errorResponse, getRequestMeta } from '@/lib/utils';
import { createDevId, devUserRef, getDevStore, isDevFallbackEnabled, type DevChecklist } from '@/lib/dev-store';
import { SUPERVISOR_CHECKLIST_ITEMS } from '@/lib/supervisor-checklist';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('Unauthorized', 401);
    const sp = request.nextUrl.searchParams;
    const staffId = sp.get('staffId');
    const date = sp.get('date');
    const status = sp.get('status');
    try {
      await dbConnect();
    } catch (error) {
      if (!isDevFallbackEnabled()) throw error;
      const store = getDevStore();
      ensureTodayDevChecklist(session.user.id);
      let checklists = store.checklists;
      if (staffId) checklists = checklists.filter((checklist) => checklist.staffId === staffId);
      if (date) checklists = checklists.filter((checklist) => isSameDay(checklist.date, date));
      if (status) checklists = checklists.filter((checklist) => checklist.overallStatus === status);
      return successResponse(
        checklists
          .slice()
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, 100)
          .map(populateDevChecklist)
      );
    }
    const filter: Record<string, unknown> = {};
    if (staffId) filter.staffId = staffId;
    if (date) {
      const d = new Date(date);
      filter.date = { $gte: new Date(d.setHours(0, 0, 0, 0)), $lte: new Date(d.setHours(23, 59, 59, 999)) };
    }
    if (status) filter.overallStatus = status;
    const checklists = await Checklist.find(filter)
      .populate('staffId', 'name')
      .populate('verifiedBy', 'name')
      .sort({ date: -1 })
      .limit(100);
    return successResponse(checklists);
  } catch (error) {
    console.error('GET /api/checklists error:', error);
    return errorResponse('Failed to fetch checklists', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('Unauthorized', 401);
    const body = await request.json();
    const { action } = body;
    let useDevStore = false;
    try {
      await dbConnect();
    } catch (error) {
      if (!isDevFallbackEnabled()) throw error;
      useDevStore = true;
    }
    const meta = getRequestMeta(request.headers);

    if (action === 'generate') {
      const { staffId, items, date } = body;
      if (!staffId || !items?.length) return errorResponse('Staff and items required');
      const checklistDate = date ? new Date(date) : new Date();
      const deadline = new Date(checklistDate);
      deadline.setDate(deadline.getDate() + 7);
      if (useDevStore) {
        const now = new Date().toISOString();
        const checklist: DevChecklist = {
          _id: createDevId('checklist'),
          staffId,
          date: checklistDate.toISOString(),
          items: items.map((item: { key: string; label: string; labelMl?: string }) => ({
            key: item.key,
            label: item.label,
            labelMl: item.labelMl || '',
            photoUrl: '',
            gpsLat: null,
            gpsLng: null,
            capturedAt: null,
            status: 'pending',
            supervisorNote: '',
            rejectedAt: null,
            approvedAt: null,
          })),
          overallStatus: 'pending',
          submittedAt: null,
          verifiedAt: null,
          verifiedBy: null,
          uploadDeadline: deadline.toISOString(),
          createdAt: now,
          updatedAt: now,
        };
        getDevStore().checklists.unshift(checklist);
        return successResponse(populateDevChecklist(checklist), 'Checklist generated', 201);
      }
      const checklist = await Checklist.create({
        staffId,
        date: checklistDate,
        items: items.map((item: { key: string; label: string; labelMl?: string }) => ({
          key: item.key, label: item.label, labelMl: item.labelMl || '',
          status: 'pending',
        })),
        overallStatus: 'pending',
        uploadDeadline: deadline,
      });
      await auditAction({ userId: session.user.id, userName: session.user.name || '', userType: session.user.userType, action: 'generate_checklist', module: 'daily_operations', recordId: checklist._id, description: `Generated daily checklist with ${items.length} items`, ...meta }, request.headers);
      return successResponse(checklist, 'Checklist generated', 201);
    }

    return errorResponse('Invalid action');
  } catch (error) {
    console.error('POST /api/checklists error:', error);
    return errorResponse('Failed', 500);
  }
}

function ensureTodayDevChecklist(staffId: string) {
  const store = getDevStore();
  const actualStaffId = staffId === 'demo-superadmin' ? 'demo-turf' : staffId;
  const existing = store.checklists.find((checklist) => checklist.staffId === actualStaffId && isSameDay(checklist.date, new Date().toISOString()));
  if (existing) return existing;

  const now = new Date();
  const deadline = new Date(now);
  deadline.setDate(deadline.getDate() + 1);
  const checklist: DevChecklist = {
    _id: createDevId('checklist'),
    staffId: actualStaffId,
    date: now.toISOString(),
    items: SUPERVISOR_CHECKLIST_ITEMS.map((item) => ({
      key: item.key,
      label: item.label,
      labelMl: item.labelMl,
      photoUrl: '',
      gpsLat: null,
      gpsLng: null,
      capturedAt: null,
      status: 'pending',
      supervisorNote: '',
      rejectedAt: null,
      approvedAt: null,
    })),
    overallStatus: 'pending',
    submittedAt: null,
    verifiedAt: null,
    verifiedBy: null,
    uploadDeadline: deadline.toISOString(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  store.checklists.unshift(checklist);
  return checklist;
}

function populateDevChecklist(checklist: DevChecklist) {
  return {
    ...checklist,
    staffId: devUserRef(checklist.staffId),
    verifiedBy: devUserRef(checklist.verifiedBy),
  };
}

function isSameDay(left: string, right: string) {
  return new Date(left).toDateString() === new Date(right).toDateString();
}
