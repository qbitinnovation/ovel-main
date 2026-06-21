import { type NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import Position from '@/models/Position';
import Checklist from '@/models/Checklist';
import Notification from '@/models/Notification';
import UserOverride from '@/models/UserOverride';
import bcrypt from 'bcryptjs';
import { auditAction } from '@/lib/audit';
import { getUserModuleAccess } from '@/lib/permissions';
import { successResponse, errorResponse, sanitizeInput, getRequestMeta } from '@/lib/utils';
import { createDevId, getDevStore, isDevFallbackEnabled, populateDevUserPosition } from '@/lib/dev-store';

const VALID_PORTAL_TYPES = ['committee', 'turf', 'shareholder'];
const USER_TYPE_BY_PORTAL: Record<string, 'management' | 'staff'> = {
  committee: 'management',
  turf: 'staff',
  shareholder: 'management',
};

/**
 * GET /api/users/[id]
 * Get single user with position details and module access summary.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('Unauthorized', 401);
    if (session.user.userType !== 'superadmin') return errorResponse('Forbidden', 403);

    const { id } = await params;
    await dbConnect();

    const user = await User.findById(id)
      .select('-password')
      .populate('positionId', 'name description isActive');

    if (!user) return errorResponse('User not found', 404);

    // Get module access
    const moduleAccess = await getUserModuleAccess(id);

    return successResponse({ user, moduleAccess });
  } catch (error) {
    console.error('GET /api/users/[id] error:', error);
    return errorResponse('Failed to fetch user', 500);
  }
}

/**
 * PUT /api/users/[id]
 * Edit user details (name, phone, portalType).
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
    const { name, phone, portalType, positionName } = body;
    const nextPortalType = portalType && VALID_PORTAL_TYPES.includes(portalType) ? portalType : undefined;
    const sanitizedPositionName =
      nextPortalType === 'committee' && positionName?.trim() ? sanitizeInput(positionName) : '';

    let useDevStore = false;
    try {
      await dbConnect();
    } catch (error) {
      if (!isDevFallbackEnabled()) throw error;
      useDevStore = true;
    }

    if (useDevStore) {
      const store = getDevStore();
      const user = store.users.find((item) => item._id === id);
      if (!user) return errorResponse('User not found', 404);

      if (name?.trim()) user.name = sanitizeInput(name);
      if (phone?.trim()) user.phone = sanitizeInput(phone);
      if (nextPortalType) {
        user.portalType = nextPortalType;
        user.userType = USER_TYPE_BY_PORTAL[nextPortalType];
      }

      if (user.portalType === 'committee') {
        if (!sanitizedPositionName) return errorResponse('Committee member position is required');
        user.positionId = getOrCreateDevPositionId(sanitizedPositionName);
      } else {
        user.positionId = null;
      }

      user.updatedAt = new Date().toISOString();
      return successResponse(populateDevUserPosition(user), 'User updated');
    }

    const user = await User.findById(id);
    if (!user) return errorResponse('User not found', 404);

    const oldValue: Record<string, unknown> = {};
    const newValue: Record<string, unknown> = {};

    if (name?.trim()) {
      oldValue.name = user.name;
      user.name = sanitizeInput(name);
      newValue.name = user.name;
    }
    if (phone?.trim()) {
      oldValue.phone = user.phone;
      user.phone = sanitizeInput(phone);
      newValue.phone = user.phone;
    }
    if (nextPortalType) {
      oldValue.portalType = user.portalType;
      oldValue.userType = user.userType;
      user.portalType = nextPortalType;
      user.userType = USER_TYPE_BY_PORTAL[nextPortalType];
      newValue.portalType = nextPortalType;
      newValue.userType = user.userType;
    }

    if (user.portalType === 'committee') {
      if (!sanitizedPositionName) return errorResponse('Committee member position is required');
      const oldPositionId = user.positionId;
      user.positionId = await getOrCreatePositionId(sanitizedPositionName, session.user.id);
      oldValue.positionId = oldPositionId;
      newValue.positionName = sanitizedPositionName;
    } else {
      oldValue.positionId = user.positionId;
      user.positionId = null;
      newValue.positionId = null;
    }

    await user.save();

    const meta = getRequestMeta(request.headers);
    try {
      await auditAction({
        userId: session.user.id,
        userName: session.user.name || 'SuperAdmin',
        userType: session.user.userType,
        action: 'edit_user',
        module: 'user_permission',
        recordId: user._id,
        description: `Edited user ${user.name}`,
        oldValue,
        newValue,
        ...meta,
      }, request.headers);
    } catch (auditErr) {
      console.error('Audit log failed during user edit:', auditErr);
    }

    const updatedUser = await User.findById(id)
      .select('-password')
      .populate('positionId', 'name description isActive');

    return successResponse(updatedUser, 'User updated');
  } catch (error) {
    console.error('PUT /api/users/[id] error:', error);
    return errorResponse('Failed to update user', 500);
  }
}

function getOrCreateDevPositionId(positionName: string) {
  const store = getDevStore();
  let position = store.positions.find(
    (item) => item.name.toLowerCase() === positionName.toLowerCase()
  );

  if (!position) {
    const now = new Date().toISOString();
    position = {
      _id: createDevId('position'),
      name: positionName,
      description: 'Created from committee member setup',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    store.positions.unshift(position);
  } else if (!position.isActive) {
    position.isActive = true;
    position.updatedAt = new Date().toISOString();
  }

  return position._id;
}

async function getOrCreatePositionId(positionName: string, createdBy: string) {
  let position = await Position.findOne({
    name: { $regex: new RegExp(`^${escapeRegExp(positionName)}$`, 'i') },
  });

  if (!position) {
    position = await Position.create({
      name: positionName,
      description: 'Created from committee member setup',
      createdBy,
    });
  } else if (!position.isActive) {
    position.isActive = true;
    await position.save();
  }

  return position._id.toString();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * PATCH /api/users/[id]
 * Status actions: deactivate, reactivate, archive, unarchive, reset-password, assign-position
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
    const body = await request.json();
    const { action } = body;

    let useDevStore = false;
    try {
      await dbConnect();
    } catch (error) {
      if (!isDevFallbackEnabled()) throw error;
      useDevStore = true;
    }

    if (useDevStore) {
      const store = getDevStore();
      const user = store.users.find((item) => item._id === id);
      if (!user) return errorResponse('User not found', 404);

      let description = '';

      switch (action) {
        case 'deactivate':
          user.isActive = false;
          description = `Deactivated user ${user.name}`;
          break;
        case 'reactivate':
          user.isActive = true;
          user.isArchived = false;
          description = `Reactivated user ${user.name}`;
          break;
        case 'archive':
          user.isArchived = true;
          user.isActive = false;
          description = `Archived user ${user.name}`;
          break;
        case 'unarchive':
          user.isArchived = false;
          user.isActive = true;
          description = `Unarchived user ${user.name}`;
          break;
        case 'reset-password': {
          const newPassword = body.password || Math.random().toString(36).slice(-8) + 'A1!';
          user.passwordHash = newPassword;
          user.mustChangePassword = true;
          user.updatedAt = new Date().toISOString();
          return successResponse({ tempPassword: body.password ? undefined : newPassword }, 'Password reset');
        }
        case 'assign-position': {
          const { positionId } = body;
          if (positionId === null || positionId === '') {
            user.positionId = null;
            description = `Removed position from ${user.name}`;
          } else {
            const position = store.positions.find((p) => p._id === positionId);
            if (!position) return errorResponse('Position not found', 404);
            if (!position.isActive) return errorResponse('Cannot assign an inactive position');
            user.positionId = position._id;
            description = `Assigned ${position.name} position to ${user.name}`;
          }
          break;
        }
        default:
          return errorResponse('Invalid action');
      }

      user.updatedAt = new Date().toISOString();
      return successResponse(populateDevUserPosition(user), description);
    }

    const user = await User.findById(id);
    if (!user) return errorResponse('User not found', 404);

    const meta = getRequestMeta(request.headers);
    let description = '';

    switch (action) {
      case 'deactivate':
        user.isActive = false;
        description = `Deactivated user ${user.name}`;
        break;

      case 'reactivate':
        user.isActive = true;
        user.isArchived = false;
        description = `Reactivated user ${user.name}`;
        break;

      case 'archive':
        user.isArchived = true;
        user.isActive = false;
        description = `Archived user ${user.name}`;
        break;

      case 'unarchive':
        user.isArchived = false;
        user.isActive = true;
        description = `Unarchived user ${user.name}`;
        break;

      case 'reset-password': {
        const newPassword = body.password || Math.random().toString(36).slice(-8) + 'A1!';
        user.password = await bcrypt.hash(newPassword, 12);
        user.mustChangePassword = true;
        description = `Reset password for ${user.name}`;
        await user.save();

        try {
          await auditAction({
            userId: session.user.id,
            userName: session.user.name || 'SuperAdmin',
            userType: session.user.userType,
            action: 'reset_password',
            module: 'user_permission',
            recordId: user._id,
            description,
            ...meta,
          }, request.headers);
        } catch (auditErr) {
          console.error('Audit log failed during password reset:', auditErr);
        }

        return successResponse({ tempPassword: body.password ? undefined : newPassword }, 'Password reset');
      }

      case 'assign-position': {
        const { positionId } = body;
        const oldPositionId = user.positionId;

        if (positionId === null || positionId === '') {
          user.positionId = null;
          description = `Removed position from ${user.name}`;
        } else {
          const position = await Position.findById(positionId);
          if (!position) return errorResponse('Position not found', 404);
          if (!position.isActive) return errorResponse('Cannot assign an inactive position');
          user.positionId = position._id.toString();
          description = `Assigned ${position.name} position to ${user.name}`;
        }

        await user.save();

        // Get new module access for audit log detail
        const moduleAccess = await getUserModuleAccess(user._id);
        const accessSummary = moduleAccess.map(
          (m) => `${m.moduleKey}: ${m.accessLevel}`
        ).join(', ');

        try {
          await auditAction({
            userId: session.user.id,
            userName: session.user.name || 'SuperAdmin',
            userType: session.user.userType,
            action: 'assign_position_to_user',
            module: 'user_permission',
            recordId: user._id,
            description: `${description}. Access: ${accessSummary || 'None'}`,
            oldValue: { positionId: oldPositionId },
            newValue: { positionId: user.positionId },
            ...meta,
          }, request.headers);
        } catch (auditErr) {
          console.error('Audit log failed during position assignment:', auditErr);
        }

        const updatedUser = await User.findById(id)
          .select('-password')
          .populate('positionId', 'name description isActive');

        return successResponse(updatedUser, description);
      }

      default:
        return errorResponse('Invalid action');
    }

    await user.save();

    try {
      await auditAction({
        userId: session.user.id,
        userName: session.user.name || 'SuperAdmin',
        userType: session.user.userType,
        action: action,
        module: 'user_permission',
        recordId: user._id,
        description,
        ...meta,
      }, request.headers);
    } catch (auditErr) {
      console.error('Audit log failed during user status change:', auditErr);
    }

    const updatedUser = await User.findById(id)
      .select('-password')
      .populate('positionId', 'name description isActive');

    return successResponse(updatedUser, description);
  } catch (error) {
    console.error('PATCH /api/users/[id] error:', error);
    return errorResponse('Failed to perform action', 500);
  }
}

/**
 * DELETE /api/users/[id]
 * Permanently delete a portal user account.
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
    if (id === session.user.id) return errorResponse('You cannot delete your own account');

    let useDevStore = false;
    try {
      await dbConnect();
    } catch (error) {
      if (!isDevFallbackEnabled()) throw error;
      useDevStore = true;
    }

    if (useDevStore) {
      const store = getDevStore();
      const userIndex = store.users.findIndex((item) => item._id === id);
      if (userIndex < 0) return errorResponse('User not found', 404);

      const [user] = store.users.splice(userIndex, 1);
      store.checklists = store.checklists.filter((checklist) => checklist.staffId !== id);

      return successResponse({ deletedUserId: id }, `Deleted user ${user.name}`);
    }

    const user = await User.findById(id);
    if (!user) return errorResponse('User not found', 404);
    if (user.userType === 'superadmin' || user.portalType === 'superadmin') {
      return errorResponse('Super Admin accounts cannot be deleted from this page');
    }

    const meta = getRequestMeta(request.headers);
    const deletedUserSnapshot = {
      name: user.name,
      email: user.email,
      phone: user.phone,
      userType: user.userType,
      portalType: user.portalType,
      positionId: user.positionId,
    };

    await Checklist.deleteMany({ staffId: user._id });
    await Notification.deleteMany({ userId: user._id });
    await UserOverride.deleteMany({ userId: user._id });
    await User.deleteOne({ _id: user._id });

    try {
      await auditAction({
        userId: session.user.id,
        userName: session.user.name || 'SuperAdmin',
        userType: session.user.userType,
        action: 'delete_user',
        module: 'user_permission',
        recordId: user._id,
        description: `Deleted user ${user.name}`,
        oldValue: deletedUserSnapshot,
        ...meta,
      }, request.headers);
    } catch (auditErr) {
      console.error('Audit log failed during user deletion:', auditErr);
    }

    return successResponse({ deletedUserId: id }, `Deleted user ${user.name}`);
  } catch (error) {
    console.error('DELETE /api/users/[id] error:', error);
    return errorResponse('Failed to delete user', 500);
  }
}
