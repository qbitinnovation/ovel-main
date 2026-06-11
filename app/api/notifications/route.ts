import { type NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import dbConnect from '@/lib/db';
import Notification from '@/models/Notification';
import { successResponse, errorResponse } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('Unauthorized', 401);

    const sp = request.nextUrl.searchParams;
    const unreadOnly = sp.get('unreadOnly') === 'true';

    await dbConnect();

    const filter: Record<string, unknown> = { userId: session.user.id };
    if (unreadOnly) filter.isRead = false;

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(50);

    const unreadCount = await Notification.countDocuments({
      userId: session.user.id,
      isRead: false,
    });

    return successResponse({ notifications, unreadCount });
  } catch (error) {
    console.error('GET /api/notifications error:', error);
    return errorResponse('Failed to fetch notifications', 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('Unauthorized', 401);

    const body = await request.json();
    const { action, notificationId } = body;

    await dbConnect();

    if (action === 'mark-read' && notificationId) {
      await Notification.findOneAndUpdate(
        { _id: notificationId, userId: session.user.id },
        { isRead: true }
      );
      return successResponse(null, 'Marked as read');
    }

    if (action === 'mark-all-read') {
      await Notification.updateMany(
        { userId: session.user.id, isRead: false },
        { isRead: true }
      );
      return successResponse(null, 'All notifications marked as read');
    }

    return errorResponse('Invalid action');
  } catch (error) {
    console.error('PATCH /api/notifications error:', error);
    return errorResponse('Failed', 500);
  }
}
