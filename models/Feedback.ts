import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IFeedback extends Document {
  type: 'complaint' | 'suggestion' | 'general';
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'resolved' | 'dismissed' | 'closed';
  submittedBy?: Types.ObjectId | null;
  assignedTo?: Types.ObjectId | null;
  assignedBy?: Types.ObjectId | null;
  assignedAt?: Date | null;
  comments: Array<{
    user: Types.ObjectId;
    text: string;
    createdAt: Date;
  }>;
  resolutionNote?: string;
  resolutionTimeMs?: number; // Time taken to resolve in milliseconds
  resolvedAt?: Date | null;
  closedAt?: Date | null;
  
  // Public QR Feedback Fields
  guestName?: string;
  guestMobile?: string;
  attachmentUrl?: string;
  source: 'portal' | 'qr';

  createdAt: Date;
  updatedAt: Date;
}

const FeedbackSchema = new Schema<IFeedback>(
  {
    type: { 
      type: String, 
      enum: ['complaint', 'suggestion', 'general'], 
      required: true 
    },
    title: { type: String, required: true },
    description: { type: String, required: true },
    priority: { 
      type: String, 
      enum: ['low', 'medium', 'high', 'urgent'], 
      default: 'medium' 
    },
    status: { 
      type: String, 
      enum: ['open', 'in_progress', 'resolved', 'dismissed', 'closed'], 
      default: 'open' 
    },
    submittedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    assignedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    assignedAt: { type: Date, default: null },
    comments: [{
      user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
      text: { type: String, required: true },
      createdAt: { type: Date, default: Date.now }
    }],
    resolutionNote: { type: String },
    resolutionTimeMs: { type: Number },
    resolvedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },

    // Public QR Feedback Fields
    guestName: { type: String },
    guestMobile: { type: String },
    attachmentUrl: { type: String },
    source: { type: String, enum: ['portal', 'qr'], default: 'portal' },
  },
  { timestamps: true }
);

FeedbackSchema.index({ status: 1, type: 1 });
FeedbackSchema.index({ createdAt: -1 });

const Feedback: Model<IFeedback> =
  mongoose.models.Feedback ||
  mongoose.model<IFeedback>('Feedback', FeedbackSchema);

export default Feedback;
