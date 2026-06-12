import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth.config';

/**
 * Proxy uses the edge-compatible auth config (no database imports).
 * The `authorized` callback in auth.config.ts handles all route protection.
 */
export default NextAuth(authConfig).auth;

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|sw.js|offline.html|manifest).*)'],
};
