import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IAccountTransaction extends Document {
  _id: Types.ObjectId;
  type: 'income' | 'expense';
  source: 'booking' | 'sale' | 'restock' | 'manual';
  amount: number;
  paymentMode: 'bank_transfer' | 'upi' | 'card' | 'cash' | 'split' | 'other';
  customerName: string;
  customerContact: string;
  summary: string;
  referenceNumber: string;
  date: Date;
  createdBy: Types.ObjectId;
  bookingId?: Types.ObjectId;
  inventoryTransactionId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const AccountTransactionSchema = new Schema<IAccountTransaction>(
  {
    type: { type: String, enum: ['income', 'expense'], required: true },
    source: { type: String, enum: ['booking', 'sale', 'restock', 'manual'], required: true },
    amount: { type: Number, required: true },
    paymentMode: { type: String, enum: ['bank_transfer', 'upi', 'card', 'cash', 'split', 'other'], default: 'other' },
    customerName: { type: String, default: '' },
    customerContact: { type: String, default: '' },
    summary: { type: String, required: true },
    referenceNumber: { type: String, default: '' },
    date: { type: Date, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking' },
    inventoryTransactionId: { type: Schema.Types.ObjectId, ref: 'InventoryTransaction' },
  },
  { timestamps: true }
);

AccountTransactionSchema.index({ date: -1 });
AccountTransactionSchema.index({ source: 1, date: -1 });
AccountTransactionSchema.index({ createdBy: 1, date: -1 });

const AccountTransaction: Model<IAccountTransaction> =
  mongoose.models.AccountTransaction || mongoose.model<IAccountTransaction>('AccountTransaction', AccountTransactionSchema);

export default AccountTransaction;
