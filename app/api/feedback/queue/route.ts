import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import dbConnect from '@/lib/db';
import Feedback from '@/models/Feedback';
import { auth } from '@/lib/auth';
import { isDevFallbackEnabled } from '@/lib/dev-store';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    
    let query = {};
    const portal = (session.user as any).portalType;
    
    // Admin/Superadmin sees everything. Others see submitted or assigned.
    if (portal !== 'admin' && portal !== 'superadmin') {
      query = {
        $or: [
          { submittedBy: (session.user as any).id },
          { assignedTo: (session.user as any).id }
        ]
      };
    }

    const feedbacks = await Feedback.find(query)
      .populate('submittedBy', 'name email portal')
      .populate('assignedTo', 'name email portal')
      .populate('assignedBy', 'name email portal')
      .populate('comments.user', 'name email portal')
      .sort({ createdAt: -1 });

    return NextResponse.json({ success: true, data: feedbacks });
  } catch (error: any) {
    if (isDevFallbackEnabled() || error.name === 'MongoServerSelectionError' || error.name === 'MongoNetworkError' || String(error).includes('ECONNRESET') || String(error).includes('SSL alert')) {
      console.warn('MongoDB connection failed. Using development mock fallback for Feedback Queue.');
      return NextResponse.json({ 
        success: true, 
        data: [
          { _id: 'mock-id-123', type: 'general', title: 'Mocked Feedback (DB Offline)', description: 'This is a mock feedback item because your database connection is offline.', status: 'open', source: 'qr', createdAt: new Date() }
        ],
        warning: 'Loaded local mock store due to DB connection error'
      });
    }

    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    const body = await req.json();
    const { id, action, status, assignedTo, comment } = body;

    if (!id) {
      return NextResponse.json({ success: false, message: 'Missing feedback ID' }, { status: 400 });
    }

    const feedback = await Feedback.findById(id);
    if (!feedback) {
      return NextResponse.json({ success: false, message: 'Feedback not found' }, { status: 404 });
    }

    const portal = (session.user as any).portalType;
    const isAdmin = portal === 'admin' || portal === 'superadmin';
    const isAssigned = feedback.assignedTo?.toString() === (session.user as any).id;

    if (action === 'update_status') {
      if (!isAdmin && !isAssigned) {
        return NextResponse.json({ success: false, message: 'Permission denied' }, { status: 403 });
      }
      feedback.status = status;
      if (status === 'resolved') feedback.resolvedAt = new Date();
      if (status === 'closed') feedback.closedAt = new Date();
    } else if (action === 'assign') {
      if (!isAdmin) {
        return NextResponse.json({ success: false, message: 'Only admins can assign reports' }, { status: 403 });
      }
      feedback.assignedTo = assignedTo ? assignedTo : null;
      feedback.assignedBy = assignedTo ? (session.user as any).id : null;
      feedback.assignedAt = assignedTo ? new Date() : null;
    } else if (action === 'add_comment') {
      if (!isAdmin && !isAssigned && feedback.submittedBy?.toString() !== (session.user as any).id) {
        return NextResponse.json({ success: false, message: 'Permission denied' }, { status: 403 });
      }
      feedback.comments.push({
        user: (session.user as any).id,
        text: comment,
        createdAt: new Date()
      });
    }

    await feedback.save();
    
    // Repopulate for client
    const updated = await Feedback.findById(id)
      .populate('submittedBy', 'name email portal')
      .populate('assignedTo', 'name email portal')
      .populate('assignedBy', 'name email portal')
      .populate('comments.user', 'name email portal');

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
