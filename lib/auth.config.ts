import type { NextAuthConfig } from 'next-auth';

type AuthUserFields = {
  userType: string;
  portalType: string;
  positionId: string | null;
  mustChangePassword: boolean;
};

/**
 * Edge-compatible auth config — NO database imports.
 * This is used by the middleware which runs in the edge runtime.
 * The full auth config with Credentials provider is in auth.ts.
 */
export const authConfig: NextAuthConfig = {
  trustHost: true,
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60,
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const pathname = nextUrl.pathname;

      // Public paths
      const publicPaths = ['/login', '/api/auth'];
      if (publicPaths.some((p) => pathname.startsWith(p))) {
        // Redirect logged-in users away from login
        if (isLoggedIn && pathname === '/login') {
          const portalType = (auth?.user as { portalType?: string })?.portalType || 'committee';
          const portalPaths: Record<string, string> = {
            superadmin: '/superadmin/dashboard',
            committee: '/committee/dashboard',
            turf: '/turf-manager/dashboard',
            shareholder: '/shareholder/dashboard',
          };
          return Response.redirect(new URL(portalPaths[portalType] || '/committee/dashboard', nextUrl));
        }
        return true;
      }

      // Not authenticated — redirect to login
      if (!isLoggedIn) {
        return false; // NextAuth redirects to signIn page
      }

      const user = auth?.user as Record<string, unknown>;

      // Root path — redirect to appropriate portal
      if (pathname === '/') {
        const portalType = (user?.portalType as string) || 'committee';
        const portalPaths: Record<string, string> = {
          superadmin: '/superadmin/dashboard',
          committee: '/committee/dashboard',
          turf: '/turf-manager/dashboard',
          shareholder: '/shareholder/dashboard',
        };
        return Response.redirect(new URL(portalPaths[portalType] || '/committee/dashboard', nextUrl));
      }

      // Cross-portal protection
      const portalPrefixes: Record<string, string> = {
        superadmin: '/superadmin',
        committee: '/committee',
        turf: '/turf-manager',
        shareholder: '/shareholder',
      };
      const userPortalType = (user?.portalType as string) || 'committee';
      for (const [portalType, prefix] of Object.entries(portalPrefixes)) {
        if (pathname.startsWith(prefix) && portalType !== userPortalType) {
          const correctPath = portalPrefixes[userPortalType] || '/committee';
          return Response.redirect(new URL(`${correctPath}/dashboard`, nextUrl));
        }
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        const authUser = user as AuthUserFields;
        token.id = user.id as string;
        token.userType = authUser.userType;
        token.portalType = authUser.portalType;
        token.positionId = authUser.positionId;
        token.mustChangePassword = authUser.mustChangePassword;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.userType = token.userType as string;
        session.user.portalType = token.portalType as string;
        session.user.positionId = token.positionId as string | null;
        session.user.mustChangePassword = token.mustChangePassword as boolean;
      }
      return session;
    },
  },
  providers: [], // Providers are added in auth.ts (not edge-compatible)
  secret: process.env.NEXTAUTH_SECRET,
};
