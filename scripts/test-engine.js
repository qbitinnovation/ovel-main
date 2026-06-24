const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

async function test() {
  const mongoose = require('mongoose');
  await mongoose.connect(process.env.MONGODB_URI);

  const MaintenanceTask = require('../models/MaintenanceTask').default;
  const Booking = require('../models/Booking').default;
  const Anomaly = require('../models/Anomaly').default;
  const ReportSnapshot = require('../models/ReportSnapshot').default;

  console.log('Connected to DB. Running anomaly calculation...');
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const delayedTasks = await MaintenanceTask.find({
      $or: [
        { status: { $in: ['open', 'in_progress', 'overdue'] }, dueDate: { $lt: now } },
        { status: { $in: ['completed', 'closed'] }, $expr: { $gt: ['$completedAt', '$dueDate'] } }
      ]
    });
    console.log('delayedTasks count:', delayedTasks.length);

    const lateBookings = await Booking.find({
      paymentStatus: { $in: ['pending', 'partial'] },
      bookingDate: { $lt: startOfToday }
    });
    console.log('lateBookings count:', lateBookings.length);

    console.log('Done testing queries.');
  } catch (err) {
    console.error('Error during test:', err);
  } finally {
    mongoose.connection.close();
  }
}

test();
