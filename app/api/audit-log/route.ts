import { type NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import dbConnect from '@/lib/db';
import AuditLog from '@/models/AuditLog';
import { successResponse, errorResponse, parsePagination, paginate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('Unauthorized', 401);
    if (session.user.userType !== 'superadmin') return errorResponse('Forbidden', 403);

    const sp = request.nextUrl.searchParams;
    const { page, limit } = parsePagination(sp);
    const userId = sp.get('userId');
    const module = sp.get('module');
    const action = sp.get('action');
    const startDate = sp.get('startDate');
    const endDate = sp.get('endDate');
    const search = sp.get('search');

    await dbConnect();

    const filter: Record<string, unknown> = {};
    if (userId) filter.userId = userId;
    if (module) filter.module = module;
    if (action) filter.action = { $regex: action, $options: 'i' };
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) (filter.timestamp as Record<string, Date>).$gte = new Date(startDate);
      if (endDate) (filter.timestamp as Record<string, Date>).$lte = new Date(endDate);
    }
    if (search) {
      filter.$or = [
        { description: { $regex: search, $options: 'i' } },
        { userName: { $regex: search, $options: 'i' } },
        { action: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await AuditLog.countDocuments(filter);
    const pagination = paginate({ page, limit, total });

    const logs = await AuditLog.find(filter)
      .sort({ timestamp: -1 })
      .skip(pagination.skip)
      .limit(limit);

    return successResponse({ logs, pagination });
  } catch (error) {
    console.error('GET /api/audit-log error:', error);
    return errorResponse('Failed to fetch audit logs', 500);
  }
}
