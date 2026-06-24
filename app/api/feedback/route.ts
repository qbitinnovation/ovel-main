import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Feedback from '@/models/Feedback';
import { auth } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const session = await auth();
    await dbConnect();
    const body = await req.json();

    const { type, title, description, guestName, guestMobile, attachmentUrl } = body;

    if (!type || !title || !description) {
      return NextResponse.json(
        { success: false, message: 'Type, title, and description are required.' },
        { status: 400 }
      );
    }

    const userId = (session?.user as any)?.id;

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
      source: userId ? 'portal' : 'qr',
    });

    return NextResponse.json({ success: true, data: feedback });
  } catch (error: any) {
    console.error('Feedback Submission Error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Server Error' },
      { status: 500 }
    );
  }
}
// Force hot reload
