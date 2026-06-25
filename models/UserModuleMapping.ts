import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IUserModuleMapping extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  moduleKey: string;
  accessLevel: 'view' | 'edit' | 'full_control';
  enabledActions: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserModuleMappingSchema = new Schema<IUserModuleMapping>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    moduleKey: { type: String, required: true },
    accessLevel: {
      type: String,
      required: true,
      enum: ['view', 'edit', 'full_control'],
    },
    enabledActions: [{ type: String }],
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

// Compound unique index — one mapping per module per user
UserModuleMappingSchema.index({ userId: 1, moduleKey: 1 }, { unique: true });
UserModuleMappingSchema.index({ userId: 1, isActive: 1 });

const UserModuleMapping: Model<IUserModuleMapping> =
  mongoose.models.UserModuleMapping ||
  mongoose.model<IUserModuleMapping>('UserModuleMapping', UserModuleMappingSchema);

export default UserModuleMapping;
