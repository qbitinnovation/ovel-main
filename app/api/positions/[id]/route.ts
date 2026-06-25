import { type NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import dbConnect from '@/lib/db';
import Position from '@/models/Position';
import { auditAction } from '@/lib/audit';
import { successResponse, errorResponse, sanitizeInput, getRequestMeta } from '@/lib/utils';

/**
 * PUT /api/positions/[id]
 * Edit position name and/or description.
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
    const { name, description } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return errorResponse('Position name is required');
    }

    const sanitizedName = sanitizeInput(name);
    const sanitizedDesc = description ? sanitizeInput(description) : '';

    await dbConnect();

    const position = await Position.findById(id);
    if (!position) return errorResponse('Position not found', 404);

    // Check uniqueness (exclude self)
    const duplicate = await Position.findOne({
      _id: { $ne: id },
      name: { $regex: new RegExp(`^${sanitizedName}$`, 'i') },
    });
    if (duplicate) {
      return errorResponse('A position with this name already exists');
    }

    const oldValue = { name: position.name, description: position.description };
    position.name = sanitizedName;
    position.description = sanitizedDesc;
    await position.save();

    const meta = getRequestMeta(request.headers);
    await auditAction(
      {
        userId: session.user.id,
        userName: session.user.name || 'SuperAdmin',
        userType: session.user.userType,
        action: 'edit_position',
        module: 'user_permission',
        recordId: position._id,
        description: `Edited position "${sanitizedName}"`,
        oldValue,
        newValue: { name: sanitizedName, description: sanitizedDesc },
        ...meta,
      },
      request.headers
    );

    return successResponse(position, 'Position updated successfully');
  } catch (error) {
    console.error('PUT /api/positions/[id] error:', error);
    return errorResponse('Failed to update position', 500);
  }
}

/**
 * PATCH /api/positions/[id]
 * Toggle position active status.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('Unauthorized', 401);
    if (session.user.userType !== 'superadmin') return errorResponse('Forbidden', 403);

    const { id } = await params;

    await dbConnect();

    const position = await Position.findById(id);
    if (!position) return errorResponse('Position not found', 404);

    const oldStatus = position.isActive;
    position.isActive = !position.isActive;
    await position.save();

    // Note: We used to deactivate module mappings here, but those are now user-based.

    const meta = getRequestMeta(request.headers);
    await auditAction(
      {
        userId: session.user.id,
        userName: session.user.name || 'SuperAdmin',
        userType: session.user.userType,
        action: position.isActive ? 'reactivate_position' : 'deactivate_position',
        module: 'user_permission',
        recordId: position._id,
        description: `${position.isActive ? 'Reactivated' : 'Deactivated'} position "${position.name}"`,
        oldValue: { isActive: oldStatus },
        newValue: { isActive: position.isActive },
        ...meta,
      },
      request.headers
    );

    return successResponse(
      position,
      `Position ${position.isActive ? 'reactivated' : 'deactivated'} successfully`
    );
  } catch (error) {
    console.error('PATCH /api/positions/[id] error:', error);
    return errorResponse('Failed to toggle position status', 500);
  }
}
