import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IAuditLog extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  userName: string;
  userType: string;
  action: string;
  module: string;
  recordId: Types.ObjectId | null;
  description: string;
  oldValue: unknown;
  newValue: unknown;
  ipAddress: string;
  deviceInfo: string;
  timestamp: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    userName: { type: String, required: true },
    userType: { type: String, required: true },
    action: { type: String, required: true },
    module: { type: String, required: true },
    recordId: { type: Schema.Types.ObjectId, default: null },
    description: { type: String, default: '' },
    oldValue: { type: Schema.Types.Mixed, default: null },
    newValue: { type: Schema.Types.Mixed, default: null },
    ipAddress: { type: String, default: 'unknown' },
    deviceInfo: { type: String, default: 'unknown' },
    timestamp: { type: Date, default: () => new Date(), immutable: true },
  },
  {
    // No timestamps — we use our own immutable timestamp
    versionKey: false,
  }
);

// Indexes for efficient querying
AuditLogSchema.index({ timestamp: -1 });
AuditLogSchema.index({ userId: 1, timestamp: -1 });
AuditLogSchema.index({ module: 1, timestamp: -1 });
AuditLogSchema.index({ action: 1 });

/**
 * CRITICAL: Remove all update and delete operations from the model.
 * Audit logs are INSERT-ONLY. This is enforced at the application level.
 * Database-level enforcement should be done via MongoDB roles.
 */
AuditLogSchema.pre('findOneAndUpdate', function () {
  throw new Error('Audit logs cannot be updated. This collection is insert-only.');
});

AuditLogSchema.pre('updateOne', function () {
  throw new Error('Audit logs cannot be updated. This collection is insert-only.');
});

AuditLogSchema.pre('updateMany', function () {
  throw new Error('Audit logs cannot be updated. This collection is insert-only.');
});

AuditLogSchema.pre('findOneAndDelete', function () {
  throw new Error('Audit logs cannot be deleted. This collection is insert-only.');
});

AuditLogSchema.pre('deleteOne', function () {
  throw new Error('Audit logs cannot be deleted. This collection is insert-only.');
});

AuditLogSchema.pre('deleteMany', function () {
  throw new Error('Audit logs cannot be deleted. This collection is insert-only.');
});

const AuditLog: Model<IAuditLog> =
  mongoose.models.AuditLog || mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);

export default AuditLog;
