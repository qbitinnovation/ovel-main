import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IAnomaly extends Document {
  type: 'maintenance_delay' | 'late_payment' | 'sales_drop' | 'custom';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  referenceId?: Types.ObjectId | null; // ID of the delayed task, booking, etc.
  referenceModel?: string; // 'MaintenanceTask', 'Booking', etc.
  status: 'active' | 'acknowledged' | 'resolved';
  detectedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AnomalySchema = new Schema<IAnomaly>(
  {
    type: { 
      type: String, 
      enum: ['maintenance_delay', 'late_payment', 'sales_drop', 'custom'], 
      required: true 
    },
    severity: { 
      type: String, 
      enum: ['low', 'medium', 'high', 'critical'], 
      default: 'medium' 
    },
    title: { type: String, required: true },
    description: { type: String, required: true },
    referenceId: { type: Schema.Types.ObjectId, default: null },
    referenceModel: { type: String, default: null },
    status: { 
      type: String, 
      enum: ['active', 'acknowledged', 'resolved'], 
      default: 'active' 
    },
    detectedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

AnomalySchema.index({ type: 1, status: 1 });
AnomalySchema.index({ detectedAt: -1 });

const Anomaly: Model<IAnomaly> =
  mongoose.models.Anomaly ||
  mongoose.model<IAnomaly>('Anomaly', AnomalySchema);

export default Anomaly;
