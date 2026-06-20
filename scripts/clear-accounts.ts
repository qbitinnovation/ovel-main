import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load env variables from .env.local
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not found in .env.local');
  process.exit(1);
}

// Inline simple schema to avoid next.js path import complications
const FinanceEntrySchema = new mongoose.Schema({}, { strict: false });
const FinanceEntry = mongoose.models.FinanceEntry || mongoose.model('FinanceEntry', FinanceEntrySchema);

async function main() {
  console.log('🔌 Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI!, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
    socketTimeoutMS: 10000,
  });
  console.log('✅ Connected successfully!');

  console.log('🧹 Clearing all records from FinanceEntry...');
  const result = await FinanceEntry.deleteMany({});
  console.log(`✅ Successfully deleted ${result.deletedCount} finance entry records from the 'FinanceEntry' collection!`);

  await mongoose.disconnect();
  console.log('🔌 Disconnected from MongoDB.');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Failed to clear finance entries:', err);
  process.exit(1);
});
