import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Booking from '../models/Booking';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function run() {
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.error('No MONGODB_URI found');
    process.exit(1);
  }
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  const bookings = await Booking.find({});
  console.log('--- ALL BOOKINGS ---');
  console.log(JSON.stringify(bookings.map(b => ({
    _id: b._id,
    bookingType: b.bookingType,
    bookingDate: b.bookingDate,
    startTime: b.startTime,
    endTime: b.endTime,
    bookingStatus: b.bookingStatus,
    slots: b.slots
  })), null, 2));

  await mongoose.disconnect();
}

run().catch(console.error);
