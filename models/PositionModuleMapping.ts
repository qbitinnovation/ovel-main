import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IPositionModuleMapping extends Document {
  _id: Types.ObjectId;
  positionId: Types.ObjectId;
  moduleKey: string;
  accessLevel: 'view' | 'edit' | 'full_control';
  enabledActions: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PositionModuleMappingSchema = new Schema<IPositionModuleMapping>(
  {
    positionId: { type: Schema.Types.ObjectId, ref: 'Position', required: true },
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

// Compound unique index — one mapping per module per position
PositionModuleMappingSchema.index({ positionId: 1, moduleKey: 1 }, { unique: true });
PositionModuleMappingSchema.index({ positionId: 1, isActive: 1 });

const PositionModuleMapping: Model<IPositionModuleMapping> =
  mongoose.models.PositionModuleMapping ||
  mongoose.model<IPositionModuleMapping>('PositionModuleMapping', PositionModuleMappingSchema);

export default PositionModuleMapping;
