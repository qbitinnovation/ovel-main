import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IInventoryTransaction extends Document {
  _id: Types.ObjectId;
  itemId: Types.ObjectId;
  type: 'sale' | 'restock';
  quantity: number;
  amount: number;
  supplier: string;
  customerName: string;
  customerContact: string;
  date: Date;
  enteredBy: Types.ObjectId;
  createdAt: Date;
  bookingId?: Types.ObjectId | null;
  receivedBy?: Types.ObjectId;
}

const InventoryTransactionSchema = new Schema<IInventoryTransaction>(
  {
    itemId: { type: Schema.Types.ObjectId, ref: 'InventoryItem', required: true },
    type: { type: String, required: true, enum: ['sale', 'restock'] },
    quantity: { type: Number, required: true, min: 1 },
    amount: { type: Number, default: 0, min: 0 },
    supplier: { type: String, default: '' },
    customerName: { type: String, default: '' },
    customerContact: { type: String, default: '' },
    date: { type: Date, required: true },
    enteredBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', default: null },
    receivedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

InventoryTransactionSchema.index({ itemId: 1, date: -1 });
InventoryTransactionSchema.index({ type: 1 });
InventoryTransactionSchema.index({ enteredBy: 1 });

const InventoryTransaction: Model<IInventoryTransaction> =
  mongoose.models.InventoryTransaction ||
  mongoose.model<IInventoryTransaction>('InventoryTransaction', InventoryTransactionSchema);

export default InventoryTransaction;
