import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Feedback from '@/models/Feedback';
import User from '@/models/User';
import { auth } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session || (session.user as any)?.portalType !== 'superadmin') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    
    const feedbacks = await Feedback.find({});
    let updatedCount = 0;

    for (const fb of feedbacks) {
      let targetSource = fb.source;
      
      // If the source is legacy 'portal' or not one of the new enum values
      if (!['community', 'shareholder', 'turf', 'qr'].includes(fb.source as any)) {
        if (fb.submittedBy) {
          const user = await User.findById(fb.submittedBy);
          if (user) {
            if (user.portalType === 'committee') targetSource = 'community';
            else if (user.portalType === 'shareholder') targetSource = 'shareholder';
            else if (user.portalType === 'turf') targetSource = 'turf';
            else targetSource = 'qr';
          } else {
            targetSource = 'qr';
          }
        } else {
          targetSource = 'qr';
        }
      }

      // If source changed, update it
      if (fb.source !== targetSource) {
        fb.source = targetSource;
        await fb.save();
        updatedCount++;
      }
    }

    return NextResponse.json({ success: true, updatedCount, total: feedbacks.length });
  } catch (error: any) {
    console.error('Migration Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
