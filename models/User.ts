import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  phone: string;
  password: string;
  userType: 'superadmin' | 'management' | 'staff';
  portalType: 'superadmin' | 'committee' | 'turf' | 'shareholder';
  positionId: string | null;
  isActive: boolean;
  isArchived: boolean;
  mustChangePassword: boolean;
  lastLogin: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    password: { type: String, required: true, select: false },
    userType: {
      type: String,
      required: true,
      enum: ['superadmin', 'management', 'staff'],
    },
    portalType: {
      type: String,
      required: true,
      enum: ['superadmin', 'committee', 'turf', 'shareholder'],
    },
    positionId: { type: String, ref: 'Position', default: null },
    isActive: { type: Boolean, default: true },
    isArchived: { type: Boolean, default: false },
    mustChangePassword: { type: Boolean, default: false },
    lastLogin: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

// Indexes
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ userType: 1 });
UserSchema.index({ positionId: 1 });
UserSchema.index({ isActive: 1, isArchived: 1 });

const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default User;
