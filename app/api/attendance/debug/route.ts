import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import dbConnect from '@/lib/db';
import Attendance from '@/models/Attendance';
import { getDevStore, isDevFallbackEnabled } from '@/lib/dev-store';

export async function GET() {
  try {
    let useDevStore = false;
    let dbStatus = 'disconnected';
    let dbRecords: any[] = [];
    let devRecords: any[] = [];
    
    try {
      await dbConnect();
      dbStatus = 'connected';
      dbRecords = await Attendance.find({});
    } catch (e: any) {
      dbStatus = `error: ${e.message}`;
      if (isDevFallbackEnabled()) {
        useDevStore = true;
      }
    }

    const store = getDevStore();
    devRecords = (store as any).attendances || [];

    return NextResponse.json({
      dbStatus,
      useDevStore,
      counts: {
        db: dbRecords.length,
        dev: devRecords.length
      },
      dbRecords,
      devRecords
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
