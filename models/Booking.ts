import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IBooking extends Document {
  _id: Types.ObjectId;
  bookingDate: Date;
  startTime: string; // HH:mm format e.g. "06:00"
  endTime: string;   // HH:mm format e.g. "08:00"
  customerName: string;
  contactNumber: string;
  expectedAmount: number;
  notes: string;
  bookingStatus: 'confirmed' | 'cancelled';
  paymentStatus: 'pending' | 'partial' | 'paid';
  totalPaid: number;
  cancelReason: string;
  cancelledAt: Date | null;
  cancelledBy: Types.ObjectId | null;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const BookingSchema = new Schema<IBooking>(
  {
    bookingDate: { type: Date, required: true },
    startTime: { type: String, required: true }, // "06:00"
    endTime: { type: String, required: true },   // "08:00"
    customerName: { type: String, default: '', trim: true },
    contactNumber: { type: String, default: '', trim: true },
    expectedAmount: { type: Number, required: true, min: 1 },
    notes: { type: String, default: '' },
    bookingStatus: {
      type: String,
      required: true,
      enum: ['confirmed', 'cancelled'],
      default: 'confirmed',
    },
    paymentStatus: {
      type: String,
      required: true,
      enum: ['pending', 'partial', 'paid'],
      default: 'pending',
    },
    totalPaid: { type: Number, default: 0, min: 0 },
    cancelReason: { type: String, default: '' },
    cancelledAt: { type: Date, default: null },
    cancelledBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

// Indexes
BookingSchema.index({ bookingDate: -1 });
BookingSchema.index({ bookingDate: 1, startTime: 1, endTime: 1 });
BookingSchema.index({ paymentStatus: 1 });
BookingSchema.index({ bookingStatus: 1 });
BookingSchema.index({ createdBy: 1 });

const Booking: Model<IBooking> =
  mongoose.models.Booking || mongoose.model<IBooking>('Booking', BookingSchema);

export default Booking;
