import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import PortalModuleMapping from '@/models/PortalModuleMapping';
import PositionModuleMapping from '@/models/PositionModuleMapping';

export async function GET() {
  await dbConnect();
  const portalMappings = await PortalModuleMapping.find({}).lean();
  const positionMappings = await PositionModuleMapping.find({}).lean();
  
  return NextResponse.json({
    portalMappings,
    positionMappings
  });
}
