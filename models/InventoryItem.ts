import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IInventoryItem extends Document {
  _id: Types.ObjectId;
  name: string;
  unit: string;
  currentStock: number;
  lowStockThreshold: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const InventoryItemSchema = new Schema<IInventoryItem>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    unit: { type: String, default: 'pcs', trim: true },
    currentStock: { type: Number, default: 0, min: 0 },
    lowStockThreshold: { type: Number, default: 5, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

InventoryItemSchema.index({ name: 1 }, { unique: true });
InventoryItemSchema.index({ isActive: 1 });

const InventoryItem: Model<IInventoryItem> =
  mongoose.models.InventoryItem || mongoose.model<IInventoryItem>('InventoryItem', InventoryItemSchema);

export default InventoryItem;
