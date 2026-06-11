import dbConnect from '@/lib/db';
import PositionModuleMapping from '@/models/PositionModuleMapping';
import UserOverride from '@/models/UserOverride';
import User from '@/models/User';
import { USER_TYPES } from '@/lib/constants';
import type { Types } from 'mongoose';

export interface PermissionCheckResult {
  allowed: boolean;
  accessLevel: string | null;
  reason: string;
}

/**
 * Check if a user has permission to perform a specific action on a module.
 *
 * Flow:
 * 1. SuperAdmin always has full access to everything.
 * 2. Fetch user's position.
 * 3. Query position_module_mappings for the module.
 * 4. Check if the required action is enabled.
 * 5. Check user overrides (extend/restrict) and apply them.
 */
export async function checkPermission(
  userId: string | Types.ObjectId,
  moduleKey: string,
  requiredAction: string
): Promise<PermissionCheckResult> {
  await dbConnect();

  // Fetch user
  const user = await User.findById(userId);
  if (!user) {
    return { allowed: false, accessLevel: null, reason: 'User not found' };
  }

  if (!user.isActive || user.isArchived) {
    return { allowed: false, accessLevel: null, reason: 'User account is inactive or archived' };
  }

  // SuperAdmin has full access to everything
  if (user.userType === USER_TYPES.SUPERADMIN) {
    return { allowed: true, accessLevel: 'full_control', reason: 'SuperAdmin has full access' };
  }

  // Check individual override first (it can extend or restrict)
  const override = await UserOverride.findOne({
    userId: user._id,
    moduleKey,
    isActive: true,
  });

  // If there's a restrict override that disables this action
  if (override && override.overrideType === 'restrict') {
    if (override.disabledActions.includes(requiredAction)) {
      return {
        allowed: false,
        accessLevel: null,
        reason: `Action "${requiredAction}" is restricted by individual override`,
      };
    }
  }

  // If there's an extend override that enables this action
  if (override && override.overrideType === 'extend') {
    if (override.enabledActions.includes(requiredAction)) {
      return {
        allowed: true,
        accessLevel: override.accessLevel || 'edit',
        reason: 'Access granted via individual override',
      };
    }
  }

  // Check position-based mapping
  if (!user.positionId) {
    return {
      allowed: false,
      accessLevel: null,
      reason: 'No position assigned. Contact SuperAdmin.',
    };
  }

  const mapping = await PositionModuleMapping.findOne({
    positionId: user.positionId,
    moduleKey,
    isActive: true,
  });

  if (!mapping) {
    return {
      allowed: false,
      accessLevel: null,
      reason: `Module "${moduleKey}" is not mapped to your position`,
    };
  }

  if (!mapping.enabledActions.includes(requiredAction)) {
    return {
      allowed: false,
      accessLevel: mapping.accessLevel,
      reason: `Action "${requiredAction}" is not enabled for your position on this module`,
    };
  }

  return {
    allowed: true,
    accessLevel: mapping.accessLevel,
    reason: 'Access granted via position mapping',
  };
}

/**
 * Get all module access for a user (used to build navigation/UI).
 */
export interface ModuleAccess {
  moduleKey: string;
  accessLevel: string;
  enabledActions: string[];
  source: 'position' | 'override';
}

export async function getUserModuleAccess(
  userId: string | Types.ObjectId
): Promise<ModuleAccess[]> {
  await dbConnect();

  const user = await User.findById(userId);
  if (!user || !user.isActive || user.isArchived) return [];

  // SuperAdmin has access to all modules
  if (user.userType === USER_TYPES.SUPERADMIN) {
    const { MODULE_DEFINITIONS } = await import('@/lib/constants');
    return MODULE_DEFINITIONS.map((mod) => ({
      moduleKey: mod.moduleKey,
      accessLevel: 'full_control',
      enabledActions: mod.availableActions,
      source: 'position' as const,
    }));
  }

  const accessMap = new Map<string, ModuleAccess>();

  // Get position mappings
  if (user.positionId) {
    const mappings = await PositionModuleMapping.find({
      positionId: user.positionId,
      isActive: true,
    });

    for (const mapping of mappings) {
      accessMap.set(mapping.moduleKey, {
        moduleKey: mapping.moduleKey,
        accessLevel: mapping.accessLevel,
        enabledActions: [...mapping.enabledActions],
        source: 'position',
      });
    }
  }

  // Apply overrides
  const overrides = await UserOverride.find({
    userId: user._id,
    isActive: true,
  });

  for (const override of overrides) {
    const existing = accessMap.get(override.moduleKey);

    if (override.overrideType === 'extend') {
      if (existing) {
        // Add extra actions
        const actions = new Set([...existing.enabledActions, ...override.enabledActions]);
        existing.enabledActions = Array.from(actions);
        if (override.accessLevel) existing.accessLevel = override.accessLevel;
      } else {
        // New module access via override
        accessMap.set(override.moduleKey, {
          moduleKey: override.moduleKey,
          accessLevel: override.accessLevel || 'view',
          enabledActions: [...override.enabledActions],
          source: 'override',
        });
      }
    } else if (override.overrideType === 'restrict' && existing) {
      // Remove specific actions
      existing.enabledActions = existing.enabledActions.filter(
        (a) => !override.disabledActions.includes(a)
      );
      // If all actions removed, remove module access entirely
      if (existing.enabledActions.length === 0) {
        accessMap.delete(override.moduleKey);
      }
    }
  }

  return Array.from(accessMap.values());
}
