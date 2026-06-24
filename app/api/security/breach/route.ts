import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import AuditLog from '@/models/AuditLog';
import Anomaly from '@/models/Anomaly';
import { auth } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const session = await auth();
    await dbConnect();
    
    const body = await req.json();
    const { moduleKey, path } = body;

    const userEmail = session?.user?.email || 'Unknown User';
    
    const meta: any = {
      action: 'SECURITY_BREACH',
      module: moduleKey || 'system',
    };

    if (session?.user?.id) {
      meta.user = session.user.id;
      meta.userName = session.user.name || 'unknown';
      meta.portal = session.user.portalType || 'unknown';
    }

    // Create Audit Log
    await AuditLog.create({
      ...meta,
      userType: session?.user?.userType || 'unknown',
      details: {
        message: `Unauthorized access attempt to ${moduleKey}`,
        path: path,
        email: userEmail
      },
      ipAddress: req.headers.get('x-forwarded-for') || 'Unknown IP'
    });

    // Generate Anomaly for Admin
    if (moduleKey === 'audit_log' || moduleKey === 'accounts_finance') {
      await Anomaly.create({
        type: 'custom',
        severity: 'critical',
        title: 'Unauthorized Access Attempt',
        description: `User ${userEmail} attempted to bypass security and access restricted module: ${moduleKey}.`,
        status: 'active',
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
