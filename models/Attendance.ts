import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IAttendance extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  timestamp: Date;
  location: {
    lat: number;
    lng: number;
  };
  distance: number;
  status: 'pending' | 'verified' | 'rejected';
  verifiedBy: Types.ObjectId | null;
  verifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const AttendanceSchema = new Schema<IAttendance>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    timestamp: { type: Date, required: true },
    location: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
    distance: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    verifiedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

AttendanceSchema.index({ userId: 1 });
AttendanceSchema.index({ status: 1 });
AttendanceSchema.index({ timestamp: -1 });

const Attendance: Model<IAttendance> =
  mongoose.models.Attendance ||
  mongoose.model<IAttendance>('Attendance', AttendanceSchema);

export default Attendance;
