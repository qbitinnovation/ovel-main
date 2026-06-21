import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import User from '@/models/User';
import dbConnect from '@/lib/db';

export async function GET() {
  await dbConnect();
  const users = await User.find({}).lean();
  return NextResponse.json(users);
}
