import type { NextAuthConfig } from 'next-auth';
import {
  getDashboardPathForPortal,
  getAuthRoleLabel,
  getLoginPathForPortal,
  getPortalFromPath,
  isUserAllowedForPortal,
  PORTAL_AUTH_RULES,
} from '@/lib/portal-auth';

// Dynamically determine the base URL for NextAuth / Auth.js
const getBaseUrl = () => {
  if (process.env.AUTH_URL) return process.env.AUTH_URL;
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL;
  if (process.env.COOLIFY_URL) return process.env.COOLIFY_URL;
  if (process.env.COOLIFY_FQDN) {
    const fqdn = process.env.COOLIFY_FQDN;
    // Handle comma-separated list of domains if present in Coolify
    const primaryFqdn = fqdn.split(',')[0].trim();
    return primaryFqdn.startsWith('http') ? primaryFqdn : `https://${primaryFqdn}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
};

const baseUrl = getBaseUrl();
process.env.AUTH_URL = baseUrl;
process.env.NEXTAUTH_URL = baseUrl;
process.env.AUTH_TRUST_HOST = 'true';

type AuthUserFields = {
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

function invalidPortalLoginUrl(nextUrl: URL): URL {
  const requestedPortal = getPortalFromPath(nextUrl.pathname);
  const loginUrl = new URL(getLoginPathForPortal(requestedPortal), nextUrl);
  loginUrl.searchParams.set('error', 'InvalidPortal');
  loginUrl.searchParams.set('callbackUrl', `${nextUrl.pathname}${nextUrl.search}`);
  return loginUrl;
}

function portalLoginUrl(nextUrl: URL): URL {
  const requestedPortal = getPortalFromPath(nextUrl.pathname);
  const loginUrl = new URL(getLoginPathForPortal(requestedPortal), nextUrl);
  loginUrl.searchParams.set('callbackUrl', `${nextUrl.pathname}${nextUrl.search}`);
  return loginUrl;
}

/**
 * Edge-compatible auth config - NO database imports.
 * This is used by proxy.ts. The full Credentials provider is in auth.ts.
 */
export const authConfig: NextAuthConfig = {
  trustHost: true,
  pages: {
    signIn: '/community/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60,
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const pathname = nextUrl.pathname;

      const publicPaths = [
        '/login',
        '/admin/login',
        '/super-admin/login',
        '/superadmin/login',
        '/community/login',
        '/committee/login',
        '/turf-manager/login',
        '/turf/login',
        '/shareholder/login',
        '/api/auth',
      ];
      if (publicPaths.some((p) => pathname.startsWith(p))) {
        const requestedPortal = getPortalFromPath(pathname);
        if (isLoggedIn && requestedPortal) {
          const user = auth?.user as { role?: string; userType?: string; portalType?: string };

          if (!isUserAllowedForPortal(user, requestedPortal)) {
            return true;
          }

          return Response.redirect(new URL(getDashboardPathForPortal(user.portalType), nextUrl));
        }

        return true;
      }

      if (pathname === '/') {
        if (!isLoggedIn) {
          return Response.redirect(new URL('/community/login', nextUrl));
        }

        const user = auth?.user as Record<string, unknown>;
        return Response.redirect(new URL(getDashboardPathForPortal(user?.portalType as string), nextUrl));
      }

      const requestedPortal = getPortalFromPath(pathname);

      if (!isLoggedIn) {
        return requestedPortal ? Response.redirect(portalLoginUrl(nextUrl)) : false;
      }

      const user = auth?.user as Record<string, unknown>;
      if (
        requestedPortal &&
        !isUserAllowedForPortal(
          {
            userType: user?.userType as string,
            portalType: user?.portalType as string,
            role: user?.role as string,
          },
          requestedPortal
        )
      ) {
        return Response.redirect(invalidPortalLoginUrl(nextUrl));
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        const authUser = user as AuthUserFields;
        token.id = user.id as string;
        token.userType = authUser.userType;
        token.portalType = authUser.portalType;
        token.role =
          authUser.role ||
          PORTAL_AUTH_RULES[authUser.portalType as keyof typeof PORTAL_AUTH_RULES]?.role ||
          '';
        token.roleLabel = authUser.roleLabel || '';
        token.positionName = authUser.positionName || null;
        token.organizationName = authUser.organizationName || 'Oval Turf';
        token.loginPortal = authUser.loginPortal || null;
        token.positionId = authUser.positionId;
        token.mustChangePassword = authUser.mustChangePassword;
      }
      token.roleLabel = (token.roleLabel as string | undefined) || getAuthRoleLabel(token.role as string);
      token.positionName = (token.positionName as string | null | undefined) || null;
      token.organizationName = (token.organizationName as string | undefined) || 'Oval Turf';
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        let tokenId = token.id as string;
        if (process.env.NODE_ENV === 'development' && !/^[0-9a-fA-F]{24}$/.test(tokenId)) {
          if (tokenId.includes('superadmin')) tokenId = '000000000000000000000001';
          else if (tokenId.includes('committee')) tokenId = '000000000000000000000002';
          else if (tokenId.includes('turf')) tokenId = '000000000000000000000003';
          else if (tokenId.includes('shareholder')) tokenId = '000000000000000000000004';
          else tokenId = '000000000000000000000001';
        }

        session.user.id = tokenId;
        session.user.userType = token.userType as string;
        session.user.portalType = token.portalType as string;
        session.user.role = token.role as string;
        session.user.roleLabel = token.roleLabel as string;
        session.user.positionName = token.positionName as string | null;
        session.user.organizationName = token.organizationName as string;
        session.user.loginPortal = token.loginPortal as string | null;
        session.user.positionId = token.positionId as string | null;
        session.user.mustChangePassword = token.mustChangePassword as boolean;
      }
      return session;
    },
  },
  providers: [],
  secret: process.env.NEXTAUTH_SECRET,
};
