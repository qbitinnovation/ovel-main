import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IMeetingMinutes extends Document {
  _id: Types.ObjectId;
  date: Date;
  attendees: string[];
  pointsEnglish: string;
  pointsMalayalam: string;
  decisions: string[];
  linkedTaskIds: Types.ObjectId[];
  pendingTasksSummary: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const MeetingMinutesSchema = new Schema<IMeetingMinutes>(
  {
    date: { type: Date, required: true },
    attendees: [{ type: String }],
    pointsEnglish: { type: String, required: true },
    pointsMalayalam: { type: String, default: '' },
    decisions: [{ type: String }],
    linkedTaskIds: [{ type: Schema.Types.ObjectId, ref: 'MaintenanceTask' }],
    pendingTasksSummary: { type: String, default: '' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

MeetingMinutesSchema.index({ date: -1 });
MeetingMinutesSchema.index({ createdBy: 1 });

const MeetingMinutes: Model<IMeetingMinutes> =
  mongoose.models.MeetingMinutes ||
  mongoose.model<IMeetingMinutes>('MeetingMinutes', MeetingMinutesSchema);

export default MeetingMinutes;
