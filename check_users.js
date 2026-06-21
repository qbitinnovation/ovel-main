const mongoose = require('mongoose');
const { User } = require('./models/User'); // wait we need to use the right path or just define the schema

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ovalturf_dev')
  .then(async () => {
    // we just use the raw collection
    const users = await mongoose.connection.collection('users').find({ portalType: 'committee' }).toArray();
    console.log(JSON.stringify(users, null, 2));
    process.exit(0);
  });
