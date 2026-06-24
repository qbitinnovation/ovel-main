import { type NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import dbConnect from '@/lib/db';
import FinanceEntry from '@/models/FinanceEntry';
import { auditAction } from '@/lib/audit';
import { successResponse, errorResponse, getRequestMeta } from '@/lib/utils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('Unauthorized', 401);
    const { id } = await params;
    await dbConnect();
    const entry = await FinanceEntry.findById(id).populate('submittedBy', 'name');
    if (!entry) return errorResponse('Entry not found', 404);
    return successResponse(entry);
  } catch (error) {
    console.error('GET /api/accounts/[id] error:', error);
    return errorResponse('Failed to fetch entry', 500);
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
    const { action } = body;

    const { checkPermission } = await import('@/lib/permissions');
    const permAction = action === 'unlock' ? 'request_unlock' : 'edit_transaction';
    const perm = await checkPermission(session.user.id, 'accounts_finance', permAction);
    if (!perm.allowed) return errorResponse('Forbidden', 403);

    await dbConnect();
    const entry = await FinanceEntry.findById(id);
    if (!entry) return errorResponse('Entry not found', 404);
    const meta = getRequestMeta(request.headers);

    if (action === 'unlock') {
      if (session.user.userType !== 'superadmin') return errorResponse('Only SuperAdmin can unlock records', 403);
      if (!entry.isLocked) return errorResponse('Record is already unlocked');
      const { reason } = body;
      if (!reason?.trim()) return errorResponse('Unlock reason is required');
      entry.isLocked = false;
      entry.unlockHistory.push({ unlockedBy: session.user.id as any, unlockedAt: new Date(), reason: reason.trim(), relockedAt: null });
      await entry.save();
      await auditAction({ userId: session.user.id, userName: session.user.name || '', userType: session.user.userType, action: 'unlock_finance_entry', module: 'accounts_finance', recordId: entry._id, description: `Unlocked finance entry. Reason: ${reason.trim()}`, ...meta }, request.headers);
      return successResponse(entry, 'Record unlocked');
    }

    if (action === 'update') {
      if (entry.isLocked) return errorResponse('Record is locked. Request unlock first.');
      const { income, expenses, electricity, otherPayments } = body;
      if (income) entry.income = income;
      if (expenses) entry.expenses = expenses;
      if (electricity) entry.electricity = electricity;
      if (otherPayments) entry.otherPayments = otherPayments;
      entry.isLocked = true;
      entry.lockedAt = new Date();
      // Mark relock in history
      const lastUnlock = entry.unlockHistory[entry.unlockHistory.length - 1];
      if (lastUnlock && !lastUnlock.relockedAt) lastUnlock.relockedAt = new Date();
      await entry.save();
      await auditAction({ userId: session.user.id, userName: session.user.name || '', userType: session.user.userType, action: 'resubmit_finance_entry', module: 'accounts_finance', recordId: entry._id, description: `Corrected and re-locked finance entry. Net: ₹${entry.netAmount}`, ...meta }, request.headers);
      return successResponse(entry, 'Record corrected and re-locked');
    }

    return errorResponse('Invalid action');
  } catch (error) {
    console.error('PATCH /api/accounts/[id] error:', error);
    return errorResponse('Failed to process', 500);
  }
}
