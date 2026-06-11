import { type NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import dbConnect from '@/lib/db';
import Checklist from '@/models/Checklist';
import { auditAction } from '@/lib/audit';
import { successResponse, errorResponse, getRequestMeta } from '@/lib/utils';
import { devUserRef, getDevStore, isDevFallbackEnabled } from '@/lib/dev-store';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('Unauthorized', 401);
    const { id } = await params;
    const body = await request.json();
    const { action } = body;
    try {
      await dbConnect();
    } catch (error) {
      if (!isDevFallbackEnabled()) throw error;
      const checklist = getDevStore().checklists.find((entry) => entry._id === id);
      if (!checklist) return errorResponse('Checklist not found', 404);

      if (action === 'submit-item') {
        const { itemKey, photoUrl, gpsLat, gpsLng, captureSource } = body;
        const item = checklist.items.find((entry) => entry.key === itemKey);
        if (!item) return errorResponse('Item not found');
        if (captureSource !== 'camera' || !photoUrl?.startsWith('data:image/')) {
          return errorResponse('Live camera photo is required. Gallery uploads are not allowed.');
        }
        if (new Date() > new Date(checklist.uploadDeadline)) {
          item.status = 'unverified';
          checklist.updatedAt = new Date().toISOString();
          return errorResponse('Upload window has expired. Item marked as unverified.');
        }
        const now = new Date().toISOString();
        item.photoUrl = photoUrl;
        item.gpsLat = gpsLat || null;
        item.gpsLng = gpsLng || null;
        item.capturedAt = now;
        item.status = 'submitted';
        if (checklist.items.every((entry) => entry.status !== 'pending')) {
          checklist.overallStatus = 'submitted';
          checklist.submittedAt = now;
        }
        checklist.updatedAt = now;
        return successResponse(populateDevChecklist(checklist), 'Item submitted');
      }

      if (action === 'approve-item') {
        const { itemKey } = body;
        const item = checklist.items.find((entry) => entry.key === itemKey);
        if (!item) return errorResponse('Item not found');
        item.status = 'approved';
        item.approvedAt = new Date().toISOString();
        updateChecklistVerification(checklist, session.user.id);
        return successResponse(populateDevChecklist(checklist), 'Item approved');
      }

      if (action === 'reject-item') {
        const { itemKey, reason } = body;
        const item = checklist.items.find((entry) => entry.key === itemKey);
        if (!item) return errorResponse('Item not found');
        if (!reason?.trim()) return errorResponse('Rejection reason is required');
        item.status = 'rejected';
        item.supervisorNote = reason.trim();
        item.rejectedAt = new Date().toISOString();
        updateChecklistVerification(checklist, session.user.id);
        return successResponse(populateDevChecklist(checklist), 'Item rejected');
      }

      return errorResponse('Invalid action');
    }
    const checklist = await Checklist.findById(id);
    if (!checklist) return errorResponse('Checklist not found', 404);
    const meta = getRequestMeta(request.headers);

    if (action === 'submit-item') {
      const { itemKey, photoUrl, gpsLat, gpsLng } = body;
      const item = checklist.items.find((i) => i.key === itemKey);
      if (!item) return errorResponse('Item not found');
      if (new Date() > checklist.uploadDeadline) {
        item.status = 'unverified';
        await checklist.save();
        return errorResponse('Upload window has expired. Item marked as unverified.');
      }
      item.photoUrl = photoUrl || '';
      item.gpsLat = gpsLat || null;
      item.gpsLng = gpsLng || null;
      item.capturedAt = new Date();
      item.status = 'submitted';
      // Check if all items submitted
      const allSubmitted = checklist.items.every((i) => i.status !== 'pending');
      if (allSubmitted) { checklist.overallStatus = 'submitted'; checklist.submittedAt = new Date(); }
      await checklist.save();
      await auditAction({ userId: session.user.id, userName: session.user.name || '', userType: session.user.userType, action: 'submit_checklist_item', module: 'daily_operations', recordId: checklist._id, description: `Submitted checklist item "${item.label}"`, ...meta }, request.headers);
      return successResponse(checklist, 'Item submitted');
    }

    if (action === 'approve-item') {
      const { itemKey } = body;
      const item = checklist.items.find((i) => i.key === itemKey);
      if (!item) return errorResponse('Item not found');
      item.status = 'approved';
      item.approvedAt = new Date();
      // Check if all items resolved
      const allResolved = checklist.items.every((i) => ['approved', 'rejected', 'unverified'].includes(i.status));
      const allApproved = checklist.items.every((i) => i.status === 'approved');
      if (allApproved) { checklist.overallStatus = 'verified'; checklist.verifiedAt = new Date(); checklist.verifiedBy = session.user.id as any; }
      else if (allResolved) { checklist.overallStatus = 'partially_verified'; }
      await checklist.save();
      await auditAction({ userId: session.user.id, userName: session.user.name || '', userType: session.user.userType, action: 'approve_checklist_item', module: 'daily_operations', recordId: checklist._id, description: `Approved checklist item "${item.label}"`, ...meta }, request.headers);
      return successResponse(checklist, 'Item approved');
    }

    if (action === 'reject-item') {
      const { itemKey, reason } = body;
      const item = checklist.items.find((i) => i.key === itemKey);
      if (!item) return errorResponse('Item not found');
      if (!reason?.trim()) return errorResponse('Rejection reason is required');
      item.status = 'rejected';
      item.supervisorNote = reason.trim();
      item.rejectedAt = new Date();
      await checklist.save();
      await auditAction({ userId: session.user.id, userName: session.user.name || '', userType: session.user.userType, action: 'reject_checklist_item', module: 'daily_operations', recordId: checklist._id, description: `Rejected checklist item "${item.label}". Reason: ${reason}`, ...meta }, request.headers);
      return successResponse(checklist, 'Item rejected');
    }

    return errorResponse('Invalid action');
  } catch (error) {
    console.error('PATCH /api/checklists/[id] error:', error);
    return errorResponse('Failed', 500);
  }
}

function populateDevChecklist<T extends { staffId: string; verifiedBy: string | null }>(checklist: T) {
  return {
    ...checklist,
    staffId: devUserRef(checklist.staffId),
    verifiedBy: devUserRef(checklist.verifiedBy),
  };
}

function updateChecklistVerification(checklist: { items: { status: string }[]; overallStatus: string; verifiedAt: string | null; verifiedBy: string | null; updatedAt: string }, userId: string) {
  const now = new Date().toISOString();
  const allResolved = checklist.items.every((item) => ['approved', 'rejected', 'unverified'].includes(item.status));
  const allApproved = checklist.items.every((item) => item.status === 'approved');
  if (allApproved) {
    checklist.overallStatus = 'verified';
    checklist.verifiedAt = now;
    checklist.verifiedBy = userId;
  } else if (allResolved) {
    checklist.overallStatus = 'partially_verified';
  }
  checklist.updatedAt = now;
}
