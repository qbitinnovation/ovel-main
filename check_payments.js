const mongoose = require('mongoose');

async function check() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ovel-main');
  
  const Booking = mongoose.model('Booking', new mongoose.Schema({}, {strict: false, collection: 'bookings'}));
  const PaymentEntry = mongoose.model('PaymentEntry', new mongoose.Schema({}, {strict: false, collection: 'paymententries'}));
  
  const bookings = await Booking.find({ totalPaid: { $gt: 0 } }).limit(2).lean();
  console.log('Bookings:', bookings.map(b => ({ id: b._id, customer: b.customerName, totalPaid: b.totalPaid, bulkId: b.bulkId })));
  
  if (bookings.length > 0) {
    for (const b of bookings) {
      const payments = await PaymentEntry.find({ bookingId: b._id }).lean();
      console.log(`Payments for ${b._id}:`, payments.length);
    }
  }
  
  process.exit(0);
}

check().catch(console.error);
