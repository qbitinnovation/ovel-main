import NextAuth from 'next-auth';
import { CredentialsSignin } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import dbConnect from '@/lib/db';
import UserModel from '@/models/User';
import PositionModel from '@/models/Position';
import SystemSettings from '@/models/SystemSettings';
import { authConfig } from '@/lib/auth.config';
import { getDevStore, isDevFallbackEnabled } from '@/lib/dev-store';
import {
  getAuthRoleForUser,
  getAuthRoleLabel,
  INVALID_LOGIN_PORTAL_MESSAGE,
  isUserAllowedForPortal,
  normalizeAuthPortal,
} from '@/lib/portal-auth';

class InvalidPortalSigninError extends CredentialsSignin {
  code = 'invalid_portal';
}

const DEFAULT_ORGANIZATION_NAME = process.env.ORGANIZATION_NAME || 'Oval Turf';

const DEV_DEMO_USERS = [
  {
    email: process.env.SUPERADMIN_EMAIL || 'admin@ovalturf.com',
    password: process.env.SUPERADMIN_PASSWORD || 'Admin@123',
    name: 'Super Admin',
    userType: 'superadmin',
    portalType: 'superadmin',
    role: 'SUPER_ADMIN',
  },
] as const;

function validatePortalLogin(user: { userType: string; portalType: string }, requestedPortal: ReturnType<typeof normalizeAuthPortal>) {
  if (requestedPortal && !isUserAllowedForPortal(user, requestedPortal)) {
    throw new InvalidPortalSigninError(INVALID_LOGIN_PORTAL_MESSAGE);
  }
}

async function getOrganizationName() {
  try {
    const setting = await SystemSettings.findOne({
      key: { $in: ['organization_name', 'turf_name', 'club_name'] },
    }).lean();

    return typeof setting?.value === 'string' && setting.value.trim()
      ? setting.value.trim()
      : DEFAULT_ORGANIZATION_NAME;
  } catch {
    return DEFAULT_ORGANIZATION_NAME;
  }
}

async function getPositionName(positionId: unknown) {
  if (!positionId) return null;

  try {
    const position = await PositionModel.findById(positionId).select('name').lean();
    return typeof position?.name === 'string' && position.name.trim() ? position.name.trim() : null;
  } catch {
    return null;
  }
}

function getDevPositionName(positionId: string | null) {
  if (!positionId) return null;
  const position = getDevStore().positions.find((item) => item._id === positionId);
  return position?.name || null;
}

function getDevDemoUser(email: string, password: string, requestedPortal: ReturnType<typeof normalizeAuthPortal>) {
  if (process.env.NODE_ENV !== 'development') return null;

  const demoUser = DEV_DEMO_USERS.find((user) => user.email.toLowerCase() === email);
  if (!demoUser || demoUser.password !== password) return null;

  validatePortalLogin(demoUser, requestedPortal);

  let demoId = `demo-${demoUser.portalType}`;
  if (demoUser.portalType === 'superadmin') {
    demoId = '000000000000000000000001';
  } else if (demoUser.portalType === 'committee') {
    demoId = '000000000000000000000002';
  } else if (demoUser.portalType === 'shareholder') {
    demoId = '000000000000000000000004';
  }

  return {
    id: demoId,
    name: demoUser.name,
    email: demoUser.email,
    userType: demoUser.userType,
    portalType: demoUser.portalType,
    role: demoUser.role,
    roleLabel: getAuthRoleLabel(demoUser.role),
    positionName: null,
    organizationName: DEFAULT_ORGANIZATION_NAME,
    loginPortal: requestedPortal || null,
    positionId: null,
    mustChangePassword: false,
  };
}

