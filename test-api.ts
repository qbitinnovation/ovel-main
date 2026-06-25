import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import path from 'path';
import InventoryItem from './models/InventoryItem';
import InventoryTransaction from './models/InventoryTransaction';
import User from './models/User';
import Booking from './models/Booking';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function main() {
  try {
    await mongoose.connect(process.env.MONGODB_URI as string);
    console.log('Connected.');
    
    const items = await InventoryItem.find({ isActive: true }).sort({ name: 1 });
    const recentTransactions = await InventoryTransaction.find()
      .populate('itemId', 'name')
      .populate('enteredBy', 'name')
      .populate({
        path: 'bookingId',
        select: 'customerName contactNumber paymentStatus bookingStatus expectedAmount totalPaid'
      })
      .sort({ createdAt: -1 })
      .limit(50);
      
    console.log('Transactions length:', recentTransactions.length);
    console.log('First txn:', JSON.stringify(recentTransactions[0], null, 2));
    mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
