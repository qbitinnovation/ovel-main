import { type NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import dbConnect from '@/lib/db';
import FinanceEntry from '@/models/FinanceEntry';
import AccountTransaction from '@/models/AccountTransaction';
import { auditAction } from '@/lib/audit';
import { successResponse, errorResponse, getRequestMeta, parsePagination, paginate } from '@/lib/utils';
import { isDevFallbackEnabled, getDevStore } from '@/lib/dev-store';
import { checkPermission } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('Unauthorized', 401);

    const permission = await checkPermission(session.user.id, 'accounts_finance', 'view_transactions');
    if (!permission.allowed) return errorResponse('Forbidden', 403);

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
    if (isDevFallbackEnabled()) {
      const { page, limit } = parsePagination(request.nextUrl.searchParams);
      return successResponse({
        entries: [],
        pagination: paginate({ page, limit, total: 0 }),
      }, 'Development fallback finance entries');
    }
    return errorResponse('Failed to fetch entries', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('Unauthorized', 401);

    const permission = await checkPermission(session.user.id, 'accounts_finance', 'add_transaction');
    if (!permission.allowed) return errorResponse('Forbidden', 403);

    const body = await request.json();
    const { date, type, source, amount, paymentMode, category, description, referenceNumber } = body;

    if (!date) return errorResponse('Date is required');
    if (!amount) return errorResponse('Amount is required');
    // normalize 'expenses' -> 'expense' to handle both frontend forms
    const normalizedType = type === 'expenses' ? 'expense' : type;
    if (!normalizedType || !['income', 'expense'].includes(normalizedType)) return errorResponse('Valid type is required');

    try {
      await dbConnect();
    } catch (error) {
      if (!isDevFallbackEnabled()) throw error;
      
      const store = getDevStore();
      const entry = {
        _id: 'dev_mock_' + Date.now(),
        type: normalizedType as 'income' | 'expense',
        source: source || 'manual',
        amount: Number(amount),
        paymentMode: paymentMode || 'cash',
        customerName: 'Manual Entry',
        customerContact: '',
        summary: `${category || 'Manual Entry'} - ${description || ''}`.trim(),
        referenceNumber: referenceNumber || '',
        date: new Date(date).toISOString(),
        createdBy: session.user.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      if (store) {
        store.accountTransactions.unshift(entry);
      }
      return successResponse(entry, 'Transaction submitted (Dev Mode)', 201);
    }

    const entry = await AccountTransaction.create({
      type: normalizedType,
      source: source || 'manual',
      amount: Number(amount),
      paymentMode: paymentMode || 'cash',
      customerName: 'Manual Entry',
      customerContact: '',
      summary: `${category || 'Manual Entry'} - ${description || ''}`.trim(),
      referenceNumber: referenceNumber || '',
      date: new Date(date),
      createdBy: session.user.id,
    });

    const meta = getRequestMeta(request.headers);
    await auditAction({
      userId: session.user.id,
      userName: session.user.name || '',
      userType: session.user.userType,
      action: 'submit_account_transaction',
      module: 'accounts',
      recordId: entry._id,
      description: `Submitted ${type} transaction for ${new Date(date).toLocaleDateString()}. Amount: ₹${amount}.`,
      newValue: { type, amount, summary: entry.summary },
      ...meta,
    }, request.headers);

    return successResponse(entry, 'Transaction created successfully', 201);
  } catch (error: any) {
    console.error('POST /api/accounts error:', error);
    if (!isDevFallbackEnabled() && error.name === 'MongooseServerSelectionError') {
      return errorResponse('Database connection failed', 500);
    }
    return errorResponse(error?.message || 'Failed to submit entry', 500);
  }
}
