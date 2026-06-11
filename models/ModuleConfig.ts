import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IModuleConfig extends Document {
  _id: Types.ObjectId;
  moduleKey: string;
  moduleName: string;
  description: string;
  availableActions: string[];
  icon: string;
  isActive: boolean;
  displayOrder: number;
}

const ModuleConfigSchema = new Schema<IModuleConfig>(
  {
    moduleKey: { type: String, required: true, unique: true },
    moduleName: { type: String, required: true },
    description: { type: String, default: '' },
    availableActions: [{ type: String }],
    icon: { type: String, default: '📦' },
    isActive: { type: Boolean, default: true },
    displayOrder: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

ModuleConfigSchema.index({ moduleKey: 1 }, { unique: true });
ModuleConfigSchema.index({ isActive: 1, displayOrder: 1 });

const ModuleConfig: Model<IModuleConfig> =
  mongoose.models.ModuleConfig || mongoose.model<IModuleConfig>('ModuleConfig', ModuleConfigSchema);

export default ModuleConfig;
