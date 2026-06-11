import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface INotification extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  type: string;
  title: string;
  message: string;
  moduleKey: string;
  recordId: Types.ObjectId | null;
  deepLink: string;
  isRead: boolean;
  channel: 'push' | 'sms' | 'both';
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    message: { type: String, default: '' },
    moduleKey: { type: String, default: '' },
    recordId: { type: Schema.Types.ObjectId, default: null },
    deepLink: { type: String, default: '' },
    isRead: { type: Boolean, default: false },
    channel: { type: String, enum: ['push', 'sms', 'both'], default: 'push' },
  },
  { timestamps: true }
);

NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
NotificationSchema.index({ createdAt: -1 });

const Notification: Model<INotification> =
  mongoose.models.Notification ||
  mongoose.model<INotification>('Notification', NotificationSchema);

export default Notification;
