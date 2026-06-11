import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IPosition extends Document {
  _id: Types.ObjectId;
  name: string;
  description: string;
  isActive: boolean;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PositionSchema = new Schema<IPosition>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, default: '', trim: true },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  {
    timestamps: true,
  }
);

PositionSchema.index({ name: 1 }, { unique: true });
PositionSchema.index({ isActive: 1 });

const Position: Model<IPosition> =
  mongoose.models.Position || mongoose.model<IPosition>('Position', PositionSchema);

export default Position;
