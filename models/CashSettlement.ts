import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface ICashSettlement extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  amount: number;
  settledAt: Date;
  settledBy: Types.ObjectId; // The admin who received the cash
  referenceNote: string;
  createdAt: Date;
}

const CashSettlementSchema = new Schema<ICashSettlement>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    settledAt: { type: Date, required: true, default: Date.now },
    settledBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    referenceNote: { type: String, default: '' }
  },
  { timestamps: true }
);

CashSettlementSchema.index({ userId: 1 });
CashSettlementSchema.index({ settledAt: -1 });

const CashSettlement: Model<ICashSettlement> =
  mongoose.models.CashSettlement || mongoose.model<ICashSettlement>('CashSettlement', CashSettlementSchema);

export default CashSettlement;
