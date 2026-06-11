import { type NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import dbConnect from '@/lib/db';
import FinanceEntry from '@/models/FinanceEntry';
import { auditAction } from '@/lib/audit';
import { successResponse, errorResponse, getRequestMeta, parsePagination, paginate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('Unauthorized', 401);

    const sp = request.nextUrl.searchParams;
    const { page, limit } = parsePagination(sp);
    const startDate = sp.get('startDate');
    const endDate = sp.get('endDate');

    await dbConnect();

    const filter: Record<string, unknown> = {};
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) (filter.date as Record<string, Date>).$gte = new Date(startDate);
      if (endDate) (filter.date as Record<string, Date>).$lte = new Date(endDate);
    }

    const total = await FinanceEntry.countDocuments(filter);
    const pagination = paginate({ page, limit, total });

    const entries = await FinanceEntry.find(filter)
      .populate('submittedBy', 'name')
      .sort({ date: -1 })
      .skip(pagination.skip)
      .limit(limit);

    return successResponse({ entries, pagination });
  } catch (error) {
    console.error('GET /api/accounts error:', error);
    return errorResponse('Failed to fetch entries', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('Unauthorized', 401);

    const body = await request.json();
    const { date, income, expenses, electricity, otherPayments } = body;

    if (!date) return errorResponse('Date is required');

    await dbConnect();

    const entry = await FinanceEntry.create({
      date: new Date(date),
      income: income || [],
      expenses: expenses || [],
      electricity: electricity || [],
      otherPayments: otherPayments || [],
      submittedBy: session.user.id,
      isLocked: true,
      lockedAt: new Date(),
    });

    const meta = getRequestMeta(request.headers);
    await auditAction({
      userId: session.user.id,
      userName: session.user.name || '',
      userType: session.user.userType,
      action: 'submit_daily_entry',
      module: 'accounts_finance',
      recordId: entry._id,
      description: `Submitted daily finance entry for ${new Date(date).toLocaleDateString()}. Net: ₹${entry.netAmount}. Record locked.`,
      newValue: { totalIncome: entry.totalIncome, totalExpenses: entry.totalExpenses, netAmount: entry.netAmount },
      ...meta,
    }, request.headers);

    return successResponse(entry, 'Finance entry submitted and locked', 201);
  } catch (error) {
    console.error('POST /api/accounts error:', error);
    return errorResponse('Failed to submit entry', 500);
  }
}
