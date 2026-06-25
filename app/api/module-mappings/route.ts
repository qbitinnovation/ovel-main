import { type NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import dbConnect from '@/lib/db';
import UserModuleMapping from '@/models/UserModuleMapping';
import User from '@/models/User';
import { auditAction } from '@/lib/audit';
import { successResponse, errorResponse, getRequestMeta } from '@/lib/utils';
import { MODULE_DEFINITIONS } from '@/lib/constants';
import { createDevId, devUserRef, getDevStore, isDevFallbackEnabled, type DevModuleMapping } from '@/lib/dev-store';

export const dynamic = 'force-dynamic';

/**
 * GET /api/module-mappings
 * List all module mappings. Optionally filter by userId.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('Unauthorized', 401);
    if (session.user.userType !== 'superadmin') return errorResponse('Forbidden', 403);

    const userId = request.nextUrl.searchParams.get('userId');

    try {
      await dbConnect();
    } catch (error) {
      if (!isDevFallbackEnabled()) throw error;
      let mappings = getDevStore().moduleMappings;
      if (userId) mappings = mappings.filter((mapping) => mapping.userId === userId);
      return successResponse(
        mappings.map((mapping) => ({ ...mapping, userId: devUserRef(mapping.userId) }))
      );
    }

    const filter: Record<string, unknown> = {};
    if (userId) filter.userId = userId;

    const mappings = await UserModuleMapping.find(filter)
      .populate('userId', 'name email isActive')
      .sort({ createdAt: -1 });

    return successResponse(mappings);
  } catch (error) {
    console.error('GET /api/module-mappings error:', error);
    return errorResponse('Failed to fetch module mappings', 500);
  }
}

/**
 * POST /api/module-mappings
 * Create a new module mapping for a user.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('Unauthorized', 401);
    if (session.user.userType !== 'superadmin') return errorResponse('Forbidden', 403);

    const body = await request.json();
    const { userId, moduleKey, accessLevel, enabledActions } = body;

    if (!userId || !moduleKey || !accessLevel) {
      return errorResponse('userId, moduleKey, and accessLevel are required');
    }

    // Validate module key
    const moduleDef = MODULE_DEFINITIONS.find((m) => m.moduleKey === moduleKey);
    if (!moduleDef) return errorResponse('Invalid module key');

    // Validate access level
    if (!['view', 'edit', 'full_control'].includes(accessLevel)) {
      return errorResponse('Invalid access level');
    }

    // Validate actions
    const validActions = moduleDef.availableActions;
    const actions = (enabledActions || []).filter((a: string) => validActions.includes(a));

    let useDevStore = false;
    try {
      await dbConnect();
    } catch (error) {
      if (!isDevFallbackEnabled()) throw error;
      useDevStore = true;
    }

    if (useDevStore) {
      const store = getDevStore();
      const user = store.users.find((entry) => entry._id === userId);
      if (!user) return errorResponse('User not found', 404);
      if (!user.isActive) return errorResponse('Cannot map modules to an inactive user');
      const existing = store.moduleMappings.find((mapping) => mapping.userId === userId && mapping.moduleKey === moduleKey);
      if (existing) return errorResponse('This module is already mapped to this user. Edit the existing mapping instead.');
      const now = new Date().toISOString();
      const mapping: DevModuleMapping = {
        _id: createDevId('mapping'),
        userId,
        moduleKey,
        accessLevel,
        enabledActions: actions,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };
      store.moduleMappings.unshift(mapping);
      return successResponse({ ...mapping, userId: devUserRef(userId) }, 'Module mapped successfully', 201);
    }

    // Validate user exists and is active
    const user = await User.findById(userId);
    if (!user) return errorResponse('User not found', 404);
    if (!user.isActive) return errorResponse('Cannot map modules to an inactive user');

    // Check if mapping already exists
    const existing = await UserModuleMapping.findOne({ userId, moduleKey });
    if (existing) {
      return errorResponse('This module is already mapped to this user. Edit the existing mapping instead.');
    }

    const mapping = await UserModuleMapping.create({
      userId,
      moduleKey,
      accessLevel,
      enabledActions: actions,
      isActive: true,
    });

    const meta = getRequestMeta(request.headers);
    await auditAction(
      {
        userId: session.user.id,
        userName: session.user.name || 'SuperAdmin',
        userType: session.user.userType,
        action: 'map_module_to_user',
        module: 'user_permission',
        recordId: mapping._id,
        description: `Mapped ${moduleDef.moduleName} to ${user.name} with ${accessLevel} access`,
        newValue: { userId, moduleKey, accessLevel, enabledActions: actions },
        ...meta,
      },
      request.headers
    );

    return successResponse(mapping, 'Module mapped successfully', 201);
  } catch (error) {
    console.error('POST /api/module-mappings error:', error);
    return errorResponse('Failed to create module mapping', 500);
  }
}
