import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface ITurfInventoryItem extends Document {
  _id: Types.ObjectId;
  name: string;
  category: string;
  quantity: number;
  location: string;
  condition: 'good' | 'needs_repair' | 'damaged' | 'missing';
  notes: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TurfInventoryItemSchema = new Schema<ITurfInventoryItem>(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, default: 'General', trim: true },
    quantity: { type: Number, default: 1, min: 0 },
    location: { type: String, default: 'Turf', trim: true },
    condition: { type: String, enum: ['good', 'needs_repair', 'damaged', 'missing'], default: 'good' },
    notes: { type: String, default: '', trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

TurfInventoryItemSchema.index({ name: 1, category: 1 });
TurfInventoryItemSchema.index({ isActive: 1 });

const TurfInventoryItem: Model<ITurfInventoryItem> =
  mongoose.models.TurfInventoryItem || mongoose.model<ITurfInventoryItem>('TurfInventoryItem', TurfInventoryItemSchema);

export default TurfInventoryItem;
