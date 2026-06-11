import { type NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import dbConnect from '@/lib/db';
import PositionModuleMapping from '@/models/PositionModuleMapping';
import Position from '@/models/Position';
import { auditAction } from '@/lib/audit';
import { successResponse, errorResponse, getRequestMeta } from '@/lib/utils';
import { MODULE_DEFINITIONS } from '@/lib/constants';
import { createDevId, devPositionRef, getDevStore, isDevFallbackEnabled, type DevModuleMapping } from '@/lib/dev-store';

export const dynamic = 'force-dynamic';

/**
 * GET /api/module-mappings
 * List all module mappings. Optionally filter by positionId.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('Unauthorized', 401);
    if (session.user.userType !== 'superadmin') return errorResponse('Forbidden', 403);

    const positionId = request.nextUrl.searchParams.get('positionId');

    try {
      await dbConnect();
    } catch (error) {
      if (!isDevFallbackEnabled()) throw error;
      let mappings = getDevStore().moduleMappings;
      if (positionId) mappings = mappings.filter((mapping) => mapping.positionId === positionId);
      return successResponse(
        mappings.map((mapping) => ({ ...mapping, positionId: devPositionRef(mapping.positionId) }))
      );
    }

    const filter: Record<string, unknown> = {};
    if (positionId) filter.positionId = positionId;

    const mappings = await PositionModuleMapping.find(filter)
      .populate('positionId', 'name isActive')
      .sort({ createdAt: -1 });

    return successResponse(mappings);
  } catch (error) {
    console.error('GET /api/module-mappings error:', error);
    return errorResponse('Failed to fetch module mappings', 500);
  }
}

/**
 * POST /api/module-mappings
 * Create a new module mapping for a position.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('Unauthorized', 401);
    if (session.user.userType !== 'superadmin') return errorResponse('Forbidden', 403);

    const body = await request.json();
    const { positionId, moduleKey, accessLevel, enabledActions } = body;

    if (!positionId || !moduleKey || !accessLevel) {
      return errorResponse('positionId, moduleKey, and accessLevel are required');
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
      const position = store.positions.find((entry) => entry._id === positionId);
      if (!position) return errorResponse('Position not found', 404);
      if (!position.isActive) return errorResponse('Cannot map modules to an inactive position');
      const existing = store.moduleMappings.find((mapping) => mapping.positionId === positionId && mapping.moduleKey === moduleKey);
      if (existing) return errorResponse('This module is already mapped to this position. Edit the existing mapping instead.');
      const now = new Date().toISOString();
      const mapping: DevModuleMapping = {
        _id: createDevId('mapping'),
        positionId,
        moduleKey,
        accessLevel,
        enabledActions: actions,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };
      store.moduleMappings.unshift(mapping);
      return successResponse({ ...mapping, positionId: devPositionRef(positionId) }, 'Module mapped successfully', 201);
    }

    // Validate position exists and is active
    const position = await Position.findById(positionId);
    if (!position) return errorResponse('Position not found', 404);
    if (!position.isActive) return errorResponse('Cannot map modules to an inactive position');

    // Check if mapping already exists
    const existing = await PositionModuleMapping.findOne({ positionId, moduleKey });
    if (existing) {
      return errorResponse('This module is already mapped to this position. Edit the existing mapping instead.');
    }

    const mapping = await PositionModuleMapping.create({
      positionId,
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
        action: 'map_module_to_position',
        module: 'user_permission',
        recordId: mapping._id,
        description: `Mapped ${moduleDef.moduleName} to ${position.name} with ${accessLevel} access`,
        newValue: { positionId, moduleKey, accessLevel, enabledActions: actions },
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
