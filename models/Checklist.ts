import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IChecklistItem {
  key: string;
  label: string;
  labelMl: string;
  photoUrl: string;
  gpsLat: number | null;
  gpsLng: number | null;
  capturedAt: Date | null;
  status: 'pending' | 'submitted' | 'approved' | 'rejected' | 'unverified';
  supervisorNote: string;
  rejectedAt: Date | null;
  approvedAt: Date | null;
}

export interface IChecklist extends Document {
  _id: Types.ObjectId;
  staffId: Types.ObjectId;
  date: Date;
  items: IChecklistItem[];
  overallStatus: 'pending' | 'submitted' | 'verified' | 'partially_verified' | 'unverified';
  submittedAt: Date | null;
  verifiedAt: Date | null;
  verifiedBy: Types.ObjectId | null;
  uploadDeadline: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ChecklistItemSchema = new Schema({
  key: { type: String, required: true },
  label: { type: String, required: true },
  labelMl: { type: String, default: '' },
  photoUrl: { type: String, default: '' },
  gpsLat: { type: Number, default: null },
  gpsLng: { type: Number, default: null },
  capturedAt: { type: Date, default: null },
  status: {
    type: String,
    enum: ['pending', 'submitted', 'approved', 'rejected', 'unverified'],
    default: 'pending',
  },
  supervisorNote: { type: String, default: '' },
  rejectedAt: { type: Date, default: null },
  approvedAt: { type: Date, default: null },
}, { _id: false });

const ChecklistSchema = new Schema<IChecklist>(
  {
    staffId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, required: true },
    items: [ChecklistItemSchema],
    overallStatus: {
      type: String,
      enum: ['pending', 'submitted', 'verified', 'partially_verified', 'unverified'],
      default: 'pending',
    },
    submittedAt: { type: Date, default: null },
    verifiedAt: { type: Date, default: null },
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    uploadDeadline: { type: Date, required: true },
  },
  { timestamps: true }
);

ChecklistSchema.index({ staffId: 1, date: -1 });
ChecklistSchema.index({ overallStatus: 1 });
ChecklistSchema.index({ date: -1 });

const Checklist: Model<IChecklist> =
  mongoose.models.Checklist || mongoose.model<IChecklist>('Checklist', ChecklistSchema);

export default Checklist;
