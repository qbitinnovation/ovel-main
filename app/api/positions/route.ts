import { type NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import dbConnect from '@/lib/db';
import Position from '@/models/Position';
import User from '@/models/User';
import { auditAction } from '@/lib/audit';
import { successResponse, errorResponse, sanitizeInput, getRequestMeta } from '@/lib/utils';
import { createDevId, getDevStore, isDevFallbackEnabled } from '@/lib/dev-store';

export const dynamic = 'force-dynamic';

/**
 * GET /api/positions
 * List all positions with user count per position.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('Unauthorized', 401);
    if (session.user.userType !== 'superadmin') return errorResponse('Forbidden', 403);

    try {
      await dbConnect();
    } catch (error) {
      if (!isDevFallbackEnabled()) throw error;

      const store = getDevStore();
      const positions = store.positions.map((position) => ({
        ...position,
        userCount: store.users.filter(
          (user) => user.positionId === position._id && user.isActive && !user.isArchived
        ).length,
      }));

      return successResponse(positions);
    }

    // Aggregate positions with user counts
    const positions = await Position.aggregate([
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: 'positionId',
          pipeline: [
            { $match: { isActive: true, isArchived: false } },
            { $project: { _id: 1 } },
          ],
          as: 'assignedUsers',
        },
      },
      {
        $addFields: {
          userCount: { $size: '$assignedUsers' },
        },
      },
      {
        $project: {
          assignedUsers: 0,
        },
      },
    ]);

    return successResponse(positions);
  } catch (error) {
    console.error('GET /api/positions error:', error);
    return errorResponse('Failed to fetch positions', 500);
  }
}

/**
 * POST /api/positions
 * Create a new position.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('Unauthorized', 401);
    if (session.user.userType !== 'superadmin') return errorResponse('Forbidden', 403);

    const body = await request.json();
    const { name, description } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return errorResponse('Position name is required');
    }

    const sanitizedName = sanitizeInput(name);
    const sanitizedDesc = description ? sanitizeInput(description) : '';

    let useDevStore = false;
    try {
      await dbConnect();
    } catch (error) {
      if (!isDevFallbackEnabled()) throw error;
      useDevStore = true;
    }

    if (useDevStore) {
      const store = getDevStore();
      const existing = store.positions.find(
        (position) => position.name.toLowerCase() === sanitizedName.toLowerCase()
      );

      if (existing) {
        return errorResponse('A position with this name already exists');
      }

      const now = new Date().toISOString();
      const position = {
        _id: createDevId('position'),
        name: sanitizedName,
        description: sanitizedDesc,
        isActive: true,
        createdAt: now,
        updatedAt: now,
        userCount: 0,
      };

      store.positions.unshift(position);
      return successResponse(position, 'Position created successfully', 201);
    }

    // Check uniqueness
    const existing = await Position.findOne({
      name: { $regex: new RegExp(`^${sanitizedName}$`, 'i') },
    });
    if (existing) {
      return errorResponse('A position with this name already exists');
    }

    const position = await Position.create({
      name: sanitizedName,
      description: sanitizedDesc,
      createdBy: session.user.id,
    });

    // Audit log
    const meta = getRequestMeta(request.headers);
    await auditAction(
      {
        userId: session.user.id,
        userName: session.user.name || 'SuperAdmin',
        userType: session.user.userType,
        action: 'create_position',
        module: 'user_permission',
        recordId: position._id,
        description: `Created position "${sanitizedName}"`,
        newValue: { name: sanitizedName, description: sanitizedDesc },
        ...meta,
      },
      request.headers
    );

    return successResponse(position, 'Position created successfully', 201);
  } catch (error) {
    console.error('POST /api/positions error:', error);
    return errorResponse('Failed to create position', 500);
  }
}
