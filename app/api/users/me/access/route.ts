import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { auth } from '@/lib/auth';
import { getUserModuleAccess } from '@/lib/permissions';
import { getDevStore, isDevFallbackEnabled } from '@/lib/dev-store';
import { MODULE_DEFINITIONS } from '@/lib/constants';
import type { ModuleAccess } from '@/lib/permissions';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    let access: ModuleAccess[];
    try {
      access = await getUserModuleAccess(session.user.id);
    } catch (error) {
      if (!isDevFallbackEnabled()) throw error;
      const store = getDevStore();
      const user = store.users.find((item) => item._id === session.user.id);
      if (session.user.userType === 'superadmin') {
        access = MODULE_DEFINITIONS.map((mod) => ({
          moduleKey: mod.moduleKey,
          accessLevel: 'full_control',
          enabledActions: mod.availableActions,
          source: 'position',
        }));
      } else if (user?.portalType === 'committee') {
        access = store.moduleMappings
          .filter((mapping) => mapping.userId === session.user.id && mapping.isActive)
          .map((mapping) => ({
            moduleKey: mapping.moduleKey,
            accessLevel: mapping.accessLevel,
            enabledActions: mapping.enabledActions,
            source: 'override',
          }));
      } else if (user?.portalType === 'turf' || user?.portalType === 'shareholder') {
        access = store.portalMappings
          .filter((mapping) => mapping.portalType === user.portalType && mapping.isActive)
          .map((mapping) => ({
            moduleKey: mapping.moduleKey,
            accessLevel: mapping.accessLevel,
            enabledActions: mapping.enabledActions,
            source: 'portal',
          }));
      } else {
        access = [];
      }
    }

    return NextResponse.json({
      success: true,
      data: access,
    });
  } catch (error) {
    console.error('Failed to fetch user access:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
