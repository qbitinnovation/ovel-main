import mongoose from 'mongoose';
import User from '../models/User';

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/oms');
  const users = await User.find({}).lean();
  console.log(JSON.stringify(users, null, 2));
  process.exit(0);
}

main().catch(console.error);
