// Force rebuild
import { type NextRequest } from 'next/server';
console.log("Forcing Turbopack Cache Clear...");
import { auth } from '@/lib/auth';
import dbConnect from '@/lib/db';
import SystemSettings, { DEFAULT_SETTINGS } from '@/models/SystemSettings';
import { auditAction } from '@/lib/audit';
import { successResponse, errorResponse, getRequestMeta } from '@/lib/utils';
import { createDevId, getDevStore, isDevFallbackEnabled, type DevSetting } from '@/lib/dev-store';

export const dynamic = 'force-dynamic';

function ensureDevSettings() {
  const store = getDevStore();
  const now = new Date().toISOString();

  for (const def of DEFAULT_SETTINGS) {
    if (!store.settings.some((setting) => setting.key === def.key)) {
      store.settings.push({
        _id: createDevId('setting'),
        key: def.key,
        value: def.value,
        label: def.label,
        category: def.category,
        updatedBy: null,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  return store.settings;
}

function sortSettings<T extends { category: string; key: string }>(settings: T[]) {
  return [...settings].sort((a, b) => a.category.localeCompare(b.category) || a.key.localeCompare(b.key));
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('Unauthorized', 401);
    if (session.user.userType !== 'superadmin') return errorResponse('Forbidden', 403);

    try {
      await dbConnect();
    } catch (error) {
      if (!isDevFallbackEnabled()) throw error;
      return successResponse(sortSettings(ensureDevSettings()));
    }

    const settings = await SystemSettings.find().sort({ category: 1, key: 1 });
    
    // Efficiently insert only missing defaults
    const missingDefaults = DEFAULT_SETTINGS.filter(def => !settings.some(s => s.key === def.key));
    if (missingDefaults.length > 0) {
      try {
        const inserted = await SystemSettings.insertMany(missingDefaults);
        settings.push(...inserted);
        // Re-sort after insertion
        settings.sort((a, b) => a.category.localeCompare(b.category) || a.key.localeCompare(b.key));
      } catch (upsertErr) {
        console.error('Error inserting missing default settings:', upsertErr);
      }
    }

    return successResponse(settings);
  } catch (error) {
    console.error('GET /api/settings error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    return errorResponse('Failed to fetch settings: ' + msg, 500);
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

    try {
      await dbConnect();
    } catch (error) {
      if (!isDevFallbackEnabled()) throw error;

      const storeSettings = ensureDevSettings();
      const now = new Date().toISOString();
      const userId = String(session.user.id || '');

      for (const s of settings) {
        const { key, value } = s;
        const existing = storeSettings.find((setting) => setting.key === key);

        if (existing) {
          existing.value = value;
          existing.updatedBy = userId;
          existing.updatedAt = now;
          continue;
        }

        const def = DEFAULT_SETTINGS.find((setting) => setting.key === key);
        if (!def) continue;

        const created: DevSetting = {
          _id: createDevId('setting'),
          key: def.key,
          value,
          label: def.label,
          category: def.category,
          updatedBy: userId,
          createdAt: now,
          updatedAt: now,
        };
        storeSettings.push(created);
      }

      return successResponse(sortSettings(storeSettings), 'Settings updated');
    }

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
      } else {
        const def = DEFAULT_SETTINGS.find((setting) => setting.key === key);
        if (!def) continue;

        const created = await SystemSettings.create({
          ...def,
          value,
          updatedBy: session.user.id,
        });

        await auditAction({
          userId: session.user.id,
          userName: session.user.name || 'SuperAdmin',
          userType: session.user.userType,
          action: 'update_setting',
          module: 'settings',
          description: `Created setting "${key}": ${JSON.stringify(value)}`,
          newValue: { [key]: created.value },
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
