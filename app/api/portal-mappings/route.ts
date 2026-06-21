import { type NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import dbConnect from '@/lib/db';
import PortalModuleMapping from '@/models/PortalModuleMapping';
import { auditAction } from '@/lib/audit';
import { successResponse, errorResponse, getRequestMeta } from '@/lib/utils';
import { MODULE_DEFINITIONS } from '@/lib/constants';
import { createDevId, getDevStore, isDevFallbackEnabled, type DevPortalMapping } from '@/lib/dev-store';

export const dynamic = 'force-dynamic';

/**
 * GET /api/portal-mappings
 * List all portal mappings. Optionally filter by portalType.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('Unauthorized', 401);
    if (session.user.userType !== 'superadmin') return errorResponse('Forbidden', 403);

    const portalType = request.nextUrl.searchParams.get('portalType');

    try {
      await dbConnect();
    } catch (error) {
      if (!isDevFallbackEnabled()) throw error;
      let mappings = getDevStore().portalMappings;
      if (portalType) mappings = mappings.filter((mapping) => mapping.portalType === portalType);
      return successResponse(mappings);
    }

    const filter: Record<string, unknown> = {};
    if (portalType) filter.portalType = portalType;

    const mappings = await PortalModuleMapping.find(filter).sort({ createdAt: -1 });

    return successResponse(mappings);
  } catch (error) {
    console.error('GET /api/portal-mappings error:', error);
    return errorResponse('Failed to fetch portal mappings', 500);
  }
}

/**
 * POST /api/portal-mappings
 * Create a new module mapping for a portal.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('Unauthorized', 401);
    if (session.user.userType !== 'superadmin') return errorResponse('Forbidden', 403);

    const body = await request.json();
    const { portalType, moduleKey, accessLevel, enabledActions } = body;

    if (!portalType || !moduleKey || !accessLevel) {
      return errorResponse('portalType, moduleKey, and accessLevel are required');
    }

    if (!['turf', 'shareholder'].includes(portalType)) {
      return errorResponse('Invalid portal type');
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
      const existing = store.portalMappings.find(
        (mapping) => mapping.portalType === portalType && mapping.moduleKey === moduleKey
      );
      if (existing) return errorResponse('This module is already mapped to this portal. Edit the existing mapping instead.');
      
      const now = new Date().toISOString();
      const mapping: DevPortalMapping = {
        _id: createDevId('portal_map'),
        portalType: portalType as 'turf' | 'shareholder',
        moduleKey,
        accessLevel,
        enabledActions: actions,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };
      store.portalMappings.unshift(mapping);
      return successResponse(mapping, 'Module mapped successfully', 201);
    }

    // Check if mapping already exists
    const existing = await PortalModuleMapping.findOne({ portalType, moduleKey });
    if (existing) {
      return errorResponse('This module is already mapped to this portal. Edit the existing mapping instead.');
    }

    const mapping = await PortalModuleMapping.create({
      portalType,
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
        action: 'map_module_to_portal',
        module: 'user_permission',
        recordId: mapping._id,
        description: `Mapped ${moduleDef.moduleName} to ${portalType} portal with ${accessLevel} access`,
        newValue: { portalType, moduleKey, accessLevel, enabledActions: actions },
        ...meta,
      },
      request.headers
    );

    return successResponse(mapping, 'Module mapped successfully', 201);
  } catch (error) {
    console.error('POST /api/portal-mappings error:', error);
    return errorResponse('Failed to create portal mapping', 500);
  }
}
