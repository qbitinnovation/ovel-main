import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import MaintenanceTask from '@/models/MaintenanceTask';
import '@/models/MeetingMinutes';
import '@/models/User';

export async function GET() {
  try {
    await dbConnect();
    const tasks = await MaintenanceTask.find({})
      .populate('assigneeId', 'name')
      .populate('creatorId', 'name')
      .populate('linkedMomId', 'date')
      .sort({ createdAt: -1 })
      .limit(10);
    return NextResponse.json({ success: true, count: tasks.length });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message, stack: error.stack });
  }
}
