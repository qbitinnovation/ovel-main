import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IComplaint extends Document {
  title: string;
  description: string;
  category: 'maintenance' | 'finance' | 'staff' | 'general';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'resolved' | 'dismissed';
  submittedBy: Types.ObjectId | null;
  assignedTo?: Types.ObjectId | null;
  resolutionNote?: string;
  resolutionTimeMs?: number; // Time taken to resolve in milliseconds
  resolvedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const ComplaintSchema = new Schema<IComplaint>(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    category: { 
      type: String, 
      enum: ['maintenance', 'finance', 'staff', 'general'], 
      required: true 
    },
    priority: { 
      type: String, 
      enum: ['low', 'medium', 'high', 'urgent'], 
      default: 'medium' 
    },
    status: { 
      type: String, 
      enum: ['open', 'in_progress', 'resolved', 'dismissed'], 
      default: 'open' 
    },
    submittedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    resolutionNote: { type: String },
    resolutionTimeMs: { type: Number },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

ComplaintSchema.index({ status: 1, category: 1 });
ComplaintSchema.index({ createdAt: -1 });

const Complaint: Model<IComplaint> =
  mongoose.models.Complaint ||
  mongoose.model<IComplaint>('Complaint', ComplaintSchema);

export default Complaint;
