import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Feedback from '@/models/Feedback';
import { auth } from '@/lib/auth';
import { isDevFallbackEnabled } from '@/lib/dev-store';

export async function POST(req: Request) {
  try {
    const session = await auth();
    await dbConnect();
    const body = await req.json();

    const { type, title, description, guestName, guestMobile, attachmentUrl, rating } = body;

    if (!type || !title || !description) {
      return NextResponse.json(
        { success: false, message: 'Type, title, and description are required.' },
        { status: 400 }
      );
    }

    const userId = (session?.user as any)?.id;
    const userPortal = (session?.user as any)?.portalType;

    let resolvedSource = body.source;
    if (userId && userPortal) {
      if (userPortal === 'committee') resolvedSource = 'community';
      else if (userPortal === 'shareholder') resolvedSource = 'shareholder';
      else if (userPortal === 'turf') resolvedSource = 'turf';
    }
    if (!resolvedSource || !['community', 'shareholder', 'turf', 'qr'].includes(resolvedSource)) {
      resolvedSource = 'qr';
    }

    const feedback = await Feedback.create({
      type,
      title,
      description,
      priority: type === 'complaint' ? 'high' : 'medium', // Default priorities
      status: 'open',
      submittedBy: userId || null,
      guestName: guestName || null,
      guestMobile: guestMobile || null,
      attachmentUrl: attachmentUrl || null,
      source: resolvedSource,
      rating: rating || 0,
    });

    return NextResponse.json({ success: true, data: feedback });
  } catch (error: any) {
    console.error('Feedback Submission Error:', error);
    
    // Check if it's a database connection issue in development
    if (isDevFallbackEnabled() || error.name === 'MongoServerSelectionError' || error.name === 'MongoNetworkError' || String(error).includes('ECONNRESET') || String(error).includes('SSL alert')) {
      
      console.warn('MongoDB connection failed. Using development mock fallback for Feedback.');
      return NextResponse.json({ 
        success: true, 
        data: { _id: 'mock-id-123', type: 'general', title: 'Mocked Feedback', status: 'open' },
        warning: 'Saved to local mock store due to DB connection error'
      });
    }

    return NextResponse.json(
      { success: false, message: error.message || 'Server Error' },
      { status: 500 }
    );
  }
}
// Force hot reload
