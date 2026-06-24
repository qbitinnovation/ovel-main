import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IReportSnapshot extends Document {
  type: 'daily' | 'monthly' | 'yearly';
  dateStr: string; // e.g. "2026-06-23" or "2026-06" or "2026"
  timestamp: Date;
  metrics: {
    totalRevenue: number;
    totalExpenses: number;
    netProfit: number;
    totalBookings: number;
    tasksCompleted: number;
    tasksPending: number;
    complaintsReceived: number;
    complaintsResolved: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const ReportSnapshotSchema = new Schema<IReportSnapshot>(
  {
    type: { type: String, enum: ['daily', 'monthly', 'yearly'], required: true },
    dateStr: { type: String, required: true },
    timestamp: { type: Date, required: true },
    metrics: {
      totalRevenue: { type: Number, default: 0 },
      totalExpenses: { type: Number, default: 0 },
      netProfit: { type: Number, default: 0 },
      totalBookings: { type: Number, default: 0 },
      tasksCompleted: { type: Number, default: 0 },
      tasksPending: { type: Number, default: 0 },
      complaintsReceived: { type: Number, default: 0 },
      complaintsResolved: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

ReportSnapshotSchema.index({ type: 1, dateStr: 1 }, { unique: true });
ReportSnapshotSchema.index({ timestamp: -1 });

const ReportSnapshot: Model<IReportSnapshot> =
  mongoose.models.ReportSnapshot ||
  mongoose.model<IReportSnapshot>('ReportSnapshot', ReportSnapshotSchema);

export default ReportSnapshot;
