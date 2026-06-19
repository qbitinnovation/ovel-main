import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not found in .env.local');
  process.exit(1);
}

const SystemSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    value: { type: mongoose.Schema.Types.Mixed, required: true },
    label: { type: String, default: '' },
    category: { type: String, default: 'general' },
  },
  { timestamps: true, collection: 'systemsettings' } // ensure correct collection name
);

const SystemSettings = mongoose.models.SystemSettings || mongoose.model('SystemSettings', SystemSettingsSchema);

const newRules = [
  {
    id: 'rule-wd-1',
    name: '6AM-10AM',
    startTime: '06:00',
    endTime: '10:00',
    normalPricePerHour: 2420,
    regularPricePerHour: 2200,
    dayType: 'weekdays',
    isActive: true,
  },
  {
    id: 'rule-wd-2',
    name: '10AM-4PM',
    startTime: '10:00',
    endTime: '16:00',
    normalPricePerHour: 1870,
    regularPricePerHour: 1650,
    dayType: 'weekdays',
    isActive: true,
  },
  {
    id: 'rule-wd-3',
    name: '4PM-6PM',
    startTime: '16:00',
    endTime: '18:00',
    normalPricePerHour: 2420,
    regularPricePerHour: 2200,
    dayType: 'weekdays',
    isActive: true,
  },
  {
    id: 'rule-wd-4',
    name: '6PM-12AM',
    startTime: '18:00',
    endTime: '00:00',
    normalPricePerHour: 2750,
    regularPricePerHour: 2530,
    dayType: 'weekdays',
    isActive: true,
  },
];

async function run() {
  console.log('🌱 Connecting to database...');
  await mongoose.connect(MONGODB_URI!);
  console.log('✅ Connected');

  console.log('🔄 Updating turf_weekday_rules in database...');
  const result = await SystemSettings.findOneAndUpdate(
    { key: 'turf_weekday_rules' },
    {
      $set: {
        value: newRules,
        label: 'Weekday Price Customization',
        category: 'bookings',
      },
    },
    { upsert: true, new: true }
  );

  console.log('✅ Update successful! Current value:');
  console.log(JSON.stringify(result.value, null, 2));

  await mongoose.disconnect();
  console.log('👋 Disconnected');
  process.exit(0);
}

run().catch((err) => {
  console.error('❌ Failed:', err);
  process.exit(1);
});
