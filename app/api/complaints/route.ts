import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import dbConnect from '@/lib/db';
import Complaint from '@/models/Complaint';
import { getDevStore, isDevFallbackEnabled, createDevId } from '@/lib/dev-store';
import { successResponse, errorResponse } from '@/lib/utils';
import { auth } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('Unauthorized', 401);

    const { checkPermission } = await import('@/lib/permissions');
    const permView = await checkPermission(session.user.id, 'complaints', 'view_complaints');
    if (!permView.allowed && session.user.userType !== 'superadmin') return errorResponse('Forbidden', 403);
    
    let useDevStore = false;
    try {
      await dbConnect();
    } catch (error) {
      if (!isDevFallbackEnabled()) throw error;
      useDevStore = true;
    }

    if (useDevStore) {
      const store = getDevStore() as any;
      return successResponse(store.complaints || []);
    }

    const complaints = await Complaint.find().sort({ createdAt: -1 }).populate('submittedBy', 'name role');
    return successResponse(complaints);

  } catch (error) {
    console.error('Complaints GET Error:', error);
    return errorResponse('Failed to fetch complaints', 500);
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('Unauthorized', 401);

    const { checkPermission } = await import('@/lib/permissions');
    const permSubmit = await checkPermission(session.user.id, 'complaints', 'submit_complaint');
    if (!permSubmit.allowed && session.user.userType !== 'superadmin') return errorResponse('Forbidden', 403);
    
    const body = await request.json();
    const { title, description, category, priority } = body;

    let useDevStore = false;
    try {
      await dbConnect();
    } catch (error) {
      if (!isDevFallbackEnabled()) throw error;
      useDevStore = true;
    }

    if (useDevStore) {
      const store = getDevStore() as any;
      const newComplaint = {
        _id: createDevId('complaint'),
        title,
        description,
        category,
        priority: priority || 'medium',
        status: 'open',
        submittedBy: session.user.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      store.complaints.unshift(newComplaint);
      return successResponse(newComplaint, 'Complaint submitted successfully');
    }

    const newComplaint = await Complaint.create({
      title,
      description,
      category,
      priority: priority || 'medium',
      submittedBy: session.user.id
    });

    return successResponse(newComplaint, 'Complaint submitted successfully', 201);

  } catch (error) {
    console.error('Complaints POST Error:', error);
    return errorResponse('Failed to submit complaint', 500);
  }
}

export async function PUT(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('Unauthorized', 401);

    const { checkPermission } = await import('@/lib/permissions');
    const permResolve = await checkPermission(session.user.id, 'complaints', 'resolve_complaint');
    if (!permResolve.allowed && session.user.userType !== 'superadmin') return errorResponse('Forbidden', 403);
    
    const body = await request.json();
    const { id, status, resolutionNote } = body;

    let useDevStore = false;
    try {
      await dbConnect();
    } catch (error) {
      if (!isDevFallbackEnabled()) throw error;
      useDevStore = true;
    }

    const now = new Date();

    if (useDevStore) {
      const store = getDevStore() as any;
      const index = store.complaints.findIndex((c: any) => c._id === id);
      if (index === -1) return errorResponse('Complaint not found', 404);
      
      const c = store.complaints[index];
      c.status = status;
      c.resolutionNote = resolutionNote || c.resolutionNote;
      c.updatedAt = now.toISOString();
      if (status === 'resolved' && !c.resolvedAt) {
        c.resolvedAt = now.toISOString();
        c.resolutionTimeMs = now.getTime() - new Date(c.createdAt).getTime();
      }
      return successResponse(c, 'Complaint updated');
    }

    const complaint = await Complaint.findById(id);
    if (!complaint) return errorResponse('Complaint not found', 404);

    complaint.status = status;
    if (resolutionNote) complaint.resolutionNote = resolutionNote;
    
    if (status === 'resolved' && !complaint.resolvedAt) {
      complaint.resolvedAt = now;
      complaint.resolutionTimeMs = now.getTime() - complaint.createdAt.getTime();
    }

    await complaint.save();
    return successResponse(complaint, 'Complaint updated');

  } catch (error) {
    console.error('Complaints PUT Error:', error);
    return errorResponse('Failed to update complaint', 500);
  }
}
