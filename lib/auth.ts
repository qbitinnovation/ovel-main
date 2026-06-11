import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import dbConnect from '@/lib/db';
import UserModel from '@/models/User';
import { authConfig } from '@/lib/auth.config';

const DEV_DEMO_USERS = [
  {
    email: process.env.SUPERADMIN_EMAIL || 'admin@ovalturf.com',
    password: process.env.SUPERADMIN_PASSWORD || 'Admin@123',
    name: 'Super Admin',
    userType: 'superadmin',
    portalType: 'superadmin',
  },
  {
    email: 'committee@ovalturf.com',
    password: 'Committee@123',
    name: 'Committee Demo',
    userType: 'management',
    portalType: 'committee',
  },
  {
    email: 'turf@ovalturf.com',
    password: 'Turf@123',
    name: 'Turf Demo',
    userType: 'staff',
    portalType: 'turf',
  },
  {
    email: 'shareholder@ovalturf.com',
    password: 'Shareholder@123',
    name: 'Shareholder Demo',
    userType: 'management',
    portalType: 'shareholder',
  },
] as const;

function getDevDemoUser(email: string, password: string) {
  if (process.env.NODE_ENV !== 'development') return null;

  const demoUser = DEV_DEMO_USERS.find((user) => user.email.toLowerCase() === email);
  if (!demoUser || demoUser.password !== password) return null;

  return {
    id: `demo-${demoUser.portalType}`,
    name: demoUser.name,
    email: demoUser.email,
    userType: demoUser.userType,
    portalType: demoUser.portalType,
    positionId: null,
    mustChangePassword: false,
  };
}

// Extend the built-in types
declare module 'next-auth' {
  interface User {
    id: string;
    userType: string;
    portalType: string;
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
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password are required');
        }

        const email = (credentials.email as string).toLowerCase().trim();
        const password = credentials.password as string;
        const immediateDemoUser = getDevDemoUser(email, password);

        if (immediateDemoUser) {
          return immediateDemoUser;
        }

        try {
          await dbConnect();
        } catch (error) {
          const demoUser = getDevDemoUser(email, password);
          if (demoUser) {
            console.warn('MongoDB unavailable; using development demo login.');
            return demoUser;
          }
          throw error;
        }

        const user = await UserModel.findOne({ email }).select('+password');

        if (!user) {
          throw new Error('Invalid email or password');
        }

        if (!user.isActive) {
          throw new Error('Your account has been deactivated. Contact SuperAdmin.');
        }

        if (user.isArchived) {
          throw new Error('Your account has been archived. Contact SuperAdmin.');
        }

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
          throw new Error('Invalid email or password');
        }

        // Update last login
        await UserModel.findByIdAndUpdate(user._id, { lastLogin: new Date() });

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          userType: user.userType,
          portalType: user.portalType,
          positionId: user.positionId?.toString() || null,
          mustChangePassword: user.mustChangePassword,
        };
      },
    }),
  ],
});
