import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import dbConnect from '@/lib/db';
import Attendance from '@/models/Attendance';
import SystemSettings from '@/models/SystemSettings';
import { auditAction } from '@/lib/audit';
import { successResponse, errorResponse, getRequestMeta } from '@/lib/utils';
import { createDevId, getDevStore, isDevFallbackEnabled, devUserRef } from '@/lib/dev-store';

export const dynamic = 'force-dynamic';

// Haversine formula
function getDistanceFromLatLonInM(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // Radius of the earth in m
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in m
  return d;
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('Unauthorized', 401);

    const { checkPermission } = await import('@/lib/permissions');
    const permVerify = await checkPermission(session.user.id, 'smart_attendance', 'verify_attendance');
    const permView = await checkPermission(session.user.id, 'smart_attendance', 'view_attendance_reports');
    
    if (!permVerify.allowed && !permView.allowed && session.user.userType !== 'superadmin') {
      return errorResponse('Forbidden', 403);
    }

    const todayOnly = request.nextUrl.searchParams.get('today') === 'true';

    try {
      await dbConnect();
    } catch (error) {
      if (!isDevFallbackEnabled()) throw error;
      const store = getDevStore();
      let records = (store as any).attendances || [];
      if (todayOnly) {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        records = records.filter((r: any) => new Date(r.timestamp) >= startOfDay);
      }
      return successResponse(
        records
          .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .map((r: any) => ({ ...r, userId: devUserRef(r.userId) }))
      );
    }

    let query: any = {};
    if (permVerify.allowed && !permView.allowed && session.user.userType !== 'superadmin') {
      query.status = 'pending'; // Verifiers usually just see pending
    }

    if (todayOnly) {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      query.timestamp = { $gte: startOfDay };
    }

    const records = await Attendance.find(query)
      .populate('userId', 'name email role')
      .populate('verifiedBy', 'name')
      .sort({ timestamp: -1 })
      .limit(100);

    return successResponse(records);
  } catch (error) {
    console.error('GET /api/attendance error:', error);
    return errorResponse('Failed to fetch attendance records', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('Unauthorized', 401);

    const { checkPermission } = await import('@/lib/permissions');
    const perm = await checkPermission(session.user.id, 'smart_attendance', 'submit_attendance');
    if (!perm.allowed) return errorResponse('Forbidden', 403);

    const body = await request.json();
    const { lat, lng } = body;

    if (lat === undefined || lng === undefined) {
      return errorResponse('Location data is required', 400);
    }

    let useDevStore = false;
    try {
      await dbConnect();
    } catch (error) {
      if (!isDevFallbackEnabled()) throw error;
      useDevStore = true;
    }

    let geofence = { lat: 10.0247, lng: 76.3079, radius: 50 };
    
    if (!useDevStore) {
      const setting = await SystemSettings.findOne({ key: 'attendance_geofence' });
      if (setting && setting.value) {
        geofence = setting.value as typeof geofence;
      }
    } else {
      const store = getDevStore();
      const setting = store.settings.find(s => s.key === 'attendance_geofence');
      if (setting && setting.value) {
        geofence = setting.value as typeof geofence;
      }
    }

    const distance = getDistanceFromLatLonInM(geofence.lat, geofence.lng, lat, lng);
    
    if (distance > geofence.radius) {
      return NextResponse.json({
        success: false,
        message: `You are out of the designated zone. Distance: ${Math.round(distance)}m (Max: ${geofence.radius}m)`,
        outOfBounds: true,
        targetLocation: { lat: geofence.lat, lng: geofence.lng }
      }, { status: 400 });
    }

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (useDevStore) {
      const store = getDevStore();
      if (!(store as any).attendances) (store as any).attendances = [];
      const alreadySubmitted = (store as any).attendances.some((a: any) => 
        a.userId === session.user.id && new Date(a.timestamp) >= startOfDay
      );
      if (alreadySubmitted) {
        return errorResponse('You have already submitted attendance today. Please come back tomorrow.', 400);
      }
      
      const record = {
        _id: createDevId('attendance'),
        userId: session.user.id,
        timestamp: now.toISOString(),
        location: { lat, lng },
        distance,
        status: 'pending',
        verifiedBy: null,
        verifiedAt: null,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
      (store as any).attendances.unshift(record);
      return successResponse(record, 'Attendance marked successfully', 201);
    }

    const existingToday = await Attendance.findOne({
      userId: session.user.id,
      timestamp: { $gte: startOfDay }
    });

    if (existingToday) {
      return errorResponse('You have already submitted attendance today. Please come back tomorrow.', 400);
    }

    const record = await Attendance.create({
      userId: session.user.id,
      timestamp: now,
      location: { lat, lng },
      distance,
      status: 'pending'
    });

    const meta = getRequestMeta(request.headers);
    await auditAction({ 
      userId: session.user.id, 
      userName: session.user.name || '', 
      userType: session.user.userType, 
      action: 'submit_attendance', 
      module: 'smart_attendance', 
      recordId: record._id, 
      description: `Submitted attendance from ${Math.round(distance)}m away`, 
      ...meta 
    }, request.headers);

    return successResponse(record, 'Attendance marked successfully', 201);
  } catch (error) {
    console.error('POST /api/attendance error:', error);
    return errorResponse('Failed to submit attendance', 500);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('Unauthorized', 401);

    const { checkPermission } = await import('@/lib/permissions');
    const perm = await checkPermission(session.user.id, 'smart_attendance', 'verify_attendance');
    if (!perm.allowed) return errorResponse('Forbidden', 403);

    const body = await request.json();
    const { id, status } = body;

    if (!id || !['verified', 'rejected'].includes(status)) {
      return errorResponse('Valid ID and status are required', 400);
    }

    let useDevStore = false;
    try {
      await dbConnect();
    } catch (error) {
      if (!isDevFallbackEnabled()) throw error;
      useDevStore = true;
    }

    const now = new Date();

    if (useDevStore) {
      const store = getDevStore();
      if (!(store as any).attendances) return errorResponse('Not found', 404);
      const index = (store as any).attendances.findIndex((a: any) => a._id === id);
      if (index === -1) return errorResponse('Not found', 404);
      
      (store as any).attendances[index] = {
        ...(store as any).attendances[index],
        status,
        verifiedBy: session.user.id,
        verifiedAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
      return successResponse((store as any).attendances[index], 'Attendance updated', 200);
    }

    const record = await Attendance.findByIdAndUpdate(
      id,
      {
        status,
        verifiedBy: session.user.id,
        verifiedAt: now
      },
      { new: true }
    );

    if (!record) return errorResponse('Attendance record not found', 404);

    const meta = getRequestMeta(request.headers);
    await auditAction({ 
      userId: session.user.id, 
      userName: session.user.name || '', 
      userType: session.user.userType, 
      action: 'verify_attendance', 
      module: 'smart_attendance', 
      recordId: record._id, 
      description: `Marked attendance as ${status}`, 
      ...meta 
    }, request.headers);

    return successResponse(record, 'Attendance updated', 200);
  } catch (error) {
    console.error('PUT /api/attendance error:', error);
    return errorResponse('Failed to verify attendance', 500);
  }
}
