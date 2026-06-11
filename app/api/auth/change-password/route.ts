import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import { auth } from '@/lib/auth';
import { auditAction } from '@/lib/audit';

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { currentPassword, newPassword } = await req.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { success: false, message: 'Current and new password are required' },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { success: false, message: 'New password must be at least 8 characters' },
        { status: 400 }
      );
    }

    await dbConnect();

    const user = await User.findById(session.user.id).select('+password');
    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    }

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      return NextResponse.json(
        { success: false, message: 'Current password is incorrect' },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await User.findByIdAndUpdate(user._id, {
      password: hashedPassword,
      mustChangePassword: false,
    });

    await auditAction(
      {
        userId: user._id,
        userName: user.name,
        userType: user.userType,
        action: 'change_password',
        module: 'auth',
        description: 'User changed their password',
      },
      req.headers
    );

    return NextResponse.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
