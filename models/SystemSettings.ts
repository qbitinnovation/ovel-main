import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface ISystemSettings extends Document {
  _id: Types.ObjectId;
  key: string;
  value: unknown;
  label: string;
  category: string;
  updatedBy: Types.ObjectId | null;
  updatedAt: Date;
}

const SystemSettingsSchema = new Schema<ISystemSettings>(
  {
    key: { type: String, required: true, unique: true },
    value: { type: Schema.Types.Mixed, required: true },
    label: { type: String, default: '' },
    category: { type: String, default: 'general' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

SystemSettingsSchema.index({ key: 1 }, { unique: true });
SystemSettingsSchema.index({ category: 1 });

const SystemSettings: Model<ISystemSettings> =
  mongoose.models.SystemSettings ||
  mongoose.model<ISystemSettings>('SystemSettings', SystemSettingsSchema);

export default SystemSettings;

/**
 * Default settings to seed on first load.
 */
export const DEFAULT_SETTINGS = [
  { key: 'checklist_generation_time', value: '06:00', label: 'Daily Checklist Generation Time', category: 'operations' },
  { key: 'photo_expiry_days', value: 7, label: 'Photo Verification Expiry (days)', category: 'operations' },
  { key: 'finance_submission_deadline', value: '21:00', label: 'Finance Submission Deadline', category: 'operations' },
  { key: 'safety_logout_deadline', value: '23:00', label: 'Safety Checklist Logout Deadline', category: 'operations' },
  { key: 'low_stock_threshold_default', value: 5, label: 'Default Low Stock Threshold', category: 'inventory' },
  { key: 'notification_channel_primary', value: 'push', label: 'Primary Notification Channel', category: 'notifications' },
  { key: 'notification_channel_fallback', value: 'sms', label: 'Fallback Notification Channel', category: 'notifications' },
  { key: 'malayalam_default_turf', value: true, label: 'Malayalam Default for Turf Portal', category: 'language' },
  { key: 'report_weekly_day', value: 'monday', label: 'Weekly Report Day', category: 'reports' },
  { key: 'report_monthly_day', value: 1, label: 'Monthly Report Day of Month', category: 'reports' },
  { key: 'report_recipients', value: [], label: 'Report Email Recipients', category: 'reports' },
  { key: 'supervisor_rotation', value: [], label: 'Monthly Supervisor Rotation', category: 'operations' },
  { key: 'booking_payment_reminder_days', value: 3, label: 'Booking Payment Reminder (days)', category: 'bookings' },
];
