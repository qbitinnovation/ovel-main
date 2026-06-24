import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IBookingSlot {
  bookingDate: Date;
  startTime: string;
  endTime: string;
}

export interface IBookingEditHistory {
  editedAt: Date;
  oldDate?: Date;
  oldStartTime?: string;
  oldEndTime?: string;
  oldExpectedAmount?: number;
  newDate?: Date;
  newStartTime?: string;
  newEndTime?: string;
  newExpectedAmount?: number;
}

export interface IBooking extends Document {
  _id: Types.ObjectId;
  bookingType: 'standard' | 'bulk';
  bookingDate?: Date; // Optional for bulk bookings, or acts as the primary date
  startTime?: string;
  endTime?: string;
  slots: IBookingSlot[]; // Array of slots for bulk bookings
  customerName: string;
  contactNumber: string;
  expectedAmount: number;
  priceType: 'normal' | 'regular';
  pricingSnapshot: unknown;
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
  bulkId: string | null;
  discountAmount: number;
  discountPercentage: number;
  editHistory?: IBookingEditHistory[];
}

const BookingSlotSchema = new Schema<IBookingSlot>(
  {
    bookingDate: { type: Date, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
  },
  { _id: false }
);

const BookingSchema = new Schema<IBooking>(
  {
    bookingType: { type: String, enum: ['standard', 'bulk'], default: 'standard' },
    bookingDate: { type: Date }, // No longer strictly required if it's a bulk booking
    startTime: { type: String },
    endTime: { type: String },
    slots: { type: [BookingSlotSchema], default: [] },
    customerName: { type: String, default: '', trim: true },
    contactNumber: { type: String, default: '', trim: true },
    expectedAmount: { type: Number, required: true, min: 1 },
    priceType: { type: String, enum: ['normal', 'regular'], default: 'normal' },
    pricingSnapshot: { type: Schema.Types.Mixed, default: null },
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
    bulkId: { type: String, default: null },
    discountAmount: { type: Number, default: 0 },
    discountPercentage: { type: Number, default: 0 },
    editHistory: {
      type: [
        {
          editedAt: { type: Date, required: true },
          oldDate: { type: Date },
          oldStartTime: { type: String },
          oldEndTime: { type: String },
          oldExpectedAmount: { type: Number },
          newDate: { type: Date },
          newStartTime: { type: String },
          newEndTime: { type: String },
          newExpectedAmount: { type: Number },
        }
      ],
      default: []
    },
  },
  { timestamps: true }
);

// Indexes
BookingSchema.index({ bookingDate: -1 });
BookingSchema.index({ bookingDate: 1, startTime: 1, endTime: 1 });
BookingSchema.index({ 'slots.bookingDate': 1, 'slots.startTime': 1, 'slots.endTime': 1 });
BookingSchema.index({ paymentStatus: 1 });
BookingSchema.index({ bookingStatus: 1 });
BookingSchema.index({ createdBy: 1 });

const Booking: Model<IBooking> =
  mongoose.models.Booking || mongoose.model<IBooking>('Booking', BookingSchema);

export default Booking;
