import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IFinanceLineItem {
  category: string;
  description: string;
  amount: number;
  referenceNumber: string;
}

export interface IFinanceEntry extends Document {
  _id: Types.ObjectId;
  date: Date;
  income: IFinanceLineItem[];
  expenses: IFinanceLineItem[];
  electricity: IFinanceLineItem[];
  otherPayments: IFinanceLineItem[];
  totalIncome: number;
  totalExpenses: number;
  totalElectricity: number;
  totalOtherPayments: number;
  netAmount: number;
  isLocked: boolean;
  lockedAt: Date | null;
  submittedBy: Types.ObjectId;
  unlockHistory: {
    unlockedBy: Types.ObjectId;
    unlockedAt: Date;
    reason: string;
    relockedAt: Date | null;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const LineItemSchema = new Schema({
  category: { type: String, required: true },
  description: { type: String, default: '' },
  amount: { type: Number, required: true, min: 0 },
  referenceNumber: { type: String, default: '' },
}, { _id: false });

const FinanceEntrySchema = new Schema<IFinanceEntry>(
  {
    date: { type: Date, required: true },
    income: [LineItemSchema],
    expenses: [LineItemSchema],
    electricity: [LineItemSchema],
    otherPayments: [LineItemSchema],
    totalIncome: { type: Number, default: 0 },
    totalExpenses: { type: Number, default: 0 },
    totalElectricity: { type: Number, default: 0 },
    totalOtherPayments: { type: Number, default: 0 },
    netAmount: { type: Number, default: 0 },
    isLocked: { type: Boolean, default: false },
    lockedAt: { type: Date, default: null },
    submittedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    unlockHistory: [{
      unlockedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      unlockedAt: { type: Date },
      reason: { type: String },
      relockedAt: { type: Date, default: null },
    }],
  },
  { timestamps: true }
);

FinanceEntrySchema.index({ date: -1 });
FinanceEntrySchema.index({ submittedBy: 1, date: -1 });
FinanceEntrySchema.index({ isLocked: 1 });

// Auto-calculate totals before save
FinanceEntrySchema.pre('save', function () {
  this.totalIncome = this.income.reduce((s, i) => s + i.amount, 0);
  this.totalExpenses = this.expenses.reduce((s, i) => s + i.amount, 0);
  this.totalElectricity = this.electricity.reduce((s, i) => s + i.amount, 0);
  this.totalOtherPayments = this.otherPayments.reduce((s, i) => s + i.amount, 0);
  this.netAmount = this.totalIncome - this.totalExpenses - this.totalElectricity - this.totalOtherPayments;
});

const FinanceEntry: Model<IFinanceEntry> =
  mongoose.models.FinanceEntry || mongoose.model<IFinanceEntry>('FinanceEntry', FinanceEntrySchema);

export default FinanceEntry;
