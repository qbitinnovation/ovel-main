import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IMaintenanceTask extends Document {
  _id: Types.ObjectId;
  title: string;
  description: string;
  location: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate: Date;
  assigneeId: Types.ObjectId;
  creatorId: Types.ObjectId;
  status: 'open' | 'in_progress' | 'completed' | 'closed' | 'overdue';
  resolutionNote: string;
  statusHistory: {
    status: string;
    changedBy: Types.ObjectId;
    changedAt: Date;
    note: string;
  }[];
  estimatedCost?: number;
  actualCost?: number;
  linkedMomId?: Types.ObjectId;
  closedAt: Date | null;
  closedBy: Types.ObjectId | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const MaintenanceTaskSchema = new Schema<IMaintenanceTask>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    location: { type: String, default: '', trim: true },
    priority: {
      type: String,
      required: true,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
    dueDate: { type: Date, required: true },
    assigneeId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    creatorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      required: true,
      enum: ['open', 'in_progress', 'completed', 'closed', 'overdue'],
      default: 'open',
    },
    estimatedCost: { type: Number, default: 0 },
    actualCost: { type: Number, default: 0 },
    resolutionNote: { type: String, default: '' },
    statusHistory: [{
      status: { type: String, required: true },
      changedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
      changedAt: { type: Date, default: () => new Date() },
      note: { type: String, default: '' },
    }],
    linkedMomId: { type: Schema.Types.ObjectId, ref: 'MeetingMinutes', default: null },
    closedAt: { type: Date, default: null },
    closedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

MaintenanceTaskSchema.index({ status: 1 });
MaintenanceTaskSchema.index({ assigneeId: 1 });
MaintenanceTaskSchema.index({ creatorId: 1 });
MaintenanceTaskSchema.index({ dueDate: 1 });
MaintenanceTaskSchema.index({ priority: 1 });

const MaintenanceTask: Model<IMaintenanceTask> =
  mongoose.models.MaintenanceTask ||
  mongoose.model<IMaintenanceTask>('MaintenanceTask', MaintenanceTaskSchema);

export default MaintenanceTask;
