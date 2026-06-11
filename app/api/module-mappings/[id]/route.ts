import { type NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import dbConnect from '@/lib/db';
import PositionModuleMapping from '@/models/PositionModuleMapping';
import Position from '@/models/Position';
import { auditAction } from '@/lib/audit';
import { successResponse, errorResponse, getRequestMeta } from '@/lib/utils';
import { MODULE_DEFINITIONS } from '@/lib/constants';
import { getDevStore, isDevFallbackEnabled } from '@/lib/dev-store';

/**
 * PUT /api/module-mappings/[id]
 * Edit an existing module mapping.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('Unauthorized', 401);
    if (session.user.userType !== 'superadmin') return errorResponse('Forbidden', 403);

    const { id } = await params;
    const body = await request.json();
    const { accessLevel, enabledActions } = body;

    if (!accessLevel) return errorResponse('accessLevel is required');
    if (!['view', 'edit', 'full_control'].includes(accessLevel)) {
      return errorResponse('Invalid access level');
    }

    try {
      await dbConnect();
    } catch (error) {
      if (!isDevFallbackEnabled()) throw error;
      const mapping = getDevStore().moduleMappings.find((entry) => entry._id === id);
      if (!mapping) return errorResponse('Mapping not found', 404);
      const moduleDef = MODULE_DEFINITIONS.find((m) => m.moduleKey === mapping.moduleKey);
      const validActions = moduleDef?.availableActions || [];
      mapping.accessLevel = accessLevel;
      mapping.enabledActions = (enabledActions || []).filter((a: string) => validActions.includes(a));
      mapping.updatedAt = new Date().toISOString();
      return successResponse(mapping, 'Mapping updated successfully');
    }

    const mapping = await PositionModuleMapping.findById(id);
    if (!mapping) return errorResponse('Mapping not found', 404);

    const moduleDef = MODULE_DEFINITIONS.find((m) => m.moduleKey === mapping.moduleKey);
    const validActions = moduleDef?.availableActions || [];
    const actions = (enabledActions || []).filter((a: string) => validActions.includes(a));

    const oldValue = {
      accessLevel: mapping.accessLevel,
      enabledActions: [...mapping.enabledActions],
    };

    mapping.accessLevel = accessLevel;
    mapping.enabledActions = actions;
    await mapping.save();

    const position = await Position.findById(mapping.positionId);

    const meta = getRequestMeta(request.headers);
    await auditAction(
      {
        userId: session.user.id,
        userName: session.user.name || 'SuperAdmin',
        userType: session.user.userType,
        action: 'edit_module_mapping',
        module: 'user_permission',
        recordId: mapping._id,
        description: `Updated ${moduleDef?.moduleName || mapping.moduleKey} mapping for ${position?.name || 'unknown'}`,
        oldValue,
        newValue: { accessLevel, enabledActions: actions },
        ...meta,
      },
      request.headers
    );

    return successResponse(mapping, 'Mapping updated successfully');
  } catch (error) {
    console.error('PUT /api/module-mappings/[id] error:', error);
    return errorResponse('Failed to update mapping', 500);
  }
}

/**
 * DELETE /api/module-mappings/[id]
 * Remove a module mapping.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('Unauthorized', 401);
    if (session.user.userType !== 'superadmin') return errorResponse('Forbidden', 403);

    const { id } = await params;

    try {
      await dbConnect();
    } catch (error) {
      if (!isDevFallbackEnabled()) throw error;
      const store = getDevStore();
      const index = store.moduleMappings.findIndex((entry) => entry._id === id);
      if (index === -1) return errorResponse('Mapping not found', 404);
      store.moduleMappings.splice(index, 1);
      return successResponse(null, 'Module mapping removed');
    }

    const mapping = await PositionModuleMapping.findById(id);
    if (!mapping) return errorResponse('Mapping not found', 404);

    const position = await Position.findById(mapping.positionId);
    const moduleDef = MODULE_DEFINITIONS.find((m) => m.moduleKey === mapping.moduleKey);

    await PositionModuleMapping.findByIdAndDelete(id);

    const meta = getRequestMeta(request.headers);
    await auditAction(
      {
        userId: session.user.id,
        userName: session.user.name || 'SuperAdmin',
        userType: session.user.userType,
        action: 'remove_module_from_position',
        module: 'user_permission',
        recordId: mapping._id,
        description: `Removed ${moduleDef?.moduleName || mapping.moduleKey} from ${position?.name || 'unknown'}`,
        oldValue: {
          moduleKey: mapping.moduleKey,
          accessLevel: mapping.accessLevel,
          enabledActions: mapping.enabledActions,
        },
        ...meta,
      },
      request.headers
    );

    return successResponse(null, 'Module mapping removed');
  } catch (error) {
    console.error('DELETE /api/module-mappings/[id] error:', error);
    return errorResponse('Failed to remove mapping', 500);
  }
}
