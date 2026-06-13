export const INVALID_LOGIN_PORTAL_MESSAGE =
  'You are using the wrong login portal.';

export const AUTH_ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  COMMUNITY_MEMBER: 'COMMUNITY_MEMBER',
  TURF_MANAGER: 'TURF_MANAGER',
  SHAREHOLDER: 'SHAREHOLDER',
} as const;

export const AUTH_ROLE_LABELS: Record<AuthRole, string> = {
  [AUTH_ROLES.SUPER_ADMIN]: 'Super Admin',
  [AUTH_ROLES.COMMUNITY_MEMBER]: 'Community Member',
  [AUTH_ROLES.TURF_MANAGER]: 'Turf Manager',
  [AUTH_ROLES.SHAREHOLDER]: 'Shareholder',
};

export type AuthRole = (typeof AUTH_ROLES)[keyof typeof AUTH_ROLES];
export type AuthPortal = 'superadmin' | 'committee' | 'turf' | 'shareholder';

export type PortalUser = {
  userType?: string | null;
  portalType?: string | null;
  role?: string | null;
};

export const PORTAL_AUTH_RULES: Record<
  AuthPortal,
  {
    role: AuthRole;
    userType: string;
    loginPath: string;
    portalPath: string;
    dashboardPath: string;
  }
> = {
  superadmin: {
    role: AUTH_ROLES.SUPER_ADMIN,
    userType: 'superadmin',
    loginPath: '/super-admin/login',
    portalPath: '/superadmin',
    dashboardPath: '/superadmin/dashboard',
  },
  committee: {
    role: AUTH_ROLES.COMMUNITY_MEMBER,
    userType: 'management',
    loginPath: '/community/login',
    portalPath: '/committee',
    dashboardPath: '/committee/dashboard',
  },
  turf: {
    role: AUTH_ROLES.TURF_MANAGER,
    userType: 'staff',
    loginPath: '/turf-manager/login',
    portalPath: '/turf-manager',
    dashboardPath: '/turf-manager/dashboard',
  },
  shareholder: {
    role: AUTH_ROLES.SHAREHOLDER,
    userType: 'management',
    loginPath: '/shareholder/login',
    portalPath: '/shareholder',
    dashboardPath: '/shareholder/dashboard',
  },
};

export function normalizeAuthPortal(value: unknown): AuthPortal | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();

  if (normalized === 'superadmin' || normalized === 'super-admin' || normalized === 'admin') {
    return 'superadmin';
  }

  if (
    normalized === 'committee' ||
    normalized === 'community' ||
    normalized === 'community-member'
  ) {
    return 'committee';
  }

  if (normalized === 'turf' || normalized === 'turf-manager') {
    return 'turf';
  }

  if (normalized === 'shareholder') {
    return 'shareholder';
  }

  return null;
}

export function getPortalFromPath(pathname: string): AuthPortal | null {
  const match = Object.entries(PORTAL_AUTH_RULES).find(([, rule]) =>
    pathname === rule.loginPath ||
    pathname.startsWith(`${rule.loginPath}/`) ||
    pathname === rule.portalPath ||
    pathname.startsWith(`${rule.portalPath}/`)
  );

  return (match?.[0] as AuthPortal | undefined) || null;
}

export function getPortalFromCallbackUrl(callbackUrl: string | null | undefined): AuthPortal | null {
  if (!callbackUrl) return null;

  try {
    const url = callbackUrl.startsWith('http')
      ? new URL(callbackUrl)
      : new URL(callbackUrl, 'http://localhost');
    return getPortalFromPath(url.pathname);
  } catch {
    return getPortalFromPath(callbackUrl);
  }
}

export function getAuthRoleForUser(user: PortalUser): AuthRole | null {
  const portal = normalizeAuthPortal(user.portalType);
  if (!portal) return null;

  const rule = PORTAL_AUTH_RULES[portal];
  return user.userType === rule.userType ? rule.role : null;
}

export function getAuthRoleLabel(role: string | null | undefined): string {
  return AUTH_ROLE_LABELS[role as AuthRole] || 'User';
}

export function isUserAllowedForPortal(user: PortalUser, portal: AuthPortal): boolean {
  const rule = PORTAL_AUTH_RULES[portal];
  const derivedRole = getAuthRoleForUser(user);

  return (
    user.portalType === portal &&
    user.userType === rule.userType &&
    derivedRole === rule.role &&
    (!user.role || user.role === rule.role)
  );
}

export function getDashboardPathForPortal(portal: string | null | undefined): string {
  const normalizedPortal = normalizeAuthPortal(portal);
  return normalizedPortal ? PORTAL_AUTH_RULES[normalizedPortal].dashboardPath : '/committee/dashboard';
}

export function getLoginPathForPortal(portal: string | null | undefined): string {
  const normalizedPortal = normalizeAuthPortal(portal);
  return normalizedPortal ? PORTAL_AUTH_RULES[normalizedPortal].loginPath : '/community/login';
}
