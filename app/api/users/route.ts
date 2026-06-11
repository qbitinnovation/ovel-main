import { type NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import Position from '@/models/Position';
import bcrypt from 'bcryptjs';
import { auditAction } from '@/lib/audit';
import { successResponse, errorResponse, sanitizeInput, getRequestMeta, parsePagination, paginate } from '@/lib/utils';
import { createDevId, getDevStore, isDevFallbackEnabled, populateDevUserPosition, type DevUser } from '@/lib/dev-store';

export const dynamic = 'force-dynamic';

const VALID_PORTAL_TYPES = ['committee', 'turf', 'shareholder'];
const PORTAL_LABELS: Record<string, string> = {
  committee: 'Committee Member',
  turf: 'Turf Manager',
  shareholder: 'Shareholder',
};

const USER_TYPE_BY_PORTAL: Record<string, 'management' | 'staff'> = {
  committee: 'management',
  turf: 'staff',
  shareholder: 'management',
};

/**
 * GET /api/users
 * List users with pagination, search, and filters.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('Unauthorized', 401);
    if (session.user.userType !== 'superadmin') return errorResponse('Forbidden', 403);

    const sp = request.nextUrl.searchParams;
    const { page, limit } = parsePagination(sp);
    const search = sp.get('search') || '';
    const userType = sp.get('userType') || '';
    const portalType = sp.get('portalType') || '';
    const status = sp.get('status') || '';
    const positionId = sp.get('positionId') || '';

    try {
      await dbConnect();
    } catch (error) {
      if (!isDevFallbackEnabled()) throw error;

      const store = getDevStore();
      let users = store.users;

      if (search) {
        const needle = search.toLowerCase();
        users = users.filter((user) =>
          [user.name, user.email, user.phone].some((value) => value.toLowerCase().includes(needle))
        );
      }

      if (userType) users = users.filter((user) => user.userType === userType);
      if (portalType) users = users.filter((user) => user.portalType === portalType);
      if (positionId) users = users.filter((user) => user.positionId === (positionId === 'unassigned' ? null : positionId));
      if (status === 'active') users = users.filter((user) => user.isActive && !user.isArchived);
      if (status === 'inactive') users = users.filter((user) => !user.isActive);
      if (status === 'archived') users = users.filter((user) => user.isArchived);

      const total = users.length;
      const pagination = paginate({ page, limit, total });
      const pagedUsers = users
        .slice(pagination.skip, pagination.skip + limit)
        .map(populateDevUserPosition);

      return successResponse({ users: pagedUsers, pagination });
    }

    // Build filter
    const filter: Record<string, unknown> = {
      userType: { $ne: 'superadmin' }, // Don't show superadmin in user list
    };

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }

    if (userType) filter.userType = userType;
    if (portalType) filter.portalType = portalType;
    if (positionId) filter.positionId = positionId === 'unassigned' ? null : positionId;

    if (status === 'active') {
      filter.isActive = true;
      filter.isArchived = false;
    } else if (status === 'inactive') {
      filter.isActive = false;
    } else if (status === 'archived') {
      filter.isArchived = true;
    }

    const total = await User.countDocuments(filter);
    const pagination = paginate({ page, limit, total });

    const users = await User.find(filter)
      .select('-password')
      .populate('positionId', 'name isActive')
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(limit);

    return successResponse({ users, pagination });
  } catch (error) {
    console.error('GET /api/users error:', error);
    return errorResponse('Failed to fetch users', 500);
  }
}

/**
 * POST /api/users
 * Create a new user account.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('Unauthorized', 401);
    if (session.user.userType !== 'superadmin') return errorResponse('Forbidden', 403);

    const body = await request.json();
    const { name, email, phone, portalType, password, positionName } = body;

    // Validate required fields
    if (!name?.trim()) return errorResponse('Full name is required');
    if (!email?.trim()) return errorResponse('Email address is required');
    if (!phone?.trim()) return errorResponse('Phone number is required');
    if (!portalType) return errorResponse('Portal type is required');

    if (!VALID_PORTAL_TYPES.includes(portalType)) {
      return errorResponse('Portal type must be committee, turf, or shareholder');
    }
    if (portalType === 'committee' && !positionName?.trim()) {
      return errorResponse('Committee member position is required');
    }

    const sanitizedName = sanitizeInput(name);
    const sanitizedEmail = email.trim().toLowerCase();
    const sanitizedPhone = sanitizeInput(phone);
    const userType = USER_TYPE_BY_PORTAL[portalType];
    const sanitizedPositionName =
      portalType === 'committee' && positionName?.trim() ? sanitizeInput(positionName) : '';

    let useDevStore = false;
    try {
      await dbConnect();
    } catch (error) {
      if (!isDevFallbackEnabled()) throw error;
      useDevStore = true;
    }

    if (useDevStore) {
      const store = getDevStore();

      const existing = store.users.find((user) => user.email === sanitizedEmail);
      if (existing) return errorResponse('A user with this email already exists');

      let positionId: string | null = null;
      if (sanitizedPositionName) {
        let position = store.positions.find(
          (item) => item.name.toLowerCase() === sanitizedPositionName.toLowerCase()
        );

        if (!position) {
          const now = new Date().toISOString();
          position = {
            _id: createDevId('position'),
            name: sanitizedPositionName,
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

        positionId = position._id;
      }

      const userPassword = password || Math.random().toString(36).slice(-8) + 'A1!';
      const now = new Date().toISOString();
      const user: DevUser = {
        _id: createDevId('user'),
        name: sanitizedName,
        email: sanitizedEmail,
        phone: sanitizedPhone,
        userType,
        portalType,
        positionId,
        isActive: true,
        isArchived: false,
        mustChangePassword: true,
        lastLogin: null,
        createdAt: now,
        updatedAt: now,
      };

      store.users.unshift(user);

      return successResponse(
        { ...populateDevUserPosition(user), tempPassword: password ? undefined : userPassword },
        'User created successfully',
        201
      );
    }

    // Check email uniqueness
    const existing = await User.findOne({ email: sanitizedEmail });
    if (existing) return errorResponse('A user with this email already exists');

    // Hash password
    const userPassword = password || Math.random().toString(36).slice(-8) + 'A1!';
    const hashedPassword = await bcrypt.hash(userPassword, 12);
    let positionId = null;

    if (sanitizedPositionName) {
      let position = await Position.findOne({
        name: { $regex: new RegExp(`^${escapeRegExp(sanitizedPositionName)}$`, 'i') },
      });

      if (!position) {
        position = await Position.create({
          name: sanitizedPositionName,
          description: 'Created from committee member setup',
          createdBy: session.user.id,
        });
      } else if (!position.isActive) {
        position.isActive = true;
        await position.save();
      }

      positionId = position._id;
    }

    const user = await User.create({
      name: sanitizedName,
      email: sanitizedEmail,
      phone: sanitizedPhone,
      password: hashedPassword,
      userType,
      portalType,
      positionId,
      isActive: true,
      isArchived: false,
      mustChangePassword: true,
    });

    const meta = getRequestMeta(request.headers);
    await auditAction(
      {
        userId: session.user.id,
        userName: session.user.name || 'SuperAdmin',
        userType: session.user.userType,
        action: 'create_user',
        module: 'user_permission',
        recordId: user._id,
        description: `Created user account for ${sanitizedName}, ${userType}, ${PORTAL_LABELS[portalType]} Portal`,
        newValue: { name: sanitizedName, email: sanitizedEmail, userType, portalType, positionName: sanitizedPositionName || undefined },
        ...meta,
      },
      request.headers
    );

    // Stub: would send welcome email/SMS here
    console.log(`📧 [STUB] Welcome email to ${sanitizedEmail} with temp password`);
    console.log(`📱 [STUB] Welcome SMS to ${sanitizedPhone}`);

    // Return user without password, include the temp password for display
    const userObj = user.toObject();
    delete (userObj as unknown as Record<string, unknown>).password;

    return successResponse(
      { ...userObj, tempPassword: password ? undefined : userPassword },
      'User created successfully',
      201
    );
  } catch (error) {
    console.error('POST /api/users error:', error);
    return errorResponse('Failed to create user', 500);
  }
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
