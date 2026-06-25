import mongoose from 'mongoose';
import SystemSettings from './models/SystemSettings';

async function check() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ovel');
  const settings = await SystemSettings.find({
    key: { $in: ['turf_weekday_rules', 'nets_machine_weekday_rules', 'nets_nomachine_weekday_rules'] }
  }).lean();
  console.log(JSON.stringify(settings, null, 2));
  process.exit(0);
}

check();