async function getDevStoredUser(email: string, password: string, requestedPortal: ReturnType<typeof normalizeAuthPortal>) {
  if (process.env.NODE_ENV !== 'development' || !isDevFallbackEnabled()) return null;

  const devUser = getDevStore().users.find((user) => user.email.toLowerCase() === email);
  if (!devUser?.passwordHash) return null;

  const isValid = await bcrypt.compare(password, devUser.passwordHash);
  if (!isValid || !devUser.isActive || devUser.isArchived) return null;

  validatePortalLogin(devUser, requestedPortal);

  devUser.lastLogin = new Date().toISOString();
  devUser.updatedAt = devUser.lastLogin;

  return {
    id: devUser._id,
    name: devUser.name,
    email: devUser.email,
    userType: devUser.userType,
    portalType: devUser.portalType,
    role: getAuthRoleForUser(devUser) || '',
    roleLabel: getAuthRoleLabel(getAuthRoleForUser(devUser)),
    positionName: getDevPositionName(devUser.positionId),
    organizationName: DEFAULT_ORGANIZATION_NAME,
    loginPortal: requestedPortal || null,
    positionId: devUser.positionId,
    mustChangePassword: devUser.mustChangePassword,
  };
}

// Extend the built-in types
declare module 'next-auth' {
  interface User {
    id: string;
    userType: string;
    portalType: string;
    role: string;
    roleLabel: string;
    positionName: string | null;
    organizationName: string;
    loginPortal: string | null;
    positionId: string | null;
    mustChangePassword: boolean;
  }

  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      userType: string;
      portalType: string;
      role: string;
      roleLabel: string;
      positionName: string | null;
      organizationName: string;
      loginPortal: string | null;
      positionId: string | null;
      mustChangePassword: boolean;
    };
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    id: string;
    userType: string;
    portalType: string;
    role: string;
    roleLabel: string;
    positionName: string | null;
    organizationName: string;
    loginPortal: string | null;
    positionId: string | null;
    mustChangePassword: boolean;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        portal: { label: 'Portal', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password are required');
        }

        const email = (credentials.email as string).toLowerCase().trim();
        const password = credentials.password as string;
        const requestedPortal = normalizeAuthPortal(credentials.portal);

        if (!requestedPortal) {
          throw new InvalidPortalSigninError(INVALID_LOGIN_PORTAL_MESSAGE);
        }

        const immediateDemoUser = getDevDemoUser(email, password, requestedPortal);

        if (immediateDemoUser) {
          return immediateDemoUser;
        }

        try {
          await dbConnect();
        } catch (error) {
          const demoUser = getDevDemoUser(email, password, requestedPortal);
          if (demoUser) {
            console.warn('MongoDB unavailable; using development demo login.');
            return demoUser;
          }
          const devStoredUser = await getDevStoredUser(email, password, requestedPortal);
          if (devStoredUser) {
            console.warn('MongoDB unavailable; using development stored user login.');
            return devStoredUser;
          }
          if (isDevFallbackEnabled()) {
            return null;
          }
          throw error;
        }

        const user = await UserModel.findOne({ email }).select('+password');

        if (!user) {
          return null;
        }

        if (!user.isActive) {
          throw new Error('Your account has been deactivated. Contact SuperAdmin.');
        }

        if (user.isArchived) {
          throw new Error('Your account has been archived. Contact SuperAdmin.');
        }

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
          return null;
        }

        validatePortalLogin(user, requestedPortal);

        const authRole = getAuthRoleForUser(user) || '';
        const [positionName, organizationName] = await Promise.all([
          getPositionName(user.positionId),
          getOrganizationName(),
        ]);

        // Update last login
        await UserModel.findByIdAndUpdate(user._id, { lastLogin: new Date() });

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          userType: user.userType,
          portalType: user.portalType,
          role: authRole,
          roleLabel: getAuthRoleLabel(authRole),
          positionName,
          organizationName,
          loginPortal: requestedPortal || null,
          positionId: user.positionId?.toString() || null,
          mustChangePassword: user.mustChangePassword,
        };
      },
    }),
  ],
});
