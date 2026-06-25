import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import PortalModuleMapping from '@/models/PortalModuleMapping';
import UserModuleMapping from '@/models/UserModuleMapping';

export async function GET() {
  await dbConnect();
  const portalMappings = await PortalModuleMapping.find({}).lean();
  const userMappings = await UserModuleMapping.find({}).lean();
  
  return NextResponse.json({
    portalMappings,
    userMappings
  });
}
