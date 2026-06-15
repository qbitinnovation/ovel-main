import dbConnect from '@/lib/db';
import AuditLog from '@/models/AuditLog';
import type { Types } from 'mongoose';

export interface AuditLogEntry {
  userId: string | Types.ObjectId;
  userName: string;
  userType: string;
  action: string;
  module: string;
  recordId?: string | Types.ObjectId | null;
  description?: string;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string;
  deviceInfo?: string;
}

/**
 * Write an audit log entry. Insert-only — no update or delete is ever performed.
 * This function is called from every API route after successful operations.
 */
export async function writeAuditLog(entry: AuditLogEntry): Promise<string> {
  try {
    await dbConnect();

    const log = await AuditLog.create({
      userId: entry.userId,
      userName: entry.userName,
      userType: entry.userType,
      action: entry.action,
      module: entry.module,
      recordId: entry.recordId || null,
      description: entry.description || '',
      oldValue: entry.oldValue || null,
      newValue: entry.newValue || null,
      ipAddress: entry.ipAddress || 'unknown',
      deviceInfo: entry.deviceInfo || 'unknown',
    });

    return log._id.toString();
  } catch (error) {
    console.error('Failed to write audit log:', error);
    return '';
  }
}

/**
 * Shorthand for writing audit log with request metadata extraction.
 */
export async function auditAction(
  entry: AuditLogEntry,
  headers?: Headers
): Promise<string> {
  if (headers) {
    entry.ipAddress =
      headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      headers.get('x-real-ip') ||
      entry.ipAddress ||
      'unknown';
    entry.deviceInfo = headers.get('user-agent') || entry.deviceInfo || 'unknown';
  }
  return writeAuditLog(entry);
}
