import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IPaymentEntry extends Document {
  _id: Types.ObjectId;
  bookingId: Types.ObjectId;
  amountPaid: number;
  paymentMode: 'bank_transfer' | 'cash';
  paymentDate: Date;
  referenceNumber: string;  // Bank ref / UTR — for bank transfers
  cashReceivedBy: 'turf_staff' | 'turf_owner' | 'arjo' | '';  // Required when mode is cash
  referenceNote: string;    // Free text for cash payments
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentEntrySchema = new Schema<IPaymentEntry>(
  {
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true },
    amountPaid: { type: Number, required: true, min: 0.01 },
    paymentMode: {
      type: String,
      required: true,
      enum: ['bank_transfer', 'cash'],
    },
    paymentDate: { type: Date, required: true },
    referenceNumber: { type: String, default: '', trim: true },
    cashReceivedBy: {
      type: String,
      enum: ['turf_staff', 'turf_owner', 'arjo', ''],
      default: '',
    },
    referenceNote: { type: String, default: '' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

// Indexes
PaymentEntrySchema.index({ bookingId: 1 });
PaymentEntrySchema.index({ paymentMode: 1 });
PaymentEntrySchema.index({ cashReceivedBy: 1 });
PaymentEntrySchema.index({ paymentDate: -1 });

const PaymentEntry: Model<IPaymentEntry> =
  mongoose.models.PaymentEntry ||
  mongoose.model<IPaymentEntry>('PaymentEntry', PaymentEntrySchema);

export default PaymentEntry;
