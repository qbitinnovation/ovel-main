import dbConnect from '../lib/db';
import Booking from '../models/Booking';
import PaymentEntry from '../models/PaymentEntry';

async function main() {
  await dbConnect();
  const bookings = await Booking.find().sort({ createdAt: -1 }).limit(5);
  console.log('--- RECENT BOOKINGS ---');
  for (const b of bookings) {
    console.log(`ID: ${b._id}, Date: ${b.bookingDate}, Customer: ${b.customerName}, Expected: ${b.expectedAmount}, Paid: ${b.totalPaid}, Status: ${b.paymentStatus}, BulkId: ${b.bulkId}`);
    const payments = await PaymentEntry.find({ bookingId: b._id });
    console.log(`  Payments (${payments.length}):`);
    for (const p of payments) {
      console.log(`    Mode: ${p.paymentMode}, Amt: ${p.amountPaid}, Splits: ${JSON.stringify(p.splits)}`);
    }
  }
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
