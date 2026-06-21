import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

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

  const User = mongoose.models.User || mongoose.model('User', new mongoose.Schema({}, { strict: false }));
  const PortalModuleMapping = mongoose.models.PortalModuleMapping || mongoose.model('PortalModuleMapping', new mongoose.Schema({}, { strict: false }));
  const PositionModuleMapping = mongoose.models.PositionModuleMapping || mongoose.model('PositionModuleMapping', new mongoose.Schema({}, { strict: false }));

  const users = await User.find({});
  console.log('--- USERS ---');
  console.log(users.map(u => ({ _id: u._id.toString(), name: u.name, email: u.email, userType: u.userType, portalType: u.portalType })));

  const portalMappings = await PortalModuleMapping.find({});
  console.log('--- PORTAL MODULE MAPPINGS ---');
  console.log(portalMappings);

  const positionMappings = await PositionModuleMapping.find({});
  console.log('--- POSITION MODULE MAPPINGS ---');
  console.log(positionMappings);

  await mongoose.disconnect();
}

run().catch(console.error);
