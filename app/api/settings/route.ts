import { type NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import dbConnect from '@/lib/db';
import SystemSettings, { DEFAULT_SETTINGS } from '@/models/SystemSettings';
import { auditAction } from '@/lib/audit';
import { successResponse, errorResponse, getRequestMeta } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('Unauthorized', 401);
    if (session.user.userType !== 'superadmin') return errorResponse('Forbidden', 403);

    await dbConnect();

    // Ensure defaults exist
    for (const def of DEFAULT_SETTINGS) {
      await SystemSettings.findOneAndUpdate(
        { key: def.key },
        { $setOnInsert: def },
        { upsert: true }
      );
    }

    const settings = await SystemSettings.find().sort({ category: 1, key: 1 });
    return successResponse(settings);
  } catch (error) {
    console.error('GET /api/settings error:', error);
    return errorResponse('Failed to fetch settings', 500);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('Unauthorized', 401);
    if (session.user.userType !== 'superadmin') return errorResponse('Forbidden', 403);

    const body = await request.json();
    const { settings } = body;

    if (!settings || !Array.isArray(settings)) return errorResponse('Settings array required');

    await dbConnect();
    const meta = getRequestMeta(request.headers);

    for (const s of settings) {
      const { key, value } = s;
      const existing = await SystemSettings.findOne({ key });
      if (existing) {
        const oldValue = existing.value;
        existing.value = value;
        existing.updatedBy = session.user.id as any;
        await existing.save();

        await auditAction({
          userId: session.user.id,
          userName: session.user.name || 'SuperAdmin',
          userType: session.user.userType,
          action: 'update_setting',
          module: 'settings',
          description: `Updated setting "${key}": ${JSON.stringify(oldValue)} → ${JSON.stringify(value)}`,
          oldValue: { [key]: oldValue },
          newValue: { [key]: value },
          ...meta,
        }, request.headers);
      }
    }

    const allSettings = await SystemSettings.find().sort({ category: 1, key: 1 });
    return successResponse(allSettings, 'Settings updated');
  } catch (error) {
    console.error('PUT /api/settings error:', error);
    return errorResponse('Failed to update settings', 500);
  }
}
