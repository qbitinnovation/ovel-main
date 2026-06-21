import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IPortalModuleMapping extends Document {
  _id: Types.ObjectId;
  portalType: 'turf' | 'shareholder';
  moduleKey: string;
  accessLevel: 'view' | 'edit' | 'full_control';
  enabledActions: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PortalModuleMappingSchema = new Schema<IPortalModuleMapping>(
  {
    portalType: {
      type: String,
      required: true,
      enum: ['turf', 'shareholder'],
    },
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

// Compound unique index — one mapping per module per portal
PortalModuleMappingSchema.index({ portalType: 1, moduleKey: 1 }, { unique: true });
PortalModuleMappingSchema.index({ portalType: 1, isActive: 1 });

const PortalModuleMapping: Model<IPortalModuleMapping> =
  mongoose.models.PortalModuleMapping ||
  mongoose.model<IPortalModuleMapping>('PortalModuleMapping', PortalModuleMappingSchema);

export default PortalModuleMapping;
