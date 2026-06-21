const mongoose = require('mongoose');
const User = require('./models/User'); // this might fail if not compiled

// Alternative: just use mongodb native driver!
const { MongoClient } = require('mongodb');

async function main() {
  const client = new MongoClient('mongodb://localhost:27017');
  await client.connect();
  const db = client.db('oms');
  const users = await db.collection('users').find({}).toArray();
  console.log(JSON.stringify(users, null, 2));
  await client.close();
}

main().catch(console.error);
