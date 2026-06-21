import { type NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import dbConnect from '@/lib/db';
import Checklist from '@/models/Checklist';
import { auditAction } from '@/lib/audit';
import { successResponse, errorResponse, getRequestMeta } from '@/lib/utils';
import { createDevId, getDevStore, isDevFallbackEnabled, type DevChecklist } from '@/lib/dev-store';
import { getChecklistDayRange, startOfChecklistDay } from '@/lib/checklist-maintenance';
import { checkPermission } from '@/lib/permissions';
import { SUPERVISOR_CHECKLIST_ITEMS } from '@/lib/supervisor-checklist';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('Unauthorized', 401);

    const permission = await checkPermission(session.user.id, 'daily_operations', 'upload_checklist');
    if (!permission.allowed) return errorResponse('Forbidden', 403);

    const body = await request.json();
    const { staffId, date, itemKey, photoUrl, gpsLat, gpsLng } = body;

    if (!staffId || !date || !itemKey || !photoUrl) {
      return errorResponse('Missing required fields');
    }

    const baseItem = SUPERVISOR_CHECKLIST_ITEMS.find((i) => i.key === itemKey);
    if (!baseItem) return errorResponse('Invalid item key', 400);

    const checklistDate = startOfChecklistDay(new Date(date));
    const meta = getRequestMeta(request.headers);

    let useDevStore = false;
    try {
      await dbConnect();
    } catch (error) {
      if (!isDevFallbackEnabled()) throw error;
      useDevStore = true;
    }

    if (useDevStore) {
      const store = getDevStore();
      const { start } = getChecklistDayRange(checklistDate);
      let checklist = store.checklists.find(
        (c) => c.staffId === staffId && new Date(c.date).getTime() === start.getTime()
      );

      const itemPayload = {
        key: itemKey,
        label: baseItem.label,
        labelMl: baseItem.labelMl || '',
        photoUrl,
        gpsLat: gpsLat || null,
        gpsLng: gpsLng || null,
        capturedAt: new Date().toISOString(),
        status: 'submitted' as const,
        supervisorNote: '',
        rejectedAt: null,
        approvedAt: null,
      };

      if (!checklist) {
        const deadline = new Date(start);
        deadline.setDate(deadline.getDate() + 1);
        const now = new Date().toISOString();
        checklist = {
          _id: createDevId('checklist'),
          staffId,
          date: start.toISOString(),
          items: [itemPayload],
          overallStatus: 'submitted',
          submittedAt: now,
          verifiedAt: null,
          verifiedBy: null,
          uploadDeadline: deadline.toISOString(),
          createdAt: now,
          updatedAt: now,
        };
        store.checklists.unshift(checklist);
      } else {
        const existingItemIndex = checklist.items.findIndex((i) => i.key === itemKey);
        if (existingItemIndex >= 0) {
          checklist.items[existingItemIndex] = { ...checklist.items[existingItemIndex], ...itemPayload };
        } else {
          checklist.items.push(itemPayload);
        }
        checklist.overallStatus = 'submitted';
        checklist.submittedAt = new Date().toISOString();
        checklist.updatedAt = new Date().toISOString();
      }

      return successResponse(checklist, 'Item submitted successfully');
    }

    // Mongoose Upsert logic
    const { start, end } = getChecklistDayRange(checklistDate);
    
    let checklist = await Checklist.findOne({ staffId, date: { $gte: start, $lt: end } });
    
    const itemPayload = {
      key: itemKey,
      label: baseItem.label,
      labelMl: baseItem.labelMl || '',
      photoUrl,
      gpsLat: gpsLat || null,
      gpsLng: gpsLng || null,
      capturedAt: new Date(),
      status: 'submitted' as const,
    };

    if (!checklist) {
      checklist = await Checklist.create({
        staffId,
        date: start,
        items: [itemPayload],
        overallStatus: 'submitted',
        submittedAt: new Date(),
        uploadDeadline: end,
      });
      await auditAction(
        {
          userId: session.user.id,
          userName: session.user.name || '',
          userType: session.user.userType,
          action: 'submit_checklist_item',
          module: 'daily_operations',
          recordId: checklist._id.toString(),
          description: `Started checklist for ${start.toLocaleDateString()} with item: ${baseItem.label}`,
          ...meta,
        },
        request.headers
      );
    } else {
      const existingItemIndex = checklist.items.findIndex((i) => i.key === itemKey);
      if (existingItemIndex >= 0) {
        checklist.items[existingItemIndex].photoUrl = photoUrl;
        checklist.items[existingItemIndex].gpsLat = gpsLat || null;
        checklist.items[existingItemIndex].gpsLng = gpsLng || null;
        checklist.items[existingItemIndex].capturedAt = new Date();
        checklist.items[existingItemIndex].status = 'submitted';
        checklist.items[existingItemIndex].supervisorNote = '';
        checklist.items[existingItemIndex].rejectedAt = null;
        checklist.items[existingItemIndex].approvedAt = null;
      } else {
        checklist.items.push(itemPayload as any);
      }
      
      checklist.overallStatus = 'submitted';
      checklist.submittedAt = new Date();
      await checklist.save();

      await auditAction(
        {
          userId: session.user.id,
          userName: session.user.name || '',
          userType: session.user.userType,
          action: 'submit_checklist_item',
          module: 'daily_operations',
          recordId: checklist._id.toString(),
          description: `Submitted item: ${baseItem.label}`,
          ...meta,
        },
        request.headers
      );
    }

    return successResponse(checklist, 'Item submitted successfully');
  } catch (error: any) {
    console.error('POST /api/checklists/submit error:', error);
    return errorResponse(error.message || 'Failed to submit item', 500);
  }
}
