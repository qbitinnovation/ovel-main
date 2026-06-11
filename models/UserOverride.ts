import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IUserOverride extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  moduleKey: string;
  overrideType: 'extend' | 'restrict';
  accessLevel: 'view' | 'edit' | 'full_control' | null;
  enabledActions: string[];
  disabledActions: string[];
  isActive: boolean;
  grantedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const UserOverrideSchema = new Schema<IUserOverride>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    moduleKey: { type: String, required: true },
    overrideType: {
      type: String,
      required: true,
      enum: ['extend', 'restrict'],
    },
    accessLevel: {
      type: String,
      enum: ['view', 'edit', 'full_control', null],
      default: null,
    },
    enabledActions: [{ type: String }],
    disabledActions: [{ type: String }],
    isActive: { type: Boolean, default: true },
    grantedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  {
    timestamps: true,
  }
);

// Compound unique index — one override per module per user
UserOverrideSchema.index({ userId: 1, moduleKey: 1 }, { unique: true });

const UserOverride: Model<IUserOverride> =
  mongoose.models.UserOverride || mongoose.model<IUserOverride>('UserOverride', UserOverrideSchema);

export default UserOverride;
